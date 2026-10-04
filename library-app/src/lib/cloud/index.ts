// Cloud sync facade.
//
// config.json decides the mode:
//   • empty            → "local": everything stays on this device (no sign-in)
//   • supabase url/key → "supabase": sign in once per device; library follows you
//   • "mock": true     → test-only pretend cloud
//
// The local IndexedDB store stays the source of truth for the UI. `sync()`
// reconciles it with the cloud: newest change wins, per book / per reading
// state / per preferences record.

import { repository as repo } from '../repository';
import { partnerOf, type Book, type PartnerHighlight, type UserBookState, type UserId, type UserPrefs } from '../types';
import { mockRemote, mockSession } from './mock';
import type { Remote, SharedHighlightRow } from './remote';
import { supabaseRemote, supabaseSignIn, supabaseSignOut, supabaseUserId, type SupabaseConfig } from './supabase';

export type CloudMode = 'local' | 'supabase' | 'mock';
export type SyncState = 'off' | 'syncing' | 'synced' | 'offline' | 'error';

export interface SyncStatus {
  state: SyncState;
  lastSynced?: number;
  message?: string;
}

let mode: CloudMode = 'local';
let config: SupabaseConfig | null = null;
let active: Remote | null = null;
let status: SyncStatus = { state: 'off' };
const listeners = new Set<(s: SyncStatus) => void>();
const changeListeners = new Set<() => void>();

const setStatus = (s: SyncStatus) => {
  status = s;
  listeners.forEach((l) => l(s));
};

export const cloudStatus = () => status;
export const cloudMode = () => mode;
export const cloudEnabled = () => mode !== 'local';

export function onCloudStatus(fn: (s: SyncStatus) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Fires after a sync brought in changes from another device. */
export function onCloudChanges(fn: () => void) {
  changeListeners.add(fn);
  return () => changeListeners.delete(fn);
}

export async function initCloud(): Promise<CloudMode> {
  try {
    const res = await fetch(new URL('config.json', document.baseURI).toString(), { cache: 'no-store' });
    const cfg = res.ok ? await res.json() : {};
    if (cfg.mock) mode = 'mock';
    else if (cfg.supabaseUrl && cfg.supabaseAnonKey) {
      mode = 'supabase';
      config = { supabaseUrl: String(cfg.supabaseUrl).replace(/\/$/, ''), supabaseAnonKey: cfg.supabaseAnonKey };
    }
  } catch {
    mode = 'local';
  }
  return mode;
}

export async function hasSession(profile: UserId): Promise<boolean> {
  if (mode === 'mock') return mockSession.has(profile);
  if (mode === 'supabase' && config) return !!(await supabaseUserId(config, profile));
  return true;
}

export async function signIn(profile: UserId, email: string, password: string) {
  if (mode === 'mock') return mockSession.signIn(profile, password);
  if (mode === 'supabase' && config) return supabaseSignIn(config, profile, email, password);
}

export async function signOut(profile: UserId) {
  if (active?.profile === profile) active = null;
  setStatus({ state: 'off' });
  if (mode === 'mock') return mockSession.signOut(profile);
  if (mode === 'supabase' && config) return supabaseSignOut(config, profile);
}

/** Make `profile` the reader whose data is synced. */
export async function activate(profile: UserId): Promise<boolean> {
  if (mode === 'local') return false;
  active = mode === 'mock' ? mockRemote(profile) : config ? await supabaseRemote(config, profile) : null;
  return !!active;
}

// ------------------------------------------------------------------ notes for each other

/**
 * Highlights the other reader shared on Our Shelf books.
 * On one device without cloud sync we can read their state directly;
 * with sync they arrive through the shared_highlights table.
 */
export async function partnerHighlights(me: UserId, bookId: string): Promise<PartnerHighlight[]> {
  const other = partnerOf(me);
  if (mode === 'local') {
    const st = await repo.getState(other, bookId);
    return (st.highlights ?? []).filter((h) => h.shared).map((h) => ({ ...h, bookId, author: other }));
  }
  const all = (await repo.getMeta<PartnerHighlight[]>(`partner-highlights:${me}`)) ?? [];
  return all.filter((h) => h.bookId === bookId);
}

// ------------------------------------------------------------------ tombstones

interface Tombstone {
  id: string;
  at: number;
  paths: string[];
}

export async function recordDeletion(book: Book) {
  if (!cloudEnabled()) return;
  const list = (await repo.getMeta<Tombstone[]>('tombstones')) ?? [];
  list.push({ id: book.id, at: Date.now(), paths: [book.remoteFile, book.remoteCover].filter(Boolean) as string[] });
  await repo.setMeta('tombstones', list);
}

// ------------------------------------------------------------------ files

const extOf = (b: Blob, fallback: string) => {
  const t = b.type;
  if (t.includes('epub')) return 'epub';
  if (t.includes('pdf')) return 'pdf';
  if (t.includes('png')) return 'png';
  if (t.includes('jpeg') || t.includes('jpg')) return 'jpg';
  if (t.includes('webp')) return 'webp';
  return fallback;
};

/** A local blob, downloading (and caching) it from the cloud if this device doesn't have it yet. */
export async function fetchBlob(key: string, remotePath?: string): Promise<Blob | undefined> {
  const local = await repo.getBlob(key);
  if (local || !remotePath || !active) return local;
  const blob = await active.download(remotePath);
  await repo.putBlob(key, blob);
  return blob;
}

// ------------------------------------------------------------------ sync

let running: Promise<boolean> | null = null;
let again = false;
let timer = 0;

/** Debounced background sync after a local change. */
export function requestSync(delay = 1500) {
  if (!active) return;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void sync(), delay);
}

/** Runs a full sync; returns true when changes arrived from the cloud. */
export function sync(): Promise<boolean> {
  if (!active) return Promise.resolve(false);
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    let changed = false;
    try {
      do {
        again = false;
        changed = (await syncOnce(active!)) || changed;
      } while (again && active);
      setStatus({ state: 'synced', lastSynced: Date.now() });
      if (changed) changeListeners.forEach((l) => l());
    } catch (e) {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      setStatus({ ...status, state: offline ? 'offline' : 'error', message: (e as Error).message });
    } finally {
      running = null;
    }
    return changed;
  })();
  return running;
}

const stamp = (x: { updatedAt?: number }) => x.updatedAt ?? 0;

async function syncOnce(remote: Remote): Promise<boolean> {
  const me = remote.profile;
  let changed = false;
  if (status.state !== 'synced') setStatus({ ...status, state: 'syncing' });

  // ---- deletions made on this device
  const tombs = (await repo.getMeta<Tombstone[]>('tombstones')) ?? [];
  if (tombs.length) {
    await remote.pushBooks(tombs.map((t) => ({ id: t.id, data: { id: t.id } as Book, shared: false, deleted: true, updated_at: t.at })));
    await remote.remove(tombs.flatMap((t) => t.paths)).catch(() => {});
    await repo.setMeta('tombstones', []);
  }

  // ---- books
  const remoteBooks = await remote.pullBooks();
  const remoteById = new Map(remoteBooks.map((b) => [b.id, b]));
  for (const rb of remoteBooks) {
    const lb = await repo.getBook(rb.id);
    if (rb.deleted) {
      if (lb && stamp(lb) <= rb.updated_at) {
        await repo.deleteBook(rb.id);
        changed = true;
      }
      continue;
    }
    if (!lb || stamp(lb) < rb.updated_at) {
      await repo.saveBook({ ...rb.data, updatedAt: rb.updated_at });
      changed = true;
    }
  }
  const pushBooks = [];
  for (let lb of await repo.listBooks()) {
    // Demo books sync their details too (they have no file), so sharing them works across devices.
    if (lb.ownerId !== me) continue;
    // First time this book reaches the cloud: upload its file and cover.
    if (!lb.remoteFile && lb.fileKey) {
      const blob = await repo.getBlob(lb.fileKey);
      if (blob) {
        const remoteFile = await remote.upload(`${lb.id}/book.${lb.format === 'pdf' ? 'pdf' : extOf(blob, lb.format)}`, blob);
        let remoteCover = lb.remoteCover;
        if (lb.cover.kind === 'image' && !remoteCover) {
          const cover = await repo.getBlob(lb.cover.blobKey);
          if (cover) remoteCover = await remote.upload(`${lb.id}/cover.${extOf(cover, 'jpg')}`, cover);
        }
        lb = { ...lb, remoteFile, remoteCover, updatedAt: Math.max(Date.now(), stamp(lb) + 1) };
        await repo.saveBook(lb);
      }
    }
    const rb = remoteById.get(lb.id);
    const at = stamp(lb) || lb.addedAt;
    if (!rb || at > rb.updated_at) pushBooks.push({ id: lb.id, data: lb, shared: lb.shared, deleted: false, updated_at: at });
  }
  await remote.pushBooks(pushBooks);

  // ---- this reader's progress, bookmarks, shelves
  const remoteStates = await remote.pullStates();
  const remoteStateByBook = new Map(remoteStates.map((s) => [s.bookId, s]));
  for (const rs of remoteStates) {
    const ls = await repo.getState(me, rs.bookId);
    if (stamp(ls) < stamp(rs)) {
      await repo.saveState({ ...rs, key: `${me}:${rs.bookId}`, userId: me });
      changed = true;
    }
  }
  const pushStates: UserBookState[] = [];
  for (const ls of await repo.listStates(me)) {
    const rs = remoteStateByBook.get(ls.bookId);
    // Untouched demo seeds have no timestamp and never overwrite real progress.
    if (stamp(ls) > 0 && (!rs || stamp(ls) > stamp(rs))) pushStates.push(ls);
  }
  await remote.pushStates(pushStates);

  // ---- this reader's preferences
  const rp = await remote.pullPrefs();
  const lp: UserPrefs = await repo.getPrefs(me);
  if (rp && stamp(rp) > stamp(lp)) {
    await repo.savePrefs({ ...lp, ...rp, userId: me });
    changed = true;
  } else if (stamp(lp) > 0 && (!rp || stamp(lp) > stamp(rp))) {
    await remote.pushPrefs(lp);
  }

  // ---- highlights shared on Our Shelf (notes for each other)
  const sharedRows = await remote.pullSharedHighlights();
  const mineRemote = new Map(sharedRows.filter((r) => r.author === me).map((r) => [r.id, r]));
  const books = new Map((await repo.listBooks()).map((b) => [b.id, b]));
  const wanted = new Map<string, SharedHighlightRow>();
  for (const st of await repo.listStates(me)) {
    if (!books.get(st.bookId)?.shared) continue;
    for (const h of st.highlights ?? []) {
      if (!h.shared) continue;
      const at = h.updatedAt ?? h.createdAt;
      wanted.set(h.id, { id: h.id, book_id: st.bookId, author: me, data: { ...h, bookId: st.bookId, author: me }, deleted: false, updated_at: at });
    }
  }
  const pushHl: SharedHighlightRow[] = [];
  for (const [id, row] of wanted) {
    const r = mineRemote.get(id);
    if (!r || r.deleted || r.updated_at < row.updated_at) pushHl.push(row);
  }
  for (const [id, r] of mineRemote) if (!r.deleted && !wanted.has(id)) pushHl.push({ ...r, deleted: true, updated_at: Date.now() });
  await remote.pushSharedHighlights(pushHl);
  const theirs = sharedRows.filter((r) => r.author !== me && !r.deleted).map((r) => r.data);
  const key = `partner-highlights:${me}`;
  if (JSON.stringify((await repo.getMeta(key)) ?? []) !== JSON.stringify(theirs)) {
    await repo.setMeta(key, theirs);
    changed = true;
  }

  return changed;
}
