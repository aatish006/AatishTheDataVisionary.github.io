import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DEMO_STATES, demoBookRecords } from '../lib/demoBooks';
import { requestPersistentStorage } from '../lib/db';
import { importerFor, MAX_FILE_MB } from '../lib/importers';
import { repository as repo, uid } from '../lib/repository';
import {
  blankState,
  defaultPrefs,
  type Book,
  type Bookmark,
  type ReadingPosition,
  type ShelfStatus,
  type UserBookState,
  type UserId,
  type UserPrefs,
} from '../lib/types';
import { generatedCoverFor } from '../components/Cover';
import * as cloud from '../lib/cloud';
import type { CloudMode, SyncStatus } from '../lib/cloud';

/** Supabase's free plan caps a single stored file at 50 MB. */
const CLOUD_MAX_FILE_MB = 50;

interface LibraryValue {
  ready: boolean;
  /** per-user states & prefs are loaded for the current reader */
  userReady: boolean;
  error?: string;
  user: UserId | null;
  /** all books visible to the current user (own + shared), respecting demo visibility */
  books: Book[];
  allBooks: Book[];
  states: Record<string, UserBookState>;
  prefs: UserPrefs;
  stateOf(bookId: string): UserBookState;
  addBook(file: File, onStage?: (s: string) => void): Promise<Book>;
  updateBook(book: Book): Promise<void>;
  deleteBook(id: string): Promise<void>;
  patchState(bookId: string, patch: Partial<UserBookState>): Promise<UserBookState>;
  setStatus(bookId: string, status: ShelfStatus): Promise<void>;
  toggleFavourite(bookId: string): Promise<void>;
  saveProgress(bookId: string, position: ReadingPosition, progress: number, label?: string): Promise<void>;
  addBookmark(bookId: string, b: Omit<Bookmark, 'id' | 'createdAt'>): Promise<Bookmark>;
  removeBookmark(bookId: string, id: string): Promise<void>;
  updatePrefs(patch: Partial<UserPrefs>): void;
  lastAddedId: string | null;
  /** 'local' (this device only), 'supabase' (synced) or 'mock' (tests) */
  cloudMode: CloudMode;
  syncStatus: SyncStatus;
  /** the current reader must sign in before their library can load */
  authNeeded: boolean;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  syncNow(): Promise<void>;
}

const Ctx = createContext<LibraryValue | null>(null);

export function useLibrary() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLibrary must be used inside <LibraryProvider>');
  return v;
}

async function seedIfNeeded() {
  if (await repo.getMeta<boolean>('seeded')) return;
  for (const b of demoBookRecords()) await repo.saveBook(b);
  for (const s of DEMO_STATES) {
    const st = blankState(s.userId, s.bookId);
    await repo.saveState({
      ...st,
      status: s.status,
      favourite: !!s.favourite,
      progress: s.progress,
      position: s.progress ? { section: s.section, fraction: s.fraction } : undefined,
      positionLabel: s.progress && s.status === 'reading' ? `Chapter ${s.section + 1}` : undefined,
      lastOpenedAt: s.status === 'reading' ? Date.now() - (s.userId === 'aatish' ? 3600e3 * 20 : 3600e3 * 5) : undefined,
      finishedAt: s.status === 'finished' ? Date.now() - 86400e3 * 4 : undefined,
    });
  }
  await repo.setMeta('seeded', true);
}

export function LibraryProvider({ user, children }: { user: UserId | null; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();
  const [allBooks, setAllBooks] = useState<Book[]>([]);
  const [states, setStates] = useState<Record<string, UserBookState>>({});
  const [prefs, setPrefs] = useState<UserPrefs>(() => defaultPrefs(user ?? 'aatish'));
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [loadedUser, setLoadedUser] = useState<UserId | null>(null);
  const [cloudMode, setCloudMode] = useState<CloudMode>('local');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(cloud.cloudStatus());
  const [authNeeded, setAuthNeeded] = useState(false);
  const [authNonce, setAuthNonce] = useState(0);
  const userRef = useRef(user);
  userRef.current = user;
  const statesRef = useRef(states);
  statesRef.current = states;

  useEffect(() => {
    (async () => {
      try {
        setCloudMode(await cloud.initCloud());
        await seedIfNeeded();
        setAllBooks(await repo.listBooks());
        void requestPersistentStorage();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // Re-read everything for the current reader from the local store.
  const reload = useCallback(async (u: UserId) => {
    const [list, p, books] = await Promise.all([repo.listStates(u), repo.getPrefs(u), repo.listBooks()]);
    if (userRef.current !== u) return false;
    const map = Object.fromEntries(list.map((s) => [s.bookId, s]));
    statesRef.current = map;
    setStates(map);
    setPrefs(p);
    setAllBooks(books);
    return true;
  }, []);

  // Load per-user data whenever the reader changes. Nothing is shared between users here.
  // With cloud sync on, the reader signs in once per device, then we pull their library first.
  useEffect(() => {
    if (!user || !ready) return; // wait until first-run seeding has finished
    let alive = true;
    setAuthNeeded(false);
    (async () => {
      if (cloud.cloudEnabled()) {
        if (!(await cloud.hasSession(user))) {
          if (alive) setAuthNeeded(true);
          return;
        }
        await cloud.activate(user);
        // Don't keep the reader waiting on a slow or missing connection.
        await Promise.race([cloud.sync(), new Promise((r) => setTimeout(r, 6000))]);
      }
      if (alive && (await reload(user))) setLoadedUser(user);
    })().catch((e) => setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [user, ready, authNonce, reload]);

  // Keep in step with other devices: sync on return to the app, when back online, and every minute.
  useEffect(() => {
    if (cloudMode === 'local') return;
    const offStatus = cloud.onCloudStatus(setSyncStatus);
    const offChanges = cloud.onCloudChanges(() => {
      if (userRef.current) void reload(userRef.current);
    });
    const onVis = () => void cloud.sync();
    const onFocus = () => document.visibilityState === 'visible' && void cloud.sync();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', onFocus);
    window.addEventListener('focus', onFocus);
    const id = window.setInterval(() => document.visibilityState === 'visible' && void cloud.sync(), 60000);
    return () => {
      offStatus();
      offChanges();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('online', onFocus);
      window.removeEventListener('focus', onFocus);
      window.clearInterval(id);
    };
  }, [cloudMode, reload]);

  const stateOf = useCallback(
    (bookId: string) => states[bookId] ?? blankState(user ?? 'aatish', bookId),
    [states, user],
  );

  const patchState = useCallback(async (bookId: string, patch: Partial<UserBookState>) => {
    const u = userRef.current;
    if (!u) throw new Error('No reader selected');
    const prev = statesRef.current[bookId] ?? (await repo.getState(u, bookId));
    const next: UserBookState = { ...prev, ...patch, key: `${u}:${bookId}`, userId: u, bookId, updatedAt: Date.now() };
    statesRef.current = { ...statesRef.current, [bookId]: next };
    setStates(statesRef.current);
    await repo.saveState(next);
    cloud.requestSync();
    return next;
  }, []);

  const value = useMemo<LibraryValue>(() => {
    const visible = allBooks
      .filter((b) => user && (b.ownerId === user || b.shared))
      .filter((b) => prefs.showDemo || !b.isDemo);

    return {
      ready,
      userReady: !!user && loadedUser === user,
      error,
      user,
      books: visible,
      allBooks,
      states,
      prefs,
      stateOf,
      lastAddedId,

      async addBook(file, onStage) {
        const u = userRef.current;
        if (!u) throw new Error('Choose a reader first.');
        const importer = importerFor(file);
        if (!importer) throw new Error('That file type isn’t supported yet. Try an EPUB or PDF.');
        const maxMb = cloud.cloudEnabled() ? CLOUD_MAX_FILE_MB : MAX_FILE_MB;
        if (file.size > maxMb * 1024 * 1024) throw new Error(`That file is larger than ${maxMb} MB.`);
        onStage?.('Opening the cover…');
        const meta = await importer.inspect(file);
        onStage?.('Finding the title page…');
        const id = uid('b_');
        const fileKey = `file:${id}`;
        await repo.putBlob(fileKey, file);
        let cover: Book['cover'];
        const title = meta.title?.trim() || file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
        if (meta.cover) {
          const coverKey = `cover:${id}`;
          await repo.putBlob(coverKey, meta.cover);
          cover = { kind: 'image', blobKey: coverKey };
        } else cover = generatedCoverFor(title);
        onStage?.('Placing it on the shelf…');
        const book: Book = {
          id,
          ownerId: u,
          shared: false,
          title,
          author: meta.author || 'Unknown author',
          description: meta.description,
          category: meta.category,
          format: importer.format,
          pageCount: meta.pageCount,
          fileSize: file.size,
          addedAt: Date.now(),
          cover,
          fileKey,
          updatedAt: Date.now(),
        };
        await repo.saveBook(book);
        setAllBooks((bs) => [...bs, book]);
        await patchState(id, { status: 'want' });
        if (cloud.cloudEnabled()) {
          onStage?.('Keeping it safe in the cloud…');
          // Upload now so the book is on every device; if offline it goes up on the next sync.
          await cloud.sync();
          const synced = await repo.getBook(id);
          if (synced) {
            setAllBooks((bs) => bs.map((b) => (b.id === id ? synced : b)));
            return synced;
          }
        }
        setLastAddedId(id);
        return book;
      },

      async updateBook(book) {
        const next = { ...book, updatedAt: Date.now() };
        await repo.saveBook(next);
        setAllBooks((bs) => bs.map((b) => (b.id === next.id ? next : b)));
        cloud.requestSync();
      },

      async deleteBook(id) {
        const book = await repo.getBook(id);
        if (book) await cloud.recordDeletion(book);
        await repo.deleteBook(id);
        cloud.requestSync(300);
        setAllBooks((bs) => bs.filter((b) => b.id !== id));
        setStates((s) => {
          const n = { ...s };
          delete n[id];
          return n;
        });
      },

      patchState,

      async setStatus(bookId, status) {
        await patchState(bookId, {
          status,
          ...(status === 'finished' ? { finishedAt: Date.now(), progress: 1 } : {}),
        });
      },

      async toggleFavourite(bookId) {
        await patchState(bookId, { favourite: !stateOf(bookId).favourite });
      },

      async saveProgress(bookId, position, progress, label) {
        const prev = statesRef.current[bookId];
        await patchState(bookId, {
          position,
          progress,
          positionLabel: label,
          lastOpenedAt: Date.now(),
          status: prev?.status === 'finished' ? 'finished' : 'reading',
        });
      },

      async addBookmark(bookId, b) {
        const bm: Bookmark = { ...b, id: uid('bm_'), createdAt: Date.now() };
        const prev = statesRef.current[bookId]?.bookmarks ?? [];
        await patchState(bookId, { bookmarks: [...prev, bm].sort((a, b2) => a.progress - b2.progress) });
        return bm;
      },

      async removeBookmark(bookId, id) {
        const prev = statesRef.current[bookId]?.bookmarks ?? [];
        await patchState(bookId, { bookmarks: prev.filter((b) => b.id !== id) });
      },

      updatePrefs(patch) {
        setPrefs((p) => {
          const next = { ...p, ...patch, userId: userRef.current ?? p.userId, updatedAt: Date.now() };
          void repo.savePrefs(next).then(() => cloud.requestSync(2500));
          return next;
        });
      },

      cloudMode,
      syncStatus,
      authNeeded,
      async signIn(email, password) {
        const u = userRef.current;
        if (!u) return;
        await cloud.signIn(u, email, password);
        setAuthNonce((n) => n + 1);
      },
      async signOut() {
        const u = userRef.current;
        if (u) await cloud.signOut(u);
      },
      async syncNow() {
        await cloud.sync();
      },
    };
  }, [allBooks, user, prefs, ready, error, states, stateOf, lastAddedId, patchState, loadedUser, cloudMode, syncStatus, authNeeded]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
