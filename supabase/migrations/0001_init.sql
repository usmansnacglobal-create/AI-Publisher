-- AI Publisher: complete database schema
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Profiles (one per user). Plan and role can only be changed by the server.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text default '',
  pen_name text default '',
  bio text default '',
  website text default '',
  twitter text default '',
  linkedin text default '',
  location text default '',
  language text default 'en',
  avatar_path text,
  notification_prefs jsonb not null default '{
    "ai_complete": true, "book_published": true, "review_ready": true,
    "token_warnings": true, "weekly_summary": false, "marketing": false,
    "billing": true, "in_app": true, "frequency": "realtime"
  }'::jsonb,
  webhook_url text,
  role text not null default 'author' check (role in ('author','admin')),
  plan text not null default 'free' check (plan in ('free','pro','agency')),
  plan_status text not null default 'active' check (plan_status in ('active','cancelled','past_due','suspended')),
  paypal_subscription_id text,
  current_period_start timestamptz not null default date_trunc('month', now()),
  current_period_end timestamptz not null default (date_trunc('month', now()) + interval '1 month'),
  warned_80_at timestamptz,
  warned_100_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- ---------------------------------------------------------------------------
-- Books and chapters
-- ---------------------------------------------------------------------------
create table public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  subtitle text default '',
  book_type text not null default 'fiction' check (book_type in ('fiction','nonfiction')),
  genre text default '',
  audience text default '',
  style text default '',
  tone text default '',
  summary text default '',
  target_words int not null default 50000 check (target_words between 500 and 500000),
  target_chapters int not null default 12 check (target_chapters between 1 and 200),
  status text not null default 'draft' check (status in ('draft','in_review','published')),
  trim_size text not null default '6x9',
  paper text not null default 'white' check (paper in ('white','cream')),
  page_count int,
  blurb text default '',
  keywords text[] default '{}',
  categories text[] default '{}',
  author_bio text default '',
  dedication text default '',
  copyright_holder text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.books (user_id);
create trigger books_touch before update on public.books for each row execute function public.touch_updated_at();

-- Plan book limits are enforced in the database, so they can't be bypassed.
create or replace function public.enforce_book_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare p text; n int; lim int;
begin
  select plan into p from public.profiles where id = new.user_id;
  lim := case p when 'free' then 1 when 'pro' then 10 else null end;
  if lim is not null then
    select count(*) into n from public.books where user_id = new.user_id;
    if n >= lim then
      raise exception 'BOOK_LIMIT:%:%', p, lim;
    end if;
  end if;
  return new;
end $$;
create trigger books_limit before insert on public.books for each row execute function public.enforce_book_limit();

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position int not null,
  title text not null default '',
  synopsis text default '',
  content text not null default '',
  word_count int not null default 0,
  status text not null default 'planned' check (status in ('planned','drafted')),
  generated_at timestamptz,
  updated_at timestamptz not null default now()
);
create index on public.chapters (book_id, position);
create trigger chapters_touch before update on public.chapters for each row execute function public.touch_updated_at();

create table public.chapter_versions (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  word_count int not null default 0,
  label text not null default 'Autosave',
  created_at timestamptz not null default now()
);
create index on public.chapter_versions (chapter_id, created_at desc);

-- AI edit suggestions shown as tracked changes the author accepts or rejects.
create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'edit',
  original text not null,
  replacement text not null,
  reason text default '',
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now()
);
create index on public.suggestions (chapter_id, status);

-- Story bible: characters, places, items, events and world rules.
create table public.bible_entries (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'character' check (kind in ('character','place','item','event','rule')),
  name text not null,
  details text not null default '',
  created_at timestamptz not null default now()
);
create index on public.bible_entries (book_id);

-- Proofreading and continuity reports.
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  chapter_id uuid references public.chapters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('proofread','continuity')),
  result jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.reports (book_id, kind, created_at desc);

-- ---------------------------------------------------------------------------
-- Covers and publishing
-- ---------------------------------------------------------------------------
create table public.covers (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null unique references public.books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  brief jsonb not null default '{}'::jsonb,
  concepts jsonb not null default '[]'::jsonb,
  selected_path text,
  design jsonb not null default '{}'::jsonb,
  front_path text,
  wrap_path text,
  updated_at timestamptz not null default now()
);
create trigger covers_touch before update on public.covers for each row execute function public.touch_updated_at();

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  platforms text[] not null default '{}',
  formats text[] not null default '{}',
  price numeric(10,2),
  status text not null default 'submitted'
    check (status in ('submitted','in_review','changes_requested','formatting','publishing','live')),
  isbn text,
  reviewer_notes text default '',
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.submissions (book_id);
create trigger submissions_touch before update on public.submissions for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Usage, billing, activity and notifications (written by the server only)
-- ---------------------------------------------------------------------------
create table public.token_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid references public.books(id) on delete set null,
  feature text not null,
  provider text not null check (provider in ('anthropic','openai')),
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  total_tokens int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.token_usage (user_id, created_at);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  paypal_id text unique,
  description text default '',
  amount numeric(10,2) not null,
  currency text not null default 'USD',
  status text not null default 'completed',
  created_at timestamptz not null default now()
);

create table public.activity_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.activity_logs (user_id, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null default 'system' check (category in ('books','ai','billing','system')),
  title text not null,
  body text default '',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row-level security: every author sees and changes only their own data.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.chapters enable row level security;
alter table public.chapter_versions enable row level security;
alter table public.suggestions enable row level security;
alter table public.bible_entries enable row level security;
alter table public.reports enable row level security;
alter table public.covers enable row level security;
alter table public.submissions enable row level security;
alter table public.token_usage enable row level security;
alter table public.payments enable row level security;
alter table public.activity_logs enable row level security;
alter table public.notifications enable row level security;

create policy "own profile read" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "own profile update" on public.profiles for update using (id = auth.uid());
-- Authors may only edit these profile columns (never plan, role or billing fields).
revoke update on public.profiles from authenticated, anon;
grant update (full_name, pen_name, bio, website, twitter, linkedin, location, language,
              avatar_path, notification_prefs, webhook_url) on public.profiles to authenticated;

do $$
declare t text;
begin
  foreach t in array array['books','chapters','chapter_versions','suggestions','bible_entries','reports','covers'] loop
    execute format('create policy "own rows" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
create policy "admin read books" on public.books for select using (public.is_admin());
create policy "admin read chapters" on public.chapters for select using (public.is_admin());
create policy "admin read covers" on public.covers for select using (public.is_admin());

create policy "own submissions read" on public.submissions for select using (user_id = auth.uid() or public.is_admin());
create policy "own submissions insert" on public.submissions for insert with check (user_id = auth.uid() and status = 'submitted');
create policy "admin submissions update" on public.submissions for update using (public.is_admin());

create policy "own usage read" on public.token_usage for select using (user_id = auth.uid());
create policy "own payments read" on public.payments for select using (user_id = auth.uid());
create policy "own activity read" on public.activity_logs for select using (user_id = auth.uid());
create policy "own notifications read" on public.notifications for select using (user_id = auth.uid());
create policy "own notifications update" on public.notifications for update using (user_id = auth.uid());
create policy "own notifications delete" on public.notifications for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Private file storage. Files live under "<user id>/..." and only the owner
-- (or the server) can read them; the app shows them through short-lived links.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values
  ('covers','covers',false), ('manuscripts','manuscripts',false),
  ('exports','exports',false), ('avatars','avatars',false)
on conflict (id) do update set public = false;

create policy "owner files read" on storage.objects for select
  using (bucket_id in ('covers','manuscripts','exports','avatars') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner files write" on storage.objects for insert
  with check (bucket_id in ('covers','manuscripts','exports','avatars') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner files update" on storage.objects for update
  using (bucket_id in ('covers','manuscripts','exports','avatars') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner files delete" on storage.objects for delete
  using (bucket_id in ('covers','manuscripts','exports','avatars') and (storage.foldername(name))[1] = auth.uid()::text);
