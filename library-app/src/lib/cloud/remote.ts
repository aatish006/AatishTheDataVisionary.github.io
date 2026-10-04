// What the sync engine needs from a cloud backend. One instance per signed-in reader.

import type { Book, UserBookState, UserId, UserPrefs } from '../types';

export interface RemoteBook {
  id: string;
  data: Book;
  shared: boolean;
  deleted: boolean;
  updated_at: number;
}

export interface Remote {
  profile: UserId;
  /** every book this reader may see: their own plus shared ones (incl. tombstones) */
  pullBooks(): Promise<RemoteBook[]>;
  /** only ever called with books this reader owns */
  pushBooks(rows: RemoteBook[]): Promise<void>;
  pullStates(): Promise<UserBookState[]>;
  pushStates(states: UserBookState[]): Promise<void>;
  pullPrefs(): Promise<UserPrefs | null>;
  pushPrefs(prefs: UserPrefs): Promise<void>;
  /** stores a file under this reader's private folder; returns its path */
  upload(name: string, blob: Blob): Promise<string>;
  download(path: string): Promise<Blob>;
  remove(paths: string[]): Promise<void>;
}
