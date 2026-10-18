-- Print orders, print pricing settings, sales figures and store links.
-- Safe to run more than once.

-- Site-wide settings the admin can change (print pricing lives under 'print_pricing').
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
drop policy if exists "read settings" on public.app_settings;
create policy "read settings" on public.app_settings for select using (auth.uid() is not null);
drop policy if exists "admin writes settings" on public.app_settings;
create policy "admin writes settings" on public.app_settings for all using (public.is_admin()) with check (public.is_admin());

-- Printed copies an author orders for themselves.
create table if not exists public.print_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid references public.books(id) on delete set null,
  book_title text not null default '',
  format text not null check (format in ('paperback', 'hardcover')),
  ink text not null default 'bw' check (ink in ('bw', 'standard', 'premium')),
  trim_size text not null,
  paper text not null default 'white',
  pages int not null check (pages > 0),
  quantity int not null check (quantity between 1 and 5000),
  base_unit_cost numeric(10, 2) not null,
  unit_price numeric(10, 2) not null,
  shipping_region text not null,
  shipping_cost numeric(10, 2) not null default 0,
  total numeric(10, 2) not null,
  currency text not null default 'USD',
  ship_to jsonb not null default '{}'::jsonb,
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment', 'paid', 'in_production', 'shipped', 'delivered', 'cancelled')),
  paypal_order_id text,
  tracking text not null default '',
  admin_note text not null default '',
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists print_orders_user on public.print_orders (user_id, created_at desc);
alter table public.print_orders enable row level security;
-- Orders are created and changed by the server only; authors can read their own.
drop policy if exists "own orders read" on public.print_orders;
create policy "own orders read" on public.print_orders for select using (user_id = auth.uid());
drop policy if exists "admin orders" on public.print_orders;
create policy "admin orders" on public.print_orders for all using (public.is_admin()) with check (public.is_admin());
drop trigger if exists print_orders_touch on public.print_orders;
create trigger print_orders_touch before update on public.print_orders for each row execute function public.touch_updated_at();

-- Sales and royalties per book, entered or imported by the publishing team.
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  period date not null,
  store text not null,
  format text not null default 'ebook' check (format in ('ebook', 'paperback', 'hardcover', 'audiobook')),
  units int not null default 0,
  pages_read int not null default 0,
  revenue numeric(12, 2) not null default 0,
  royalty numeric(12, 2) not null default 0,
  currency text not null default 'USD',
  created_at timestamptz not null default now()
);
create index if not exists sales_book on public.sales (book_id, period);
create index if not exists sales_user on public.sales (user_id, period);
alter table public.sales enable row level security;
drop policy if exists "own sales read" on public.sales;
create policy "own sales read" on public.sales for select using (user_id = auth.uid());
drop policy if exists "admin sales" on public.sales;
create policy "admin sales" on public.sales for all using (public.is_admin()) with check (public.is_admin());

-- Links to the book's page in each store, added by the publishing team once it's live.
alter table public.submissions add column if not exists store_links jsonb not null default '{}'::jsonb;

-- Make the API see the changes straight away.
notify pgrst, 'reload schema';
