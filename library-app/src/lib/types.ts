// Core domain types for Our Little Library.
// Everything that is persisted lives here so a future backend can mirror it 1:1.

export type UserId = 'aatish' | 'nishi';

export const USERS: { id: UserId; name: string }[] = [
  { id: 'aatish', name: 'Aatish' },
  { id: 'nishi', name: 'Nishi' },
];

export const userName = (id: UserId) => USERS.find((u) => u.id === id)?.name ?? id;
export const partnerOf = (id: UserId): UserId => (id === 'aatish' ? 'nishi' : 'aatish');

/** Formats the reader understands. Add a new importer + renderer to extend. */
export type BookFormat = 'epub' | 'pdf' | 'demo';

export type CoverMotif = 'moon' | 'wave' | 'leaf' | 'lamp' | 'star' | 'key' | 'feather' | 'cup';

export interface GeneratedCover {
  kind: 'generated';
  /** background, foreground/ink, accent */
  palette: [string, string, string];
  motif: CoverMotif;
}

export interface ImageCover {
  kind: 'image';
  /** key into the `blobs` object store */
  blobKey: string;
}

export type Cover = GeneratedCover | ImageCover;

export interface Book {
  id: string;
  ownerId: UserId;
  /** Shared books appear on "Our Shelf" for both readers. */
  shared: boolean;
  title: string;
  author: string;
  category?: string;
  description?: string;
  format: BookFormat;
  /** Real page count for PDFs; estimated for EPUB/demo once paginated. */
  pageCount?: number;
  fileSize?: number;
  addedAt: number;
  cover: Cover;
  isDemo?: boolean;
  /** key into the `blobs` store for the original file (epub/pdf) */
  fileKey?: string;
  /** cloud storage paths (set once uploaded) */
  remoteFile?: string;
  remoteCover?: string;
  /** last change, ms — newest wins when devices sync */
  updatedAt?: number;
}

/** A reading position that survives re-pagination (font size, screen size…). */
export interface ReadingPosition {
  /** section (chapter chunk) index, or page index for PDFs */
  section: number;
  /** 0..1 offset within the section */
  fraction: number;
}

export interface Bookmark {
  id: string;
  position: ReadingPosition;
  label: string;
  progress: number;
  createdAt: number;
}

export type ShelfStatus = 'none' | 'want' | 'reading' | 'finished';

/** Per-user, per-book state. Keyed `${userId}:${bookId}` — never shared between readers. */
export interface UserBookState {
  key: string;
  userId: UserId;
  bookId: string;
  status: ShelfStatus;
  favourite: boolean;
  position?: ReadingPosition;
  /** 0..1 */
  progress: number;
  /** human label of last position, e.g. "Chapter 7" */
  positionLabel?: string;
  bookmarks: Bookmark[];
  lastOpenedAt?: number;
  finishedAt?: number;
  /** last change, ms — newest wins when devices sync */
  updatedAt?: number;
}

export type ReaderTheme = 'day' | 'sepia' | 'night';
export type ReaderFont = 'literata' | 'garamond' | 'lora' | 'sans';
export type AmbientId = 'rain' | 'fireplace' | 'cafe' | 'forest' | 'ocean' | 'night' | 'library';

export interface UserPrefs {
  userId: UserId;
  theme: ReaderTheme;
  font: ReaderFont;
  /** px at the reference page size */
  fontSize: number;
  lineHeight: number;
  /** 0 = narrow column, 1 = balanced, 2 = wide */
  width: 0 | 1 | 2;
  /** 0.55..1 */
  brightness: number;
  pageSound: boolean;
  haptics: boolean;
  ambient: AmbientId;
  ambientVolume: number;
  showDemo: boolean;
  /** last change, ms — newest wins when devices sync */
  updatedAt?: number;
}

export const defaultPrefs = (userId: UserId): UserPrefs => ({
  userId,
  theme: 'day',
  font: 'literata',
  fontSize: 19,
  lineHeight: 1.6,
  width: 1,
  brightness: 1,
  pageSound: true,
  haptics: true,
  ambient: userId === 'nishi' ? 'rain' : 'fireplace',
  ambientVolume: 0.5,
  showDemo: true,
});

export const blankState = (userId: UserId, bookId: string): UserBookState => ({
  key: `${userId}:${bookId}`,
  userId,
  bookId,
  status: 'none',
  favourite: false,
  progress: 0,
  bookmarks: [],
});
