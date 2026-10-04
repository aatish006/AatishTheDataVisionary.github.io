// A pretend cloud kept in localStorage, used only by automated tests
// (enabled with "mock": true in config.json). Lets two "devices" be simulated
// by wiping IndexedDB while this shared store survives.

import type { UserBookState, UserId, UserPrefs } from '../types';
import type { Remote, RemoteBook, SharedHighlightRow } from './remote';

const KEY = 'oll-mock-cloud';

interface Store {
  books: Record<string, RemoteBook & { owner: UserId }>;
  states: Record<string, UserBookState>;
  prefs: Record<string, UserPrefs>;
  files: Record<string, string>;
  sessions: UserId[];
  highlights?: Record<string, SharedHighlightRow>;
}

const load = (): Store => {
  try {
    return { books: {}, states: {}, prefs: {}, files: {}, sessions: [], ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { books: {}, states: {}, prefs: {}, files: {}, sessions: [] };
  }
};
const save = (s: Store) => localStorage.setItem(KEY, JSON.stringify(s));

const toDataUrl = (blob: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });

export const mockSession = {
  has: (p: UserId) => load().sessions.includes(p),
  signIn(p: UserId, password: string) {
    if (password !== 'reading') throw new Error('That email and password don’t match.');
    const s = load();
    if (!s.sessions.includes(p)) s.sessions.push(p);
    save(s);
  },
  signOut(p: UserId) {
    const s = load();
    s.sessions = s.sessions.filter((x) => x !== p);
    save(s);
  },
};

export function mockRemote(profile: UserId): Remote {
  return {
    profile,
    async pullBooks() {
      return Object.values(load().books).filter((b) => b.owner === profile || b.shared);
    },
    async pushBooks(rows) {
      const s = load();
      for (const r of rows) s.books[r.id] = { ...r, owner: profile };
      save(s);
    },
    async pullStates() {
      return Object.values(load().states).filter((x) => x.userId === profile);
    },
    async pushStates(states) {
      const s = load();
      for (const st of states) s.states[st.key] = st;
      save(s);
    },
    async pullPrefs() {
      return load().prefs[profile] ?? null;
    },
    async pushPrefs(p) {
      const s = load();
      s.prefs[profile] = p;
      save(s);
    },
    async pullSharedHighlights() {
      const s = load();
      return Object.values(s.highlights ?? {}).filter((h) => h.author === profile || s.books[h.book_id]?.shared);
    },
    async pushSharedHighlights(rows) {
      const s = load();
      s.highlights ??= {};
      for (const r of rows) s.highlights[r.id] = r;
      save(s);
    },
    async upload(name, blob) {
      // Tests can simulate a failing upload.
      if (localStorage.getItem('oll-mock-fail-upload')) throw new Error('new row violates row-level security policy');
      const s = load();
      const path = `${profile}/${name}`;
      s.files[path] = await toDataUrl(blob);
      save(s);
      return path;
    },
    async download(path) {
      const url = load().files[path];
      if (!url) throw new Error('File not found in the cloud.');
      return (await fetch(url)).blob();
    },
    async remove(paths) {
      const s = load();
      for (const p of paths) delete s.files[p];
      save(s);
    },
  };
}
