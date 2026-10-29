-- Premium narration (ElevenLabs), narration credits, Stripe, and GBP/USD pricing.
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- Billing: which currency and payment service each author uses
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists currency text not null default 'USD',
  add column if not exists billing_provider text,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;
alter table public.profiles drop constraint if exists profiles_currency_check;
alter table public.profiles add constraint profiles_currency_check check (currency in ('USD','GBP'));
alter table public.profiles drop constraint if exists profiles_billing_provider_check;
alter table public.profiles add constraint profiles_billing_provider_check check (billing_provider is null or billing_provider in ('paypal','stripe'));
create unique index if not exists profiles_stripe_customer_idx on public.profiles (stripe_customer_id) where stripe_customer_id is not null;
create unique index if not exists profiles_stripe_subscription_idx on public.profiles (stripe_subscription_id) where stripe_subscription_id is not null;

-- Payments now come from PayPal or Stripe.
alter table public.payments
  add column if not exists provider text not null default 'paypal',
  add column if not exists external_id text,
  add column if not exists kind text not null default 'plan';
-- A full unique index (empty ids are allowed many times) so payments can be saved once per id.
create unique index if not exists payments_external_idx on public.payments (provider, external_id);

-- Prices created in Stripe and PayPal for each plan, add-on and top-up, per currency.
-- Filled by Admin → Billing setup; the site reads it to start a checkout.
create table if not exists public.billing_catalog (
  provider text not null check (provider in ('paypal','stripe')),
  item text not null,
  currency text not null check (currency in ('USD','GBP')),
  amount numeric(10,2) not null,
  external_id text not null,
  created_at timestamptz not null default now(),
  primary key (provider, item, currency)
);
alter table public.billing_catalog enable row level security;
drop policy if exists "admin reads catalog" on public.billing_catalog;
create policy "admin reads catalog" on public.billing_catalog for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Narration add-on: one row per author
-- ---------------------------------------------------------------------------
create table if not exists public.narration_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text check (tier is null or tier in ('starter','author','pro')),
  status text not null default 'none' check (status in ('none','active','cancelled','past_due')),
  provider text check (provider is null or provider in ('paypal','stripe')),
  provider_subscription_id text,
  currency text check (currency is null or currency in ('USD','GBP')),
  period_start timestamptz,
  period_end timestamptz,
  -- Credits bought as top-ups. They don't expire.
  topup_credits int not null default 0 check (topup_credits >= 0),
  warned_80_at timestamptz,
  warned_100_at timestamptz,
  updated_at timestamptz not null default now()
);
create unique index if not exists narration_accounts_sub_idx on public.narration_accounts (provider_subscription_id) where provider_subscription_id is not null;
alter table public.narration_accounts enable row level security;
drop policy if exists "own narration account" on public.narration_accounts;
create policy "own narration account" on public.narration_accounts for select using (user_id = auth.uid() or public.is_admin());
drop trigger if exists narration_accounts_touch on public.narration_accounts;
create trigger narration_accounts_touch before update on public.narration_accounts for each row execute function public.touch_updated_at();

-- Every narration job: what it cost the author in credits and what it cost us at ElevenLabs.
create table if not exists public.narration_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid references public.books(id) on delete set null,
  chapter_id uuid references public.chapters(id) on delete set null,
  model text not null,
  quality text not null check (quality in ('turbo','standard')),
  chars int not null,
  credits int not null check (credits >= 0),
  from_allowance int not null default 0,
  from_topup int not null default 0,
  cost_usd numeric(10,4) not null default 0,
  status text not null default 'reserved' check (status in ('reserved','charged','refunded')),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
create index if not exists narration_usage_user_idx on public.narration_usage (user_id, created_at desc);
alter table public.narration_usage enable row level security;
drop policy if exists "own narration usage" on public.narration_usage;
create policy "own narration usage" on public.narration_usage for select using (user_id = auth.uid() or public.is_admin());

-- Top-up purchases. The unique payment id stops a payment adding credits twice.
create table if not exists public.narration_topups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('paypal','stripe')),
  external_id text not null,
  credits int not null check (credits > 0),
  amount numeric(10,2) not null,
  currency text not null,
  created_at timestamptz not null default now(),
  unique (provider, external_id)
);
alter table public.narration_topups enable row level security;
drop policy if exists "own topups" on public.narration_topups;
create policy "own topups" on public.narration_topups for select using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- ElevenLabs voice library, cached and refreshed daily
-- ---------------------------------------------------------------------------
create table if not exists public.elevenlabs_voices (
  voice_id text primary key,
  public_owner_id text not null,
  name text not null,
  description text not null default '',
  category text not null default '',
  use_case text not null default '',
  gender text not null default '',
  age text not null default '',
  accent text not null default '',
  language text not null default '',
  descriptive text not null default '',
  preview_url text,
  featured boolean not null default false,
  usage_1y bigint not null default 0,
  -- Set once the voice has been added to our ElevenLabs account for narration.
  account_voice_id text,
  active boolean not null default true,
  fetched_at timestamptz not null default now()
);
create index if not exists elevenlabs_voices_browse_idx on public.elevenlabs_voices (active, use_case, usage_1y desc);
alter table public.elevenlabs_voices enable row level security;
drop policy if exists "signed in reads voices" on public.elevenlabs_voices;
create policy "signed in reads voices" on public.elevenlabs_voices for select using (auth.uid() is not null);

-- The audiobook remembers which narrator and quality it uses.
alter table public.audiobooks
  add column if not exists engine text not null default 'basic',
  add column if not exists premium_voice_id text,
  add column if not exists premium_voice_name text,
  add column if not exists quality text not null default 'turbo';
alter table public.audiobooks drop constraint if exists audiobooks_engine_check;
alter table public.audiobooks add constraint audiobooks_engine_check check (engine in ('basic','premium'));
alter table public.audiobooks drop constraint if exists audiobooks_quality_check;
alter table public.audiobooks add constraint audiobooks_quality_check check (quality in ('turbo','standard'));

-- ---------------------------------------------------------------------------
-- Credit accounting. These run on the server only, inside one transaction,
-- so two narrations started at once can never spend the same credits.
-- ---------------------------------------------------------------------------

-- Reserves credits for a narration. Spends this period's allowance first, then top-ups.
-- Returns the reservation id, or raises NARRATION_CREDITS:<available> if there aren't enough.
create or replace function public.narration_reserve(
  p_user uuid, p_credits int, p_allowance int, p_period_start timestamptz,
  p_book uuid, p_chapter uuid, p_model text, p_quality text, p_chars int, p_cost numeric
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  acct public.narration_accounts;
  used int;
  avail int;
  from_a int;
  from_t int;
  rid uuid;
begin
  insert into public.narration_accounts (user_id) values (p_user) on conflict (user_id) do nothing;
  select * into acct from public.narration_accounts where user_id = p_user for update;

  -- A narration that never finished (for example the server timed out) gives its credits back.
  update public.narration_accounts a set topup_credits = a.topup_credits + s.t
    from (select coalesce(sum(from_topup), 0)::int t from public.narration_usage
          where user_id = p_user and status = 'reserved' and created_at < now() - interval '15 minutes') s
    where a.user_id = p_user and s.t > 0;
  update public.narration_usage set status = 'refunded', settled_at = now()
    where user_id = p_user and status = 'reserved' and created_at < now() - interval '15 minutes';
  select * into acct from public.narration_accounts where user_id = p_user;

  select coalesce(sum(from_allowance), 0)::int into used from public.narration_usage
    where user_id = p_user and status in ('reserved','charged') and created_at >= coalesce(p_period_start, now());
  avail := greatest(0, coalesce(p_allowance, 0) - used);
  if avail + acct.topup_credits < p_credits then
    raise exception 'NARRATION_CREDITS:%', avail + acct.topup_credits;
  end if;
  from_a := least(p_credits, avail);
  from_t := p_credits - from_a;
  if from_t > 0 then
    update public.narration_accounts set topup_credits = topup_credits - from_t where user_id = p_user;
  end if;
  insert into public.narration_usage (user_id, book_id, chapter_id, model, quality, chars, credits, from_allowance, from_topup, cost_usd)
    values (p_user, p_book, p_chapter, p_model, p_quality, p_chars, p_credits, from_a, from_t, p_cost)
    returning id into rid;
  return rid;
end $$;

-- Confirms a reservation once the audio is saved, or gives the credits back if narration failed.
create or replace function public.narration_settle(p_id uuid, p_ok boolean) returns void
language plpgsql security definer set search_path = public as $$
declare r public.narration_usage;
begin
  select * into r from public.narration_usage where id = p_id for update;
  if r.id is null or r.status <> 'reserved' then return; end if;
  if p_ok then
    update public.narration_usage set status = 'charged', settled_at = now() where id = p_id;
  else
    update public.narration_usage set status = 'refunded', settled_at = now() where id = p_id;
    if r.from_topup > 0 then
      update public.narration_accounts set topup_credits = topup_credits + r.from_topup where user_id = r.user_id;
    end if;
  end if;
end $$;

-- Adds purchased top-up credits exactly once per payment. Returns false if this payment was already counted.
create or replace function public.narration_grant_topup(
  p_user uuid, p_credits int, p_provider text, p_external_id text, p_amount numeric, p_currency text
) returns boolean
language plpgsql security definer set search_path = public as $$
declare inserted int;
begin
  insert into public.narration_topups (user_id, provider, external_id, credits, amount, currency)
    values (p_user, p_provider, p_external_id, p_credits, p_amount, p_currency)
    on conflict (provider, external_id) do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then return false; end if;
  insert into public.narration_accounts (user_id, topup_credits) values (p_user, p_credits)
    on conflict (user_id) do update set topup_credits = public.narration_accounts.topup_credits + excluded.topup_credits;
  return true;
end $$;

-- Only the server (service role) may move credits.
revoke all on function public.narration_reserve(uuid, int, int, timestamptz, uuid, uuid, text, text, int, numeric) from public, anon, authenticated;
revoke all on function public.narration_settle(uuid, boolean) from public, anon, authenticated;
revoke all on function public.narration_grant_topup(uuid, int, text, text, numeric, text) from public, anon, authenticated;
grant execute on function public.narration_reserve(uuid, int, int, timestamptz, uuid, uuid, text, text, int, numeric) to service_role;
grant execute on function public.narration_settle(uuid, boolean) to service_role;
grant execute on function public.narration_grant_topup(uuid, int, text, text, numeric, text) to service_role;
