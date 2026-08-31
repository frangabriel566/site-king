-- King Store — 0003_functions.sql
-- Triggers and business-logic functions.

-- ------------------------------------------------------------------
-- updated_at maintenance
-- ------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create trigger set_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------
-- auto-create a profile row for every new auth.users row
-- ------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'customer')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------
-- fulfill_order_stock(order_id) — transactional, idempotent stock
-- decrement. Called only when a payment is confirmed (see the
-- Mercado Pago webhook handler). A guard column (orders.stock_
-- decremented_at) makes repeated calls for the same order a no-op,
-- so a duplicated webhook notification never double-decrements.
--
-- Each variant row is updated with `where stock >= qty`, so the
-- stock column can mathematically never go negative even under
-- concurrent calls for the same variant.
-- ------------------------------------------------------------------
create or replace function public.fulfill_order_stock(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_already_done boolean;
begin
  select (stock_decremented_at is not null) into v_already_done
  from public.orders
  where id = p_order_id
  for update;

  if v_already_done is null then
    raise exception 'order % not found', p_order_id;
  end if;

  if v_already_done then
    return;
  end if;

  for v_item in
    select variant_id, qty
    from public.order_items
    where order_id = p_order_id and variant_id is not null
  loop
    update public.product_variants
      set stock = stock - v_item.qty
      where id = v_item.variant_id and stock >= v_item.qty;
  end loop;

  update public.orders
    set stock_decremented_at = now()
    where id = p_order_id;
end;
$$;

revoke all on function public.fulfill_order_stock(uuid) from public;

-- ------------------------------------------------------------------
-- validate_coupon(code, subtotal) — server-side coupon validation.
-- Returns zero rows when the coupon does not exist, is inactive,
-- expired, or the subtotal does not meet its minimum.
-- ------------------------------------------------------------------
create or replace function public.validate_coupon(p_code text, p_subtotal numeric)
returns table (
  id uuid,
  code text,
  type text,
  value numeric,
  discount numeric
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_coupon public.coupons%rowtype;
  v_discount numeric(10, 2);
begin
  select * into v_coupon
  from public.coupons c
  where lower(c.code) = lower(p_code)
    and c.active = true
    and (c.expires_at is null or c.expires_at > now());

  if not found then
    return;
  end if;

  if p_subtotal < coalesce(v_coupon.min_total, 0) then
    return;
  end if;

  if v_coupon.type = 'percent' then
    v_discount := round(p_subtotal * v_coupon.value / 100, 2);
  else
    v_discount := least(v_coupon.value, p_subtotal);
  end if;

  return query
    select v_coupon.id, v_coupon.code, v_coupon.type, v_coupon.value, v_discount;
end;
$$;

revoke all on function public.validate_coupon(text, numeric) from public;
grant execute on function public.validate_coupon(text, numeric) to anon, authenticated;
