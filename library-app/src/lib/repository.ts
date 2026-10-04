// The repository is the local store: IndexedDB on this device.
// It is always the source the UI reads from, so the library works offline and
// opens instantly. When cloud sync is configured (see ./cloud), the sync engine
// reconciles this store with Supabase so every device sees the same library.

import { idb } from './db';
import { blankState, defaultPrefs, type Book, type UserBookState, type UserId, type UserPrefs } from './types';

export interface LibraryRepository {
  listBooks(): Promise<Book[]>;
  getBook(id: string): Promise<Book | undefined>;
  saveBook(book: Book): Promise<void>;
  deleteBook(id: string): Promise<void>;

  listStates(userId: UserId): Promise<UserBookState[]>;
  getState(userId: UserId, bookId: string): Promise<UserBookState>;
  saveState(state: UserBookState): Promise<void>;

  getPrefs(userId: UserId): Promise<UserPrefs>;
  savePrefs(prefs: UserPrefs): Promise<void>;

  putBlob(key: string, blob: Blob): Promise<void>;
  getBlob(key: string): Promise<Blob | undefined>;
  deleteBlob(key: string): Promise<void>;

  getMeta<T>(key: string): Promise<T | undefined>;
  setMeta(key: string, value: unknown): Promise<void>;
}

class IndexedDbRepository implements LibraryRepository {
  listBooks() {
    return idb.getAll<Book>('books');
  }
  getBook(id: string) {
    return idb.get<Book>('books', id);
  }
  saveBook(book: Book) {
    return idb.put('books', book);
  }
  async deleteBook(id: string) {
    const book = await idb.get<Book>('books', id);
    if (book?.fileKey) await idb.delete('blobs', book.fileKey);
    if (book?.cover.kind === 'image') await idb.delete('blobs', book.cover.blobKey);
    await idb.delete('books', id);
    for (const u of ['aatish', 'nishi'] as UserId[]) await idb.delete('states', `${u}:${id}`);
  }

  listStates(userId: UserId) {
    return idb.getAllByIndex<UserBookState>('states', 'userId', userId);
  }
  async getState(userId: UserId, bookId: string) {
    return (await idb.get<UserBookState>('states', `${userId}:${bookId}`)) ?? blankState(userId, bookId);
  }
  saveState(state: UserBookState) {
    // Guard: the key always encodes the owner, so one reader can never overwrite the other's progress.
    if (state.key !== `${state.userId}:${state.bookId}`) throw new Error('State key does not match its owner.');
    return idb.put('states', state);
  }

  async getPrefs(userId: UserId) {
    const saved = await idb.get<UserPrefs>('prefs', userId);
    return { ...defaultPrefs(userId), ...saved, userId };
  }
  savePrefs(prefs: UserPrefs) {
    return idb.put('prefs', prefs);
  }

  putBlob(key: string, blob: Blob) {
    return idb.put('blobs', blob, key);
  }
  getBlob(key: string) {
    return idb.get<Blob>('blobs', key);
  }
  deleteBlob(key: string) {
    return idb.delete('blobs', key);
  }

  getMeta<T>(key: string) {
    return idb.get<T>('meta', key);
  }
  setMeta(key: string, value: unknown) {
    return idb.put('meta', value, key);
  }
}

export const repository: LibraryRepository = new IndexedDbRepository();

export const uid = (prefix = '') =>
  prefix + (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36));
