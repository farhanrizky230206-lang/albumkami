-- ============================================================
-- FARHAN & TIARA — Supabase setup
-- Run this entire file in Supabase Dashboard → SQL Editor.
-- Then create Farhan's user in Authentication → Users.
-- Finally run the LAST INSERT at the bottom with that user's UUID.
-- ============================================================

create extension if not exists pgcrypto;

-- 1) Tables ---------------------------------------------------

create table if not exists public.album_settings (
  id bigint primary key default 1,
  couple_name text not null default 'Farhan & Tiara',
  subtitle text,
  hero_text text,
  quote_text text,
  love_note text,
  start_date date,
  cover_url text,
  music_url text,
  song_label text,
  updated_at timestamptz not null default now(),
  constraint one_album_only check (id = 1)
);

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  file_path text not null unique,
  public_url text not null,
  file_type text not null check (file_type in ('image','video')),
  caption text,
  memory_date date,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.album_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Seed the one settings row.
insert into public.album_settings (
  id,
  couple_name,
  subtitle,
  hero_text,
  quote_text,
  love_note,
  song_label
)
values (
  1,
  'Farhan & Tiara',
  'Every picture keeps a version of us that time can never take away.',
  'This is our quiet corner of the internet — for blurry photos, loud laughs, ordinary afternoons, and everything that somehow became special because it was us.',
  'Maybe home was never a place. Maybe it was all the little moments where I found you.',
  'I hope we never stop collecting the small things: random photos, late-night talks, silly jokes, quiet rides, and days that look ordinary to everyone else but mean everything to us.',
  'Our song ♡'
)
on conflict (id) do nothing;

-- 2) Admin helper ---------------------------------------------
-- SECURITY DEFINER lets RLS policies check the private admin list
-- without exposing that table publicly.

create or replace function public.is_album_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.album_admins
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_album_admin() from public;
grant execute on function public.is_album_admin() to anon, authenticated;

-- 3) RLS ------------------------------------------------------

alter table public.album_settings enable row level security;
alter table public.memories enable row level security;
alter table public.album_admins enable row level security;

drop policy if exists "public can read album settings" on public.album_settings;
create policy "public can read album settings"
on public.album_settings
for select
to anon, authenticated
using (true);

drop policy if exists "admin can insert album settings" on public.album_settings;
create policy "admin can insert album settings"
on public.album_settings
for insert
to authenticated
with check (public.is_album_admin());

drop policy if exists "admin can update album settings" on public.album_settings;
create policy "admin can update album settings"
on public.album_settings
for update
to authenticated
using (public.is_album_admin())
with check (public.is_album_admin());

drop policy if exists "public can read memories" on public.memories;
create policy "public can read memories"
on public.memories
for select
to anon, authenticated
using (true);

drop policy if exists "admin can insert memories" on public.memories;
create policy "admin can insert memories"
on public.memories
for insert
to authenticated
with check (public.is_album_admin());

drop policy if exists "admin can update memories" on public.memories;
create policy "admin can update memories"
on public.memories
for update
to authenticated
using (public.is_album_admin())
with check (public.is_album_admin());

drop policy if exists "admin can delete memories" on public.memories;
create policy "admin can delete memories"
on public.memories
for delete
to authenticated
using (public.is_album_admin());

-- Explicit grants for Supabase Data API.
grant select on public.album_settings to anon, authenticated;
grant insert, update on public.album_settings to authenticated;

grant select on public.memories to anon, authenticated;
grant insert, update, delete on public.memories to authenticated;

-- Keep admin table hidden from normal client access.
revoke all on public.album_admins from anon, authenticated;

-- 4) Storage --------------------------------------------------
-- Public bucket means visitors can display media URLs.
insert into storage.buckets (id, name, public)
values ('album-media', 'album-media', true)
on conflict (id) do update set public = true;

drop policy if exists "public can view album media" on storage.objects;
create policy "public can view album media"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'album-media');

drop policy if exists "admin can upload album media" on storage.objects;
create policy "admin can upload album media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'album-media'
  and public.is_album_admin()
);

drop policy if exists "admin can update album media" on storage.objects;
create policy "admin can update album media"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'album-media'
  and public.is_album_admin()
)
with check (
  bucket_id = 'album-media'
  and public.is_album_admin()
);

drop policy if exists "admin can delete album media" on storage.objects;
create policy "admin can delete album media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'album-media'
  and public.is_album_admin()
);

-- ============================================================
-- 5) CREATE THE OWNER
-- ============================================================
-- A. Supabase Dashboard → Authentication → Users → Add user.
-- B. Make an email/password account for Farhan.
-- C. Copy that user's UUID.
-- D. Replace YOUR_FARHAN_USER_UUID below and run ONLY this insert:
--
-- insert into public.album_admins (user_id)
-- values ('YOUR_FARHAN_USER_UUID'::uuid)
-- on conflict (user_id) do nothing;
--
-- Do NOT put the UUID placeholder in quotes and run it unchanged.
-- ============================================================
