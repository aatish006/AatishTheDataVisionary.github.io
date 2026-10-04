// What the sync engine needs from a cloud backend. One instance per signed-in reader.

import type { Book, PartnerHighlight, UserBookState, UserId, UserPrefs } from '../types';

export interface RemoteBook {
  id: string;
  data: Book;
  shared: boolean;
  deleted: boolean;
  updated_at: number;
}

/** A highlight one reader chose to share on an Our Shelf book. */
export interface SharedHighlightRow {
  id: string;
  book_id: string;
  author: UserId;
  data: PartnerHighlight;
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
  /** shared highlights on books this reader can see (both authors) */
  pullSharedHighlights(): Promise<SharedHighlightRow[]>;
  /** only ever called with this reader's own highlights */
  pushSharedHighlights(rows: SharedHighlightRow[]): Promise<void>;
  /** stores a file under this reader's private folder; returns its path */
  upload(name: string, blob: Blob): Promise<string>;
  download(path: string): Promise<Blob>;
  remove(paths: string[]): Promise<void>;
}
