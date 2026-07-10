-- SaaS Multi-Tenant Database Migrations

-- 0. Clean up old single-user test data to prevent null tenant_id conflicts
truncate table public.sale_items cascade;
truncate table public.sales cascade;
truncate table public.products cascade;
truncate table public.settings cascade;

-- 1. Create Tenants Table
create table if not exists public.tenants (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  status text not null default 'active' check (status in ('active', 'suspended', 'inactive', 'pending')),
  subscription_ends_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create Profiles Table (connects to Supabase Auth users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  role text not null default 'owner' check (role in ('super_admin', 'owner', 'staff')),
  tenant_id uuid references public.tenants(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Modify Products Table to support multi-tenancy
alter table public.products add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

-- 4. Modify Sales Table to support multi-tenancy
alter table public.sales add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

-- 5. Modify Settings Table to support multi-tenancy
alter table public.settings add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;
-- Remove constraints on settings if they restrict id=1 for multiple settings
alter table public.settings drop constraint if exists settings_id_check;
alter table public.settings drop constraint if exists settings_pkey;
alter table public.settings add primary key (id, tenant_id);

-- 6. Enable Row Level Security (RLS) on all tables
alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.settings enable row level security;
alter table public.sale_items enable row level security; -- Junction table

-- 7. Define Security Definer function to check if the user is a super admin
-- This avoids infinite recursion in RLS policies by bypassing RLS during execution.
create or replace function public.is_super_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin'
  );
end;
$$ language plpgsql security definer;

-- 8. Define RLS Policies

-- Tenants policies
create policy "Super admins have full access to tenants" on public.tenants
  for all using (
    public.is_super_admin()
  );

create policy "Tenant owners can view own tenant" on public.tenants
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and tenant_id = tenants.id)
  );

-- Profiles policies
create policy "Super admins have full access to profiles" on public.profiles
  for all using (
    public.is_super_admin()
  );

create policy "Users can view and edit own profile" on public.profiles
  for all using (
    auth.uid() = id
  ) with check (
    auth.uid() = id
  );

-- Products policies
create policy "Super admins have full access to products" on public.products
  for all using (
    public.is_super_admin()
  );

create policy "Active tenant members have full access to products" on public.products
  for all using (
    exists (
      select 1 from public.profiles p
      join public.tenants t on p.tenant_id = t.id
      where p.id = auth.uid()
        and p.tenant_id = products.tenant_id
        and t.status = 'active'
    )
  ) with check (
    exists (
      select 1 from public.profiles p
      join public.tenants t on p.tenant_id = t.id
      where p.id = auth.uid()
        and p.tenant_id = products.tenant_id
        and t.status = 'active'
    )
  );

-- Sales policies
create policy "Super admins have full access to sales" on public.sales
  for all using (
    public.is_super_admin()
  );

create policy "Active tenant members have full access to sales" on public.sales
  for all using (
    exists (
      select 1 from public.profiles p
      join public.tenants t on p.tenant_id = t.id
      where p.id = auth.uid()
        and p.tenant_id = sales.tenant_id
        and t.status = 'active'
    )
  ) with check (
    exists (
      select 1 from public.profiles p
      join public.tenants t on p.tenant_id = t.id
      where p.id = auth.uid()
        and p.tenant_id = sales.tenant_id
        and t.status = 'active'
    )
  );

-- Sale Items policies
create policy "Super admins have full access to sale_items" on public.sale_items
  for all using (
    public.is_super_admin()
  );

create policy "Active tenant members have full access to sale_items" on public.sale_items
  for all using (
    exists (
      select 1 from public.profiles p
      join public.tenants t on p.tenant_id = t.id
      join public.sales s on s.id = sale_items.sale_id
      where p.id = auth.uid()
        and p.tenant_id = s.tenant_id
        and t.status = 'active'
    )
  ) with check (
    exists (
      select 1 from public.profiles p
      join public.tenants t on p.tenant_id = t.id
      join public.sales s on s.id = sale_items.sale_id
      where p.id = auth.uid()
        and p.tenant_id = s.tenant_id
        and t.status = 'active'
    )
  );

-- Settings policies
create policy "Super admins have full access to settings" on public.settings
  for all using (
    public.is_super_admin()
  );

create policy "Active tenant members have full access to settings" on public.settings
  for all using (
    exists (
      select 1 from public.profiles p
      join public.tenants t on p.tenant_id = t.id
      where p.id = auth.uid()
        and p.tenant_id = settings.tenant_id
        and t.status = 'active'
    )
  ) with check (
    exists (
      select 1 from public.profiles p
      join public.tenants t on p.tenant_id = t.id
      where p.id = auth.uid()
        and p.tenant_id = settings.tenant_id
        and t.status = 'active'
    )
  );

-- 9. Auto-create User Profile Trigger
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role, tenant_id)
  values (new.id, new.email, 'owner', null)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists and recreate
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
