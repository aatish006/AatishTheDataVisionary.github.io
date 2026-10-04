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
  const userRef = useRef(user);
  userRef.current = user;
  const statesRef = useRef(states);
  statesRef.current = states;

  useEffect(() => {
    (async () => {
      try {
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

  // Load per-user data whenever the reader changes. Nothing is shared between users here.
  useEffect(() => {
    if (!user || !ready) return; // wait until first-run seeding has finished
    let alive = true;
    (async () => {
      const [list, p] = await Promise.all([repo.listStates(user), repo.getPrefs(user)]);
      if (!alive) return;
      const map = Object.fromEntries(list.map((s) => [s.bookId, s]));
      statesRef.current = map;
      setStates(map);
      setPrefs(p);
      setLoadedUser(user);
    })().catch((e) => setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [user, ready]);

  const stateOf = useCallback(
    (bookId: string) => states[bookId] ?? blankState(user ?? 'aatish', bookId),
    [states, user],
  );

  const patchState = useCallback(async (bookId: string, patch: Partial<UserBookState>) => {
    const u = userRef.current;
    if (!u) throw new Error('No reader selected');
    const prev = statesRef.current[bookId] ?? (await repo.getState(u, bookId));
    const next: UserBookState = { ...prev, ...patch, key: `${u}:${bookId}`, userId: u, bookId };
    statesRef.current = { ...statesRef.current, [bookId]: next };
    setStates(statesRef.current);
    await repo.saveState(next);
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
        if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`That file is larger than ${MAX_FILE_MB} MB.`);
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
        };
        await repo.saveBook(book);
        setAllBooks((bs) => [...bs, book]);
        await patchState(id, { status: 'want' });
        setLastAddedId(id);
        return book;
      },

      async updateBook(book) {
        await repo.saveBook(book);
        setAllBooks((bs) => bs.map((b) => (b.id === book.id ? book : b)));
      },

      async deleteBook(id) {
        await repo.deleteBook(id);
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
          const next = { ...p, ...patch, userId: userRef.current ?? p.userId };
          void repo.savePrefs(next);
          return next;
        });
      },
    };
  }, [allBooks, user, prefs, ready, error, states, stateOf, lastAddedId, patchState, loadedUser]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
