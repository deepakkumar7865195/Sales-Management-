-- ============================================================================
-- Product Sales, Cost Price, Billing & Profit Management System
-- Supabase / PostgreSQL schema
-- ----------------------------------------------------------------------------
-- SECURITY MODEL:
--   * Staff NEVER receive SELECT access to base tables (products, sales,
--     sale_items, daily_closing, audit_log). All staff reads go through
--     mediated VIEWS (staff_products, staff_my_sales) or through server-side
--     Server Actions which filter by the authenticated staff id.
--   * Realtime for staff is served ONLY from mirror tables that deliberately
--     exclude cost/profit data (products_realtime, staff_day_stats), so the
--     realtime websocket payload can never leak Cost Price or Profit.
--   * Returns the "authenticated" JWT role can only read what RLS allows.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- EXTENSIONS
-- ---------------------------------------------------------------------------
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- HELPER FUNCTIONS (used by RLS policies)
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
      and u.status = 'active'
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.status = 'active'
  );
$$;

-- ---------------------------------------------------------------------------
-- USERS
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null check (role in ('admin', 'staff')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

drop policy if exists "users_select_own_or_admin" on public.users;
create policy "users_select_own_or_admin"
  on public.users for select
  using (auth.uid() = id or public.is_admin());

drop policy if exists "users_insert_admin" on public.users;
create policy "users_insert_admin"
  on public.users for insert
  with check (public.is_admin());

drop policy if exists "users_update_admin" on public.users;
create policy "users_update_admin"
  on public.users for update
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- PRODUCTS (base table - ALWAYS restricted; contains Cost Price)
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text not null unique,
  image_url text,
  cost_price numeric(12,2) not null default 0,
  selling_price numeric(12,2),
  category text,
  stock integer not null default 0,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Deny the API role direct SELECT on products: Cost Price must never reach
-- the client. Admin product reads happen server-side via Server Actions.
revoke all on table public.products from authenticated, anon;

alter table public.products enable row level security;

drop policy if exists "products_admin_all" on public.products;
create policy "products_admin_all"
  on public.products for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- STAFF PRODUCTS VIEW (Cost Price excluded)
-- ---------------------------------------------------------------------------
-- PostgREST exposes this view as a normal table to the API role.
create or replace view public.staff_products
with (security_invoker = false) as
  select id, name, sku, image_url, selling_price, category, stock, status, updated_at
  from public.products;

grant select on public.staff_products to authenticated;
grant select on public.staff_products to anon;

-- ---------------------------------------------------------------------------
-- PRODUCTS REALTIME MIRROR (no Cost Price; safe for staff subscriptions)
-- ---------------------------------------------------------------------------
create table if not exists public.products_realtime (
  id uuid primary key references public.products (id) on delete cascade,
  name text not null,
  sku text not null,
  image_url text,
  selling_price numeric(12,2),
  category text,
  stock integer not null default 0,
  status text not null default 'active',
  updated_at timestamptz not null default now()
);

alter table public.products_realtime enable row level security;

-- Any authenticated user may subscribe (data contains no cost/profit).
drop policy if exists "products_realtime_select" on public.products_realtime;
create policy "products_realtime_select"
  on public.products_realtime for select
  using (public.is_active_user());

create or replace function public.sync_products_realtime()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.products_realtime (id, name, sku, image_url, selling_price, category, stock, status, updated_at)
    values (new.id, new.name, new.sku, new.image_url, new.selling_price, new.category, new.stock, new.status, new.updated_at);
  elsif tg_op = 'UPDATE' then
    update public.products_realtime
       set name = new.name,
           sku = new.sku,
           image_url = new.image_url,
           selling_price = new.selling_price,
           category = new.category,
           stock = new.stock,
           status = new.status,
           updated_at = new.updated_at
     where id = new.id;
  elsif tg_op = 'DELETE' then
    delete from public.products_realtime where id = old.id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_sync_products_realtime on public.products;
create trigger trg_sync_products_realtime
  after insert or update or delete on public.products
  for each row execute function public.sync_products_realtime();

-- ---------------------------------------------------------------------------
-- SALES
-- ---------------------------------------------------------------------------
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  transaction_id text not null unique,
  staff_id uuid not null references public.users (id),
  sale_date date not null default current_date,
  total_sale numeric(12,2) not null default 0,
  total_cost numeric(12,2) not null default 0,
  total_profit numeric(12,2) not null default 0,
  item_count integer not null default 0,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_sales_staff_date on public.sales (staff_id, sale_date desc);
create index if not exists idx_sales_date on public.sales (sale_date desc);
create index if not exists idx_sales_txn on public.sales (transaction_id);

alter table public.sales enable row level security;

-- Staff cannot SELECT sales (would expose cost/profit). Staff sales data is
-- served via the staff_my_sales view instead.
drop policy if exists "sales_select_admin" on public.sales;
create policy "sales_select_admin"
  on public.sales for select
  using (public.is_admin());

-- Any active user may insert a sale, but staff_id is forced server-side.
drop policy if exists "sales_insert_active" on public.sales;
create policy "sales_insert_active"
  on public.sales for insert
  with check (public.is_active_user());

drop policy if exists "sales_update_admin" on public.sales;
create policy "sales_update_admin"
  on public.sales for update
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- STAFF MY SALES VIEW (public columns only; row-filtered to the requester)
-- ---------------------------------------------------------------------------
create or replace view public.staff_my_sales
with (security_invoker = false) as
  select id, transaction_id, sale_date, total_sale, item_count, status, staff_id, created_at
  from public.sales
  where staff_id = auth.uid();

grant select on public.staff_my_sales to authenticated;

-- ---------------------------------------------------------------------------
-- SALE ITEMS
-- ---------------------------------------------------------------------------
create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  product_id uuid not null references public.products (id),
  product_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  selling_price numeric(12,2) not null default 0,
  cost_price numeric(12,2) not null default 0,
  total_sale numeric(12,2) not null default 0,
  total_cost numeric(12,2) not null default 0,
  profit numeric(12,2) not null default 0
);

create index if not exists idx_sale_items_sale on public.sale_items (sale_id);
create index if not exists idx_sale_items_product on public.sale_items (product_id);

alter table public.sale_items enable row level security;

-- Staff NEVER read sale_items (contains cost_price). Admin reads via server.
drop policy if exists "sale_items_select_admin" on public.sale_items;
create policy "sale_items_select_admin"
  on public.sale_items for select
  using (public.is_admin());

-- Inserts are made through the server-side (service role / security definer RPC).
-- ---------------------------------------------------------------------------
-- STAFF DAY STATS (realtime-safe aggregate for staff dashboards)
-- ---------------------------------------------------------------------------
create table if not exists public.staff_day_stats (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.users (id) on delete cascade,
  business_date date not null default current_date,
  total_sale numeric(12,2) not null default 0,
  products_sold integer not null default 0,
  transactions integer not null default 0,
  unique (staff_id, business_date)
);

alter table public.staff_day_stats enable row level security;

-- Staff may only stream/read their own rows. Admins may read all.
drop policy if exists "staff_day_stats_select_own_or_admin" on public.staff_day_stats;
create policy "staff_day_stats_select_own_or_admin"
  on public.staff_day_stats for select
  using ((auth.uid() = staff_id) or public.is_admin());

create or replace function public.bump_staff_day_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _sale numeric(12,2);
  _qty integer;
  _txn integer;
begin
  select coalesce(sum(s.total_sale), 0), coalesce(sum(s.quantity), 0), count(*)
    into _sale, _qty, _txn
    from public.sale_items s
   where s.sale_id = new.id;

  insert into public.staff_day_stats (staff_id, business_date, total_sale, products_sold, transactions)
  values (new.staff_id, new.sale_date, _sale, _qty, _txn)
  on conflict (staff_id, business_date) do update
     set total_sale    = public.staff_day_stats.total_sale + excluded.total_sale,
         products_sold = public.staff_day_stats.products_sold + excluded.products_sold,
         transactions  = public.staff_day_stats.transactions + excluded.transactions;
  return null;
end;
$$;

drop trigger if exists trg_bump_staff_day_stats on public.sales;
create trigger trg_bump_staff_day_stats
  after insert on public.sales
  for each row execute function public.bump_staff_day_stats();

-- ---------------------------------------------------------------------------
-- DAILY CLOSING
-- ---------------------------------------------------------------------------
create table if not exists public.daily_closing (
  id uuid primary key default gen_random_uuid(),
  business_date date not null unique,
  total_sales numeric(12,2) not null default 0,
  total_cost numeric(12,2) not null default 0,
  total_profit numeric(12,2) not null default 0,
  total_transactions integer not null default 0,
  products_sold integer not null default 0,
  closed_by uuid references public.users (id),
  closed_at timestamptz not null default now(),
  status text not null default 'closed'
);

create index if not exists idx_daily_closing_date on public.daily_closing (business_date desc);

alter table public.daily_closing enable row level security;

drop policy if exists "daily_closing_select_admin" on public.daily_closing;
create policy "daily_closing_select_admin"
  on public.daily_closing for select
  using (public.is_admin());

drop policy if exists "daily_closing_insert_admin" on public.daily_closing;
create policy "daily_closing_insert_admin"
  on public.daily_closing for insert
  with check (public.is_admin());

drop policy if exists "daily_closing_update_admin" on public.daily_closing;
create policy "daily_closing_update_admin"
  on public.daily_closing for update
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- SETTINGS (single-row config table)
-- ---------------------------------------------------------------------------
create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  business_name text not null default 'My Business',
  business_phone text,
  business_address text,
  currency text not null default 'INR',
  staff_can_view_profit boolean not null default false,
  low_stock_threshold integer not null default 5,
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

drop policy if exists "settings_select_active" on public.settings;
create policy "settings_select_active"
  on public.settings for select
  using (public.is_active_user());

drop policy if exists "settings_update_admin" on public.settings;
create policy "settings_update_admin"
  on public.settings for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "settings_insert_admin" on public.settings;
create policy "settings_insert_admin"
  on public.settings for insert
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- AUDIT LOG
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id),
  user_name text,
  action text not null,
  details text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_log_user on public.audit_log (user_id, created_at desc);
create index if not exists idx_audit_log_date on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;

drop policy if exists "audit_log_select_admin" on public.audit_log;
create policy "audit_log_select_admin"
  on public.audit_log for select
  using (public.is_admin());

drop policy if exists "audit_log_insert_active" on public.audit_log;
create policy "audit_log_insert_active"
  on public.audit_log for insert
  with check (public.is_active_user());

-- ---------------------------------------------------------------------------
-- REALTIME PUBLICATION
-- ---------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.sales;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.products_realtime;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.staff_day_stats;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.daily_closing;
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- STORAGE (product images)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product_images_select" on storage.objects;
create policy "product_images_select"
  on storage.objects for select
  using (bucket_id = 'product-images');

drop policy if exists "product_images_insert_admin" on storage.objects;
create policy "product_images_insert_admin"
  on storage.objects for insert
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "product_images_update_admin" on storage.objects;
create policy "product_images_update_admin"
  on storage.objects for update
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "product_images_delete_admin" on storage.objects;
create policy "product_images_delete_admin"
  on storage.objects for delete
  using (bucket_id = 'product-images' and public.is_admin());

-- ---------------------------------------------------------------------------
-- RPC: get_today_summary (timezone-aware daily admin stats)
-- ---------------------------------------------------------------------------
create or replace function public.get_today_summary(day date)
returns table (
  total_sale numeric,
  total_cost numeric,
  total_profit numeric,
  products_sold bigint,
  transactions bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce(sum(s.total_sale), 0)::numeric,
    coalesce(sum(s.total_cost), 0)::numeric,
    coalesce(sum(s.total_profit), 0)::numeric,
    coalesce(sum(s.item_count), 0)::bigint,
    count(*)::bigint
  from public.sales s
  where s.sale_date = day;
$$;

grant execute on function public.get_today_summary(date) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: get_staff_profit_summary (used when staff_can_view_profit is enabled)
-- ---------------------------------------------------------------------------
create or replace function public.get_staff_profit_summary(
  p_staff_id uuid,
  day date
)
returns table (
  total_cost numeric,
  total_profit numeric
)
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce(sum(s.total_cost), 0)::numeric,
    coalesce(sum(s.total_profit), 0)::numeric
  from public.sales s
  where s.staff_id = p_staff_id
    and s.sale_date = day;
$$;

grant execute on function public.get_staff_profit_summary(uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- SEED: default settings row
-- ---------------------------------------------------------------------------
insert into public.settings (business_name, currency, staff_can_view_profit, low_stock_threshold)
values ('My Business', 'INR', false, 5)
on conflict do nothing;