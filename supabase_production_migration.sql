-- Production hardening migration for the POS SaaS.
--
-- Run this once in the Supabase SQL editor AFTER the existing schema has been
-- created. It is intentionally non-destructive: it never truncates tenant data.
-- Review it in a staging project and take a database backup before production use.

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Data model additions
-- ---------------------------------------------------------------------------

alter table public.tenants
  add column if not exists next_sale_number integer not null default 1;

alter table public.profiles
  add column if not exists active boolean not null default true;

alter table public.sales
  add column if not exists display_number integer,
  add column if not exists payment_method text not null default 'cash',
  add column if not exists amount_tendered numeric,
  add column if not exists change_amount numeric not null default 0,
  add column if not exists status text not null default 'completed',
  add column if not exists completed_by uuid references public.profiles(id) on delete set null,
  add column if not exists refunded_at timestamp with time zone,
  add column if not exists refunded_by uuid references public.profiles(id) on delete set null;

alter table public.sales
  drop constraint if exists sales_status_check;
alter table public.sales
  add constraint sales_status_check check (status in ('completed', 'refunded', 'voided'));

-- Give historic rows a stable display number per shop and make future values unique.
with numbered_sales as (
  select id,
         row_number() over (partition by tenant_id order by date, id)::integer as number
  from public.sales
  where display_number is null
)
update public.sales sales
set display_number = numbered_sales.number
from numbered_sales
where sales.id = numbered_sales.id;

update public.tenants tenant
set next_sale_number = greatest(
  tenant.next_sale_number,
  coalesce((
    select max(sales.display_number) + 1
    from public.sales sales
    where sales.tenant_id = tenant.id
  ), 1)
);

create unique index if not exists sales_tenant_display_number_key
  on public.sales (tenant_id, display_number)
  where tenant_id is not null and display_number is not null;

create index if not exists profiles_tenant_role_idx
  on public.profiles (tenant_id, role, active);
create index if not exists products_tenant_id_idx
  on public.products (tenant_id);
create index if not exists sales_tenant_date_idx
  on public.sales (tenant_id, date desc);
create index if not exists sale_items_sale_id_idx
  on public.sale_items (sale_id);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id text not null references public.products(id) on delete restrict,
  sale_id text references public.sales(id) on delete set null,
  quantity_delta integer not null,
  reason text not null check (reason in ('sale', 'refund', 'adjustment', 'import')),
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create index if not exists stock_movements_tenant_created_at_idx
  on public.stock_movements (tenant_id, created_at desc);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create index if not exists audit_logs_tenant_created_at_idx
  on public.audit_logs (tenant_id, created_at desc);

create table if not exists public.staff_invites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'cancelled', 'expired')),
  expires_at timestamp with time zone not null default timezone('utc'::text, now()) + interval '7 days',
  created_by uuid references public.profiles(id) on delete set null,
  accepted_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamp with time zone,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create unique index if not exists staff_invites_pending_email_key
  on public.staff_invites (tenant_id, lower(email))
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- Security helpers. SECURITY DEFINER is deliberate; every public entry point
-- validates auth.uid() and tenant status before changing data.
-- ---------------------------------------------------------------------------

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'super_admin'
      and active = true
  );
$$;

create or replace function public.tenant_subscription_is_active(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenants
    where id = target_tenant_id
      and status = 'active'
      and (subscription_ends_at is null or subscription_ends_at > now())
  );
$$;

create or replace function public.current_user_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id
  from public.profiles
  where id = auth.uid()
    and active = true;
$$;

create or replace function public.is_active_tenant_member(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.tenant_subscription_is_active(target_tenant_id)
    and exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and tenant_id = target_tenant_id
        and active = true
        and role in ('owner', 'staff')
    );
$$;

create or replace function public.is_active_tenant_owner(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.tenant_subscription_is_active(target_tenant_id)
    and exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and tenant_id = target_tenant_id
        and active = true
        and role = 'owner'
    );
$$;

-- Staff can read shop-facing values but never the owner terminal PIN hash.
-- The base settings table is owner-only under RLS below; all POS clients use
-- this narrow RPC instead of selecting the table directly.
create or replace function public.get_pos_settings()
returns table (
  shop_name text,
  currency text,
  tax_rate numeric,
  owner_name text,
  pin_hash text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  target_tenant_id uuid;
  actor_role text;
begin
  select tenant_id, role
  into target_tenant_id, actor_role
  from public.profiles
  where id = auth.uid() and active = true;

  if target_tenant_id is null or actor_role not in ('owner', 'staff')
     or not public.tenant_subscription_is_active(target_tenant_id) then
    raise exception 'An active shop account is required to read settings';
  end if;

  return query
  select
    settings.shop_name,
    settings.currency,
    settings.tax_rate,
    settings.owner_name,
    case when actor_role = 'owner' then settings.pin_hash else null end
  from public.settings settings
  where settings.tenant_id = target_tenant_id
  limit 1;
end;
$$;

create or replace function public.write_audit_log(
  target_tenant_id uuid,
  event_action text,
  event_entity_type text,
  event_entity_id text,
  event_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (tenant_id, actor_id, action, entity_type, entity_id, metadata)
  values (target_tenant_id, auth.uid(), event_action, event_entity_type, event_entity_id, coalesce(event_metadata, '{}'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------
-- Sign-up and staff lifecycle. Browser clients may never change a tenant
-- association or role. A CAPTCHA-protected public sign-up creates one pending
-- tenant here; staff can join only through a pre-authorised invitation.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_tenant_id uuid;
  requested_shop_name text;
  matching_invite public.staff_invites%rowtype;
  owner_exists boolean;
begin
  requested_tenant_id := nullif(new.raw_user_meta_data ->> 'tenant_id', '')::uuid;
  requested_shop_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'shop_name', '')), '');

  -- A public application reaches this trigger only after Supabase Auth has
  -- verified its CAPTCHA token. The browser cannot insert or update tenants.
  if requested_tenant_id is null and requested_shop_name is not null then
    if char_length(requested_shop_name) < 2 or char_length(requested_shop_name) > 120 then
      raise exception 'A shop name must be between 2 and 120 characters';
    end if;

    insert into public.tenants (name, status)
    values (requested_shop_name, 'pending')
    returning id into requested_tenant_id;
  end if;

  if requested_tenant_id is null then
    raise exception 'A tenant invitation or shop application is required';
  end if;

  select exists (
    select 1 from public.tenants where id = requested_tenant_id and status in ('pending', 'active')
  ) into owner_exists;
  if not owner_exists then
    raise exception 'The requested tenant is not available';
  end if;

  select *
  into matching_invite
  from public.staff_invites
  where tenant_id = requested_tenant_id
    and lower(email) = lower(coalesce(new.email, ''))
    and status = 'pending'
    and expires_at > now()
  for update;

  if found then
    insert into public.profiles (id, email, role, tenant_id, active)
    values (new.id, coalesce(new.email, ''), 'staff', requested_tenant_id, true)
    on conflict (id) do nothing;

    update public.staff_invites
    set status = 'accepted', accepted_by = new.id, accepted_at = now()
    where id = matching_invite.id;
    return new;
  end if;

  select exists (
    select 1
    from public.profiles
    where tenant_id = requested_tenant_id
      and role = 'owner'
      and active = true
  ) into owner_exists;

  if owner_exists then
    raise exception 'This tenant already has an owner';
  end if;

  insert into public.profiles (id, email, role, tenant_id, active)
  values (new.id, coalesce(new.email, ''), 'owner', requested_tenant_id, true)
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.handle_new_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.settings (id, tenant_id, shop_name, currency, tax_rate)
  values (1, new.id, new.name, 'Ks', 5)
  on conflict (id, tenant_id) do nothing;
  return new;
end;
$$;

create or replace function public.create_staff_invite(invited_email text)
returns public.staff_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  target_tenant_id uuid;
  created_invite public.staff_invites%rowtype;
begin
  target_tenant_id := public.current_user_tenant_id();
  if target_tenant_id is null or not public.is_active_tenant_owner(target_tenant_id) then
    raise exception 'Only an active shop owner can invite staff';
  end if;

  if invited_email is null or invited_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'A valid email address is required';
  end if;

  update public.staff_invites
  set status = 'cancelled'
  where tenant_id = target_tenant_id
    and lower(email) = lower(trim(invited_email))
    and status = 'pending';

  insert into public.staff_invites (tenant_id, email, created_by)
  values (target_tenant_id, lower(trim(invited_email)), auth.uid())
  returning * into created_invite;

  perform public.write_audit_log(target_tenant_id, 'staff.invited', 'staff_invite', created_invite.id::text,
    jsonb_build_object('email', created_invite.email));
  return created_invite;
end;
$$;

create or replace function public.deactivate_staff(target_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_tenant_id uuid;
begin
  target_tenant_id := public.current_user_tenant_id();
  if target_tenant_id is null or not public.is_active_tenant_owner(target_tenant_id) then
    raise exception 'Only an active shop owner can deactivate staff';
  end if;

  update public.profiles
  set active = false
  where id = target_profile_id
    and tenant_id = target_tenant_id
    and role = 'staff';

  if not found then
    raise exception 'Staff account not found';
  end if;

  perform public.write_audit_log(target_tenant_id, 'staff.deactivated', 'profile', target_profile_id::text);
end;
$$;

-- ---------------------------------------------------------------------------
-- Atomic sales and refunds. Prices, tax, stock and payments are calculated in
-- the database, so a failed checkout cannot leave a half-written sale.
-- ---------------------------------------------------------------------------

create or replace function public.complete_sale(
  sale_items_input jsonb,
  requested_payment_method text default 'cash',
  requested_amount_tendered numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_tenant_id uuid;
  actor_role text;
  current_item jsonb;
  requested_product_id text;
  requested_quantity integer;
  db_product public.products%rowtype;
  sale_id text;
  sale_number integer;
  tax_rate numeric := 0;
  subtotal_amount numeric := 0;
  tax_amount numeric := 0;
  total_amount numeric := 0;
  tendered_amount numeric := 0;
  change_due numeric := 0;
  normalized_payment_method text;
  response_items jsonb := '[]'::jsonb;
begin
  select tenant_id, role
  into target_tenant_id, actor_role
  from public.profiles
  where id = auth.uid() and active = true;

  if target_tenant_id is null or actor_role not in ('owner', 'staff')
     or not public.tenant_subscription_is_active(target_tenant_id) then
    raise exception 'An active shop account is required to complete a sale';
  end if;

  if sale_items_input is null or jsonb_typeof(sale_items_input) <> 'array' or jsonb_array_length(sale_items_input) = 0 then
    raise exception 'At least one sale item is required';
  end if;

  normalized_payment_method := lower(trim(coalesce(requested_payment_method, 'cash')));
  if normalized_payment_method not in ('cash', 'kbzpay', 'wavepay', 'card', 'credit', 'other') then
    raise exception 'Unsupported payment method';
  end if;

  select coalesce((
    select tax_rate
    from public.settings
    where tenant_id = target_tenant_id
    limit 1
  ), 0)
  into tax_rate;

  update public.tenants
  set next_sale_number = next_sale_number + 1
  where id = target_tenant_id
  returning next_sale_number - 1 into sale_number;

  sale_id := '#' || lpad(sale_number::text, 6, '0') || '-' || gen_random_uuid()::text;

  for current_item in select value from jsonb_array_elements(sale_items_input)
  loop
    requested_product_id := nullif(current_item ->> 'id', '');
    requested_quantity := nullif(current_item ->> 'qty', '')::integer;

    if requested_product_id is null or requested_quantity is null or requested_quantity <= 0 then
      raise exception 'Every sale item needs a valid product and quantity';
    end if;

    select *
    into db_product
    from public.products
    where id = requested_product_id and tenant_id = target_tenant_id
    for update;

    if not found then
      raise exception 'Product % was not found', requested_product_id;
    end if;
    if coalesce(db_product.stock, 0) < requested_quantity then
      raise exception 'Insufficient stock for %', db_product.name;
    end if;

    update public.products
    set stock = coalesce(stock, 0) - requested_quantity
    where id = db_product.id and tenant_id = target_tenant_id;

    subtotal_amount := subtotal_amount + db_product.price * requested_quantity;
    response_items := response_items || jsonb_build_array(jsonb_build_object(
      'id', db_product.id,
      'name', db_product.name,
      'price', db_product.price,
      'qty', requested_quantity,
      'emoji', db_product.emoji,
      'category', db_product.category
    ));
  end loop;

  tax_amount := round(subtotal_amount * tax_rate / 100, 0);
  total_amount := subtotal_amount + tax_amount;
  tendered_amount := coalesce(requested_amount_tendered, total_amount);

  if normalized_payment_method = 'cash' then
    if tendered_amount < total_amount then
      raise exception 'Cash received is less than the total';
    end if;
    change_due := tendered_amount - total_amount;
  else
    tendered_amount := total_amount;
    change_due := 0;
  end if;

  insert into public.sales (
    id, tenant_id, display_number, date, subtotal, tax, total,
    payment_method, amount_tendered, change_amount, status, completed_by
  ) values (
    sale_id, target_tenant_id, sale_number, now(), subtotal_amount, tax_amount, total_amount,
    normalized_payment_method, tendered_amount, change_due, 'completed', auth.uid()
  );

  -- Lines are written only after the parent sale exists. response_items retains
  -- the validated product snapshot from the locked product rows above.
  for current_item in select value from jsonb_array_elements(response_items)
  loop
    insert into public.sale_items (sale_id, product_id, name, price, qty, emoji, category)
    values (
      sale_id,
      current_item ->> 'id',
      current_item ->> 'name',
      (current_item ->> 'price')::numeric,
      (current_item ->> 'qty')::integer,
      current_item ->> 'emoji',
      current_item ->> 'category'
    );

    insert into public.stock_movements (tenant_id, product_id, sale_id, quantity_delta, reason, created_by)
    values (target_tenant_id, current_item ->> 'id', sale_id, -((current_item ->> 'qty')::integer), 'sale', auth.uid());
  end loop;

  perform public.write_audit_log(target_tenant_id, 'sale.completed', 'sale', sale_id,
    jsonb_build_object('display_number', sale_number, 'total', total_amount, 'payment_method', normalized_payment_method));

  return jsonb_build_object(
    'id', sale_id,
    'displayNumber', sale_number,
    'date', now(),
    'items', response_items,
    'subtotal', subtotal_amount,
    'tax', tax_amount,
    'total', total_amount,
    'paymentMethod', normalized_payment_method,
    'amountTendered', tendered_amount,
    'changeAmount', change_due,
    'status', 'completed'
  );
end;
$$;

create or replace function public.refund_sale(target_sale_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_tenant_id uuid;
  sale_row public.sales%rowtype;
  line_item public.sale_items%rowtype;
begin
  target_tenant_id := public.current_user_tenant_id();
  if target_tenant_id is null or not public.is_active_tenant_owner(target_tenant_id) then
    raise exception 'Only an active shop owner can refund a sale';
  end if;

  select *
  into sale_row
  from public.sales
  where id = target_sale_id and tenant_id = target_tenant_id
  for update;

  if not found then
    raise exception 'Sale not found';
  end if;
  if sale_row.status <> 'completed' then
    raise exception 'Only completed sales can be refunded';
  end if;

  for line_item in
    select * from public.sale_items where sale_id = sale_row.id
  loop
    update public.products
    set stock = coalesce(stock, 0) + line_item.qty
    where id = line_item.product_id and tenant_id = target_tenant_id;

    insert into public.stock_movements (tenant_id, product_id, sale_id, quantity_delta, reason, created_by)
    values (target_tenant_id, line_item.product_id, sale_row.id, line_item.qty, 'refund', auth.uid());
  end loop;

  update public.sales
  set status = 'refunded', refunded_at = now(), refunded_by = auth.uid()
  where id = sale_row.id;

  perform public.write_audit_log(target_tenant_id, 'sale.refunded', 'sale', sale_row.id,
    jsonb_build_object('total', sale_row.total));
  return jsonb_build_object('id', sale_row.id, 'status', 'refunded');
end;
$$;

create or replace function public.adjust_product_stock(
  target_product_id text,
  quantity_delta integer,
  adjustment_note text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  target_tenant_id uuid;
  new_stock integer;
begin
  target_tenant_id := public.current_user_tenant_id();
  if target_tenant_id is null or not public.is_active_tenant_owner(target_tenant_id) then
    raise exception 'Only an active shop owner can adjust stock';
  end if;
  if quantity_delta = 0 then
    raise exception 'Stock adjustment cannot be zero';
  end if;

  update public.products
  set stock = coalesce(stock, 0) + quantity_delta
  where id = target_product_id
    and tenant_id = target_tenant_id
    and coalesce(stock, 0) + quantity_delta >= 0
  returning stock into new_stock;

  if not found then
    raise exception 'Product not found or stock would become negative';
  end if;

  insert into public.stock_movements (tenant_id, product_id, quantity_delta, reason, note, created_by)
  values (target_tenant_id, target_product_id, quantity_delta, 'adjustment', nullif(trim(adjustment_note), ''), auth.uid());

  perform public.write_audit_log(target_tenant_id, 'stock.adjusted', 'product', target_product_id,
    jsonb_build_object('quantity_delta', quantity_delta, 'note', adjustment_note));
  return new_stock;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS. Remove all permissive policies from the original prototype.
-- ---------------------------------------------------------------------------

alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.settings enable row level security;
alter table public.stock_movements enable row level security;
alter table public.audit_logs enable row level security;
alter table public.staff_invites enable row level security;

drop policy if exists "Super admins have full access to tenants" on public.tenants;
drop policy if exists "Tenant owners can view own tenant" on public.tenants;
drop policy if exists "Allow anyone to insert pending tenants" on public.tenants;
drop policy if exists "Allow anyone to select pending tenants" on public.tenants;
drop policy if exists "Super admins have full access to profiles" on public.profiles;
drop policy if exists "Users can view and edit own profile" on public.profiles;
drop policy if exists "Super admins have full access to products" on public.products;
drop policy if exists "Active tenant members have full access to products" on public.products;
drop policy if exists "Super admins have full access to sales" on public.sales;
drop policy if exists "Active tenant members have full access to sales" on public.sales;
drop policy if exists "Super admins have full access to sale_items" on public.sale_items;
drop policy if exists "Active tenant members have full access to sale_items" on public.sale_items;
drop policy if exists "Super admins have full access to settings" on public.settings;
drop policy if exists "Active tenant members have full access to settings" on public.settings;
drop policy if exists "Allow public read/write access to products" on public.products;
drop policy if exists "Allow public read/write access to sales" on public.sales;
drop policy if exists "Allow public read/write access to sale_items" on public.sale_items;
drop policy if exists "Allow public read/write access to settings" on public.settings;
drop policy if exists "anonymous users request pending tenants" on public.tenants;

create policy "admins manage tenants" on public.tenants
  for all using (public.is_super_admin()) with check (public.is_super_admin());
create policy "members read their tenant" on public.tenants
  for select using (public.current_user_tenant_id() = id);
create policy "admins manage profiles" on public.profiles
  for all using (public.is_super_admin()) with check (public.is_super_admin());
create policy "users read their own profile" on public.profiles
  for select using (id = auth.uid());
create policy "owners read their staff" on public.profiles
  for select using (role = 'staff' and public.is_active_tenant_owner(tenant_id));

create policy "admins manage products" on public.products
  for all using (public.is_super_admin()) with check (public.is_super_admin());
create policy "members read active-tenant products" on public.products
  for select using (public.is_active_tenant_member(tenant_id));
create policy "owners manage active-tenant products" on public.products
  for all using (public.is_active_tenant_owner(tenant_id)) with check (public.is_active_tenant_owner(tenant_id));

create policy "admins manage sales" on public.sales
  for all using (public.is_super_admin()) with check (public.is_super_admin());
create policy "members read active-tenant sales" on public.sales
  for select using (public.is_active_tenant_member(tenant_id));

create policy "admins manage sale items" on public.sale_items
  for all using (public.is_super_admin()) with check (public.is_super_admin());
create policy "members read active-tenant sale items" on public.sale_items
  for select using (
    exists (
      select 1 from public.sales
      where sales.id = sale_items.sale_id
        and public.is_active_tenant_member(sales.tenant_id)
    )
  );

create policy "admins manage settings" on public.settings
  for all using (public.is_super_admin()) with check (public.is_super_admin());
create policy "owners read active-tenant settings" on public.settings
  for select using (public.is_active_tenant_owner(tenant_id));
create policy "owners update active-tenant settings" on public.settings
  for update using (public.is_active_tenant_owner(tenant_id)) with check (public.is_active_tenant_owner(tenant_id));
create policy "owners insert active-tenant settings" on public.settings
  for insert with check (public.is_active_tenant_owner(tenant_id));

create policy "admins manage stock movements" on public.stock_movements
  for all using (public.is_super_admin()) with check (public.is_super_admin());
create policy "owners read stock movements" on public.stock_movements
  for select using (public.is_active_tenant_owner(tenant_id));

create policy "admins manage audit logs" on public.audit_logs
  for all using (public.is_super_admin()) with check (public.is_super_admin());
create policy "owners read audit logs" on public.audit_logs
  for select using (public.is_active_tenant_owner(tenant_id));

create policy "admins manage staff invites" on public.staff_invites
  for all using (public.is_super_admin()) with check (public.is_super_admin());
create policy "owners read staff invites" on public.staff_invites
  for select using (public.is_active_tenant_owner(tenant_id));

-- PostgreSQL grants EXECUTE to PUBLIC by default. Revoke that default from
-- every security-definer helper, then explicitly grant only signed-in users
-- the functions required by the application and RLS policies.
revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_tenant() from public;
revoke all on function public.is_super_admin() from public;
revoke all on function public.tenant_subscription_is_active(uuid) from public;
revoke all on function public.current_user_tenant_id() from public;
revoke all on function public.is_active_tenant_member(uuid) from public;
revoke all on function public.is_active_tenant_owner(uuid) from public;
revoke all on function public.get_pos_settings() from public;
revoke all on function public.write_audit_log(uuid, text, text, text, jsonb) from public;
revoke all on function public.create_staff_invite(text) from public;
revoke all on function public.deactivate_staff(uuid) from public;
revoke all on function public.complete_sale(jsonb, text, numeric) from public;
revoke all on function public.refund_sale(text) from public;
revoke all on function public.adjust_product_stock(text, integer, text) from public;

revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_tenant() from anon;
revoke all on function public.is_super_admin() from anon;
revoke all on function public.tenant_subscription_is_active(uuid) from anon;
revoke all on function public.current_user_tenant_id() from anon;
revoke all on function public.is_active_tenant_member(uuid) from anon;
revoke all on function public.is_active_tenant_owner(uuid) from anon;
revoke all on function public.get_pos_settings() from anon;
revoke all on function public.write_audit_log(uuid, text, text, text, jsonb) from anon;
revoke all on function public.create_staff_invite(text) from anon;
revoke all on function public.deactivate_staff(uuid) from anon;
revoke all on function public.complete_sale(jsonb, text, numeric) from anon;
revoke all on function public.refund_sale(text) from anon;
revoke all on function public.adjust_product_stock(text, integer, text) from anon;

grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.tenant_subscription_is_active(uuid) to authenticated;
grant execute on function public.current_user_tenant_id() to authenticated;
grant execute on function public.is_active_tenant_member(uuid) to authenticated;
grant execute on function public.is_active_tenant_owner(uuid) to authenticated;
grant execute on function public.create_staff_invite(text) to authenticated;
grant execute on function public.deactivate_staff(uuid) to authenticated;
grant execute on function public.complete_sale(jsonb, text, numeric) to authenticated;
grant execute on function public.refund_sale(text) to authenticated;
grant execute on function public.adjust_product_stock(text, integer, text) to authenticated;
grant execute on function public.get_pos_settings() to authenticated;

commit;
