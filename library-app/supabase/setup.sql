-- Our Little Library — cloud setup for Supabase.
-- Paste this whole file into Supabase → SQL Editor → New query → Run. Safe to run again.

-- Which account is Aatish and which is Nishi (claimed on first sign-in).
create table if not exists public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  profile text not null unique check (profile in ('aatish', 'nishi'))
);

-- Books. `data` holds the book's details; the file itself lives in Storage.
create table if not exists public.books (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  data jsonb not null,
  shared boolean not null default false,
  deleted boolean not null default false,
  updated_at bigint not null
);

-- Each reader's own progress, bookmarks and shelves for each book.
create table if not exists public.book_states (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  book_id text not null,
  data jsonb not null,
  updated_at bigint not null,
  primary key (user_id, book_id)
);

-- Each reader's theme, fonts, sounds…
create table if not exists public.prefs (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  data jsonb not null,
  updated_at bigint not null
);

alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.book_states enable row level security;
alter table public.prefs enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
drop policy if exists "profiles: claim own" on public.profiles;
create policy "profiles: read own" on public.profiles for select to authenticated using (user_id = auth.uid());
create policy "profiles: claim own" on public.profiles for insert to authenticated with check (user_id = auth.uid());

-- You see your own books and anything on Our Shelf; only the owner can change a book.
drop policy if exists "books: read own or shared" on public.books;
drop policy if exists "books: insert own" on public.books;
drop policy if exists "books: update own" on public.books;
create policy "books: read own or shared" on public.books for select to authenticated using (owner_id = auth.uid() or shared);
create policy "books: insert own" on public.books for insert to authenticated with check (owner_id = auth.uid());
create policy "books: update own" on public.books for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Reading progress is strictly personal.
drop policy if exists "states: own only" on public.book_states;
create policy "states: own only" on public.book_states for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "prefs: own only" on public.prefs;
create policy "prefs: own only" on public.prefs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Private bucket for book files and covers: <user id>/<book id>/book.epub
insert into storage.buckets (id, name, public, file_size_limit)
values ('books', 'books', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

drop policy if exists "files: owner writes" on storage.objects;
drop policy if exists "files: owner updates" on storage.objects;
drop policy if exists "files: owner deletes" on storage.objects;
drop policy if exists "files: read own or shared" on storage.objects;
create policy "files: owner writes" on storage.objects for insert to authenticated
  with check (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "files: owner updates" on storage.objects for update to authenticated
  using (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "files: owner deletes" on storage.objects for delete to authenticated
  using (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text);
-- Read your own files, plus files of books on Our Shelf.
create policy "files: read own or shared" on storage.objects for select to authenticated
  using (
    bucket_id = 'books' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.books b
        where b.shared and not b.deleted
          and (storage.objects.name = b.data->>'remoteFile' or storage.objects.name = b.data->>'remoteCover')
      )
    )
  );
