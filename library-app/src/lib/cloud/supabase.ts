// Supabase backend: Postgres tables protected by row-level security, a private
// Storage bucket for book files, and email + password sign-in.
// Table and policy definitions live in library-app/supabase/setup.sql.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserBookState, UserId, UserPrefs } from '../types';
import type { Remote, RemoteBook } from './remote';

export interface SupabaseConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

const BUCKET = 'books';
const clients = new Map<UserId, Promise<SupabaseClient>>();

/**
 * One client per reader, each with its own saved session, so Aatish and Nishi
 * can both stay signed in on a shared iPad and switch without retyping passwords.
 */
export function clientFor(cfg: SupabaseConfig, profile: UserId) {
  if (!clients.has(profile)) {
    clients.set(
      profile,
      import('@supabase/supabase-js').then(({ createClient }) =>
        createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
          auth: { storageKey: `oll-auth-${profile}`, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
        }),
      ),
    );
  }
  return clients.get(profile)!;
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export async function supabaseUserId(cfg: SupabaseConfig, profile: UserId): Promise<string | null> {
  const sb = await clientFor(cfg, profile);
  const { data } = await sb.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function supabaseSignIn(cfg: SupabaseConfig, profile: UserId, email: string, password: string) {
  const sb = await clientFor(cfg, profile);
  const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data.user) {
    throw new Error(/invalid login/i.test(error?.message ?? '') ? 'That email and password don’t match.' : error?.message ?? 'Could not sign in.');
  }
  // Each account belongs to exactly one profile. The first sign-in claims it.
  const uid = data.user.id;
  const mine = check(await sb.from('profiles').select('profile').eq('user_id', uid).maybeSingle());
  if (mine && mine.profile !== profile) {
    await sb.auth.signOut();
    throw new Error(`That account belongs to ${mine.profile === 'aatish' ? 'Aatish' : 'Nishi'}.`);
  }
  if (!mine) {
    const { error: claimError } = await sb.from('profiles').insert({ user_id: uid, profile });
    if (claimError) {
      await sb.auth.signOut();
      throw new Error(/duplicate|unique/i.test(claimError.message) ? 'This profile is already linked to a different account.' : claimError.message);
    }
  }
}

export async function supabaseSignOut(cfg: SupabaseConfig, profile: UserId) {
  const sb = await clientFor(cfg, profile);
  await sb.auth.signOut();
}

export async function supabaseRemote(cfg: SupabaseConfig, profile: UserId): Promise<Remote | null> {
  const sb = await clientFor(cfg, profile);
  const uid = await supabaseUserId(cfg, profile);
  if (!uid) return null;

  return {
    profile,
    async pullBooks() {
      return check(await sb.from('books').select('id, data, shared, deleted, updated_at')) as RemoteBook[];
    },
    async pushBooks(rows) {
      if (!rows.length) return;
      check(await sb.from('books').upsert(rows.map((r) => ({ ...r, owner_id: uid }))));
    },
    async pullStates() {
      const rows = check(await sb.from('book_states').select('data, updated_at').eq('user_id', uid)) as { data: UserBookState; updated_at: number }[];
      return rows.map((r) => ({ ...r.data, updatedAt: r.updated_at }));
    },
    async pushStates(states) {
      if (!states.length) return;
      check(await sb.from('book_states').upsert(states.map((s) => ({ user_id: uid, book_id: s.bookId, data: s, updated_at: s.updatedAt ?? 0 }))));
    },
    async pullPrefs() {
      const row = check(await sb.from('prefs').select('data, updated_at').eq('user_id', uid).maybeSingle()) as { data: UserPrefs; updated_at: number } | null;
      return row ? { ...row.data, updatedAt: row.updated_at } : null;
    },
    async pushPrefs(prefs) {
      check(await sb.from('prefs').upsert({ user_id: uid, data: prefs, updated_at: prefs.updatedAt ?? 0 }));
    },
    async upload(name, blob) {
      const path = `${uid}/${name}`;
      check(await sb.storage.from(BUCKET).upload(path, blob, { upsert: true, contentType: blob.type || 'application/octet-stream' }));
      return path;
    },
    async download(path) {
      return check(await sb.storage.from(BUCKET).download(path)) as Blob;
    },
    async remove(paths) {
      if (paths.length) check(await sb.storage.from(BUCKET).remove(paths));
    },
  };
}
