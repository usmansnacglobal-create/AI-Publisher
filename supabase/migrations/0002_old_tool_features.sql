-- AI Publisher update 2: features from the old tool.
-- Run once in Supabase: SQL Editor → New query → paste → Run. Safe to run again.

-- Book wizard, writing sample, layout and publishing details
alter table public.books
  add column if not exists author_name text default '',
  add column if not exists reader_outcome text default '',
  add column if not exists key_message text default '',
  add column if not exists pov text default '',
  add column if not exists pacing text default '',
  add column if not exists themes text[] default '{}',
  add column if not exists dialect text default 'US English',
  add column if not exists writing_mode text default 'assist' check (writing_mode in ('full','assist','outline')),
  add column if not exists writing_sample text default '',
  add column if not exists layout jsonb not null default '{}'::jsonb,
  add column if not exists layout_approved_at timestamptz,
  add column if not exists content_updated_at timestamptz not null default now(),
  add column if not exists language text default 'English',
  add column if not exists edition text default 'First Edition';

-- Per-chapter AI controls and notes from the publishing team
alter table public.chapters
  add column if not exists settings jsonb not null default '{}'::jsonb,
  add column if not exists admin_note text default '';

-- Track when chapter text last changed, so an approved layout can show as outdated.
create or replace function public.touch_book_content() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'DELETE') then
    update public.books set content_updated_at = now() where id = old.book_id;
    return old;
  end if;
  if (tg_op = 'INSERT' or new.content is distinct from old.content or new.title is distinct from old.title or new.position is distinct from old.position) then
    update public.books set content_updated_at = now() where id = new.book_id;
  end if;
  return new;
end $$;
drop trigger if exists chapters_content_touch on public.chapters;
create trigger chapters_content_touch after insert or update or delete on public.chapters
  for each row execute function public.touch_book_content();

-- Authors can't write the publishing team's notes on their chapters.
create or replace function public.protect_admin_note() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.admin_note is distinct from old.admin_note and not public.is_admin() and current_user <> 'service_role' and auth.uid() is not null then
    new.admin_note := old.admin_note;
  end if;
  return new;
end $$;
drop trigger if exists chapters_protect_note on public.chapters;
create trigger chapters_protect_note before update on public.chapters
  for each row execute function public.protect_admin_note();

-- Covers: generation counter and saved versions
alter table public.covers
  add column if not exists generations int not null default 0,
  add column if not exists social_path text;

create table if not exists public.cover_versions (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Version',
  status text not null default 'draft' check (status in ('draft','final')),
  brief jsonb not null default '{}'::jsonb,
  design jsonb not null default '{}'::jsonb,
  selected_path text,
  pages int,
  trim_size text,
  paper text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cover_versions_book on public.cover_versions (book_id, created_at desc);
alter table public.cover_versions enable row level security;
drop policy if exists "own rows" on public.cover_versions;
create policy "own rows" on public.cover_versions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop trigger if exists cover_versions_touch on public.cover_versions;
create trigger cover_versions_touch before update on public.cover_versions for each row execute function public.touch_updated_at();

-- Publishing: more details and statuses
alter table public.submissions
  add column if not exists language text default 'English',
  add column if not exists edition text default 'First Edition',
  add column if not exists category text default '',
  add column if not exists print_price numeric(10,2),
  add column if not exists publish_at timestamptz,
  add column if not exists narration_voice text;
alter table public.submissions drop constraint if exists submissions_status_check;
alter table public.submissions add constraint submissions_status_check
  check (status in ('submitted','in_review','changes_requested','formatting','publishing','live','rejected','failed'));

-- Audiobooks
create table if not exists public.audiobooks (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null unique references public.books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  voice text not null default 'american_female',
  tracks jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.audiobooks enable row level security;
drop policy if exists "own rows" on public.audiobooks;
create policy "own rows" on public.audiobooks for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "admin read audiobooks" on public.audiobooks;
create policy "admin read audiobooks" on public.audiobooks for select using (public.is_admin());
drop trigger if exists audiobooks_touch on public.audiobooks;
create trigger audiobooks_touch before update on public.audiobooks for each row execute function public.touch_updated_at();

insert into storage.buckets (id, name, public) values ('audio','audio',false)
on conflict (id) do update set public = false;

drop policy if exists "owner files read" on storage.objects;
drop policy if exists "owner files write" on storage.objects;
drop policy if exists "owner files update" on storage.objects;
drop policy if exists "owner files delete" on storage.objects;
create policy "owner files read" on storage.objects for select
  using (bucket_id in ('covers','manuscripts','exports','avatars','audio') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner files write" on storage.objects for insert
  with check (bucket_id in ('covers','manuscripts','exports','avatars','audio') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner files update" on storage.objects for update
  using (bucket_id in ('covers','manuscripts','exports','avatars','audio') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner files delete" on storage.objects for delete
  using (bucket_id in ('covers','manuscripts','exports','avatars','audio') and (storage.foldername(name))[1] = auth.uid()::text);
