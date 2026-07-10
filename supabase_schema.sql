-- 1. Enable UUID extension (for generating unique IDs if needed)
create extension if not exists "uuid-ossp";

-- 2. Create Products Table
create table if not exists public.products (
  id text primary key,
  name text not null,
  price numeric not null,
  category text not null default 'General',
  emoji text not null default '📦',
  stock integer not null default 0,
  image text,
  barcode text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Create Sales (Transactions) Table
create table if not exists public.sales (
  id text primary key, -- e.g. #0001
  date timestamp with time zone default timezone('utc'::text, now()) not null,
  subtotal numeric not null,
  tax numeric not null,
  total numeric not null
);

-- 4. Create Sale Items Table (Junction Table)
create table if not exists public.sale_items (
  id uuid default gen_random_uuid() primary key,
  sale_id text references public.sales(id) on delete cascade not null,
  product_id text not null,
  name text not null,
  price numeric not null,
  qty integer not null,
  emoji text,
  category text
);

-- 5. Create Settings Table
create table if not exists public.settings (
  id integer primary key default 1 check (id = 1), -- Single row configuration
  shop_name text not null default 'My Shop',
  currency text not null default 'Ks',
  tax_rate numeric not null default 5,
  owner_name text default '',
  pin_hash text default '',
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Insert initial products seed data
insert into public.products (id, name, price, category, emoji, stock, barcode)
values
  ('p1', 'T-Shirt', 8000, 'Clothing', '👕', 20, ''),
  ('p2', 'Jeans', 15000, 'Clothing', '👖', 15, ''),
  ('p3', 'Bread', 1500, 'Food', '🍞', 30, ''),
  ('p4', 'Cake', 5000, 'Food', '🎂', 10, ''),
  ('p5', 'Coffee', 2500, 'Drinks', '☕', 50, ''),
  ('p6', 'Water', 500, 'Drinks', '💧', 100, ''),
  ('p7', 'Paracetamol', 1000, 'Medicine', '💊', 40, ''),
  ('p8', 'Vitamin C', 3000, 'Medicine', '🧴', 25, ''),
  ('p9', 'Rice 1kg', 3500, 'Grocery', '🌾', 60, ''),
  ('p10', 'Egg (10)', 4500, 'Grocery', '🥚', 40, ''),
  ('p11', 'Milk', 2800, 'Drinks', '🥛', 30, ''),
  ('p12', 'Snack', 1200, 'Food', '🍪', 45, '')
on conflict (id) do nothing;

-- Insert default settings row
insert into public.settings (id, shop_name, currency, tax_rate, owner_name, pin_hash)
values (1, 'My Shop', 'Ks', 5, '', '')
on conflict (id) do nothing;

-- Enable Row Level Security (RLS) if you want to restrict public access.
-- By default in a simple setup, you can disable RLS or write policies allowing public read/write.
-- For a basic local POS with an anon key, we'll allow public reads and writes:
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.settings enable row level security;

create policy "Allow public read/write access to products" on public.products for all using (true) with check (true);
create policy "Allow public read/write access to sales" on public.sales for all using (true) with check (true);
create policy "Allow public read/write access to sale_items" on public.sale_items for all using (true) with check (true);
create policy "Allow public read/write access to settings" on public.settings for all using (true) with check (true);
