-- King Store — 0014_whatsapp_orders.sql
-- Compra direta pelo WhatsApp: o pedido nasce no banco *antes* de a
-- conversa começar, para que a loja e o cliente falem sobre a mesma
-- coisa — um código, uma lista de itens, um total.
--
-- Reaproveita `orders`/`order_items` em vez de criar uma tabela
-- paralela. Confirmar uma venda de WhatsApp tem de baixar o mesmo
-- estoque, aparecer no mesmo Dashboard e na mesma lista de Pedidos que
-- qualquer outra venda; uma segunda tabela significaria duplicar as três
-- coisas e deixá-las divergir.

-- ------------------------------------------------------------------
-- orders — dois status novos, o código público e o prazo
-- ------------------------------------------------------------------
--   aguardando_whatsapp  pedido criado, conversa ainda não fechada.
--                        Não reserva estoque: só a confirmação do admin
--                        baixa, e é lá que a disponibilidade é checada
--                        de novo.
--   expirado             passou das 48h sem confirmação. Separado de
--                        `canceled` de propósito — "o cliente sumiu" e
--                        "a loja cancelou" são coisas diferentes na hora
--                        de olhar a aba depois.
alter table public.orders drop constraint orders_status_check;

alter table public.orders
  add constraint orders_status_check
    check (status in (
      'pending', 'paid', 'processing', 'shipped', 'delivered', 'canceled',
      'aguardando_whatsapp', 'expirado'
    ));

-- `code` é o que o cliente cita no WhatsApp e o que o admin busca na
-- aba — curto, sequencial e legível em voz alta, ao contrário do uuid.
-- Nulo em todo pedido que não nasceu por este caminho; `order_number`
-- continua sendo o número interno de todo pedido.
alter table public.orders
  add column code text unique,
  add column expires_at timestamptz;

create sequence if not exists public.whatsapp_order_code_seq start with 1;

-- Índice parcial: a varredura de expiração e a listagem da aba só olham
-- para os pendentes, que são uma fração minúscula da tabela.
create index orders_whatsapp_pending_idx
  on public.orders (expires_at)
  where status = 'aguardando_whatsapp';

-- ------------------------------------------------------------------
-- expire_whatsapp_orders() — a varredura das 48h
-- ------------------------------------------------------------------
-- Não há cron neste projeto, então a expiração é oportunista: roda ao
-- abrir a aba do painel e a cada pedido novo criado. Isso mantém a lista
-- correta sempre que alguém a olha, e a rede de segurança de verdade
-- está em confirm_whatsapp_order(), que recusa um pedido vencido mesmo
-- que esta varredura ainda não tenha passado por ele.
create or replace function public.expire_whatsapp_orders()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  update public.orders
     set status = 'expirado'
   where status = 'aguardando_whatsapp'
     and expires_at is not null
     and expires_at <= now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.expire_whatsapp_orders() from public;
grant execute on function public.expire_whatsapp_orders() to authenticated;

-- ------------------------------------------------------------------
-- create_whatsapp_order(items) — o pedido inteiro numa transação
-- ------------------------------------------------------------------
-- Recebe só `[{variant_id, qty}]`. Nome, cor, tamanho e **preço** são
-- lidos do banco aqui dentro: a sacola vive em localStorage e nunca é
-- fonte de verdade para dinheiro, exatamente como reviseCartItems() já
-- faz no checkout.
--
-- security definer porque o comprador pode ser um visitante anônimo —
-- a política de insert de `orders` exige `customer_id = auth.uid()`, o
-- que nenhum anônimo satisfaz. Em vez de afrouxar a política (o que
-- deixaria qualquer um inserir pedidos arbitrários, com qualquer total),
-- esta função é a única porta: ela decide status, código, prazo e valor.
--
-- Devolve o pedido gravado, com os itens, para que a mensagem do
-- WhatsApp seja montada a partir do que ficou salvo e não do que o
-- navegador achava que tinha.
create or replace function public.create_whatsapp_order(p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_customer_id uuid := null;
  v_order_id uuid;
  v_code text;
  v_expires timestamptz;
  v_raw jsonb;
  v_qty int;
  v_variant record;
  v_customer record;
  v_snapshot jsonb := null;
  v_subtotal numeric(10, 2) := 0;
  v_items jsonb := '[]'::jsonb;
  v_adjusted boolean := false;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART';
  end if;

  -- Teto grosseiro: uma sacola real não passa disso, e sem ele um POST
  -- forjado com dez mil linhas viraria dez mil inserts.
  if jsonb_array_length(p_items) > 50 then
    raise exception 'TOO_MANY_ITEMS';
  end if;

  perform public.expire_whatsapp_orders();

  v_code := 'KS' || lpad(nextval('public.whatsapp_order_code_seq')::text, 4, '0');
  v_expires := now() + interval '48 hours';

  -- `orders.customer_id` aponta para `customers`, não para `auth.users`.
  -- Existe quem tenha conta de autenticação sem cadastro de cliente
  -- completo (o checkout normal barra esse caso com "complete seu
  -- cadastro"); gravar o uid dele aqui estouraria a chave estrangeira.
  -- Sem cadastro, o pedido segue como visitante — que é exatamente o que
  -- este caminho já sabe tratar.
  if v_uid is not null then
    select c.name, c.phone, u.email
      into v_customer
      from public.customers c
      join auth.users u on u.id = c.id
     where c.id = v_uid;

    if found then
      v_customer_id := v_uid;
      v_snapshot := jsonb_build_object(
        'name', v_customer.name,
        'email', v_customer.email,
        'phone', v_customer.phone
      );
    end if;
  end if;

  insert into public.orders (
    customer_id, status, code, expires_at,
    subtotal, shipping, discount, total,
    payment_method, customer_snapshot
  )
  values (
    v_customer_id, 'aguardando_whatsapp', v_code, v_expires,
    0, 0, 0, 0,
    'whatsapp', v_snapshot
  )
  returning id into v_order_id;

  for v_raw in select * from jsonb_array_elements(p_items)
  loop
    v_qty := coalesce(nullif(v_raw->>'qty', '')::int, 0);
    if v_qty <= 0 then
      v_adjusted := true;
      continue;
    end if;
    if v_qty > 99 then
      v_qty := 99;
      v_adjusted := true;
    end if;

    select pv.id, pv.color, pv.size, pv.stock,
           p.id as product_id, p.name, p.price, p.slug
      into v_variant
      from public.product_variants pv
      join public.products p on p.id = pv.product_id
     where pv.id = (v_raw->>'variant_id')::uuid
       and p.status = 'active';

    -- Variação sumiu, ou o produto saiu do ar entre o "adicionar à
    -- sacola" e agora: a linha cai fora e a resposta avisa.
    if not found then
      v_adjusted := true;
      continue;
    end if;

    -- Não há reserva de estoque neste status, então isto é cortesia, não
    -- garantia: apara o pedido ao que existe hoje para a loja não mandar
    -- ao cliente uma mensagem prometendo o que não tem. A checagem que
    -- vale acontece de novo na confirmação.
    if v_variant.stock < v_qty then
      v_qty := greatest(v_variant.stock, 0);
      v_adjusted := true;
    end if;
    if v_qty <= 0 then
      continue;
    end if;

    insert into public.order_items (
      order_id, product_id, variant_id, name, color, size, unit_price, qty
    )
    values (
      v_order_id, v_variant.product_id, v_variant.id,
      v_variant.name, v_variant.color, v_variant.size, v_variant.price, v_qty
    );

    v_subtotal := v_subtotal + (v_variant.price * v_qty);
    v_items := v_items || jsonb_build_object(
      'name', v_variant.name,
      'slug', v_variant.slug,
      'color', v_variant.color,
      'size', v_variant.size,
      'qty', v_qty,
      'unit_price', v_variant.price
    );
  end loop;

  -- Nada sobrou de pé. A exception desfaz o insert do pedido junto — um
  -- pedido vazio com código queimado não ajuda ninguém.
  if jsonb_array_length(v_items) = 0 then
    raise exception 'NO_AVAILABLE_ITEMS';
  end if;

  -- Sem frete e sem cupom de propósito: este caminho não pede endereço e
  -- não passa pelo checkout. Frete e desconto são combinados na conversa
  -- e lançados pelo painel quando a venda é confirmada.
  update public.orders
     set subtotal = v_subtotal,
         total = v_subtotal
   where id = v_order_id;

  return jsonb_build_object(
    'order_id', v_order_id,
    'code', v_code,
    'expires_at', v_expires,
    'total', v_subtotal,
    'items', v_items,
    'adjusted', v_adjusted
  );
end;
$$;

revoke all on function public.create_whatsapp_order(jsonb) from public;
grant execute on function public.create_whatsapp_order(jsonb) to anon, authenticated;

-- ------------------------------------------------------------------
-- confirm_whatsapp_order(order_id) — "Confirmar venda"
-- ------------------------------------------------------------------
-- Uma transação: ou baixa o estoque de todas as variações e marca o
-- pedido como pago, ou não faz nada.
--
-- Diferente de fulfill_order_stock(), que é idempotente e ignora em
-- silêncio uma variação sem saldo (lá o pagamento já entrou, segurar a
-- venda seria pior), aqui a falta de estoque **aborta**: ninguém pagou
-- ainda, e o admin precisa saber que não pode vender antes de responder
-- ao cliente.
create or replace function public.confirm_whatsapp_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_expires timestamptz;
  v_item record;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  -- Trava a linha: dois cliques em "Confirmar venda" ao mesmo tempo
  -- viram uma confirmação e um NOT_PENDING, nunca duas baixas.
  select status, expires_at into v_status, v_expires
    from public.orders
   where id = p_order_id
     for update;

  if not found then
    raise exception 'NOT_FOUND';
  end if;

  if v_status <> 'aguardando_whatsapp' then
    raise exception 'NOT_PENDING';
  end if;

  if v_expires is not null and v_expires <= now() then
    -- Sem marcar 'expirado' aqui: a exception desfaria o update junto.
    -- Quem muda o status é expire_whatsapp_orders(), que roda ao abrir a
    -- aba — inclusive no reload que o painel faz depois deste erro.
    raise exception 'EXPIRED';
  end if;

  -- `order by variant_id` para que dois pedidos concorrentes que
  -- compartilham variações travem sempre na mesma ordem: sem isso, dois
  -- admins confirmando ao mesmo tempo podem se enroscar num deadlock.
  for v_item in
    select variant_id, qty, name
      from public.order_items
     where order_id = p_order_id
       and variant_id is not null
     order by variant_id
  loop
    update public.product_variants
       set stock = stock - v_item.qty
     where id = v_item.variant_id
       and stock >= v_item.qty;

    if not found then
      raise exception 'OUT_OF_STOCK:%', v_item.name;
    end if;
  end loop;

  update public.orders
     set status = 'paid',
         expires_at = null,
         -- Mesma trava de idempotência do webhook: com ela preenchida,
         -- mover o pedido depois para "em preparação"/"enviado" não
         -- dispara fulfill_order_stock() e não baixa o estoque de novo.
         stock_decremented_at = coalesce(stock_decremented_at, now())
   where id = p_order_id;
end;
$$;

revoke all on function public.confirm_whatsapp_order(uuid) from public;
grant execute on function public.confirm_whatsapp_order(uuid) to authenticated;

-- ------------------------------------------------------------------
-- cancel_whatsapp_order(order_id) — "Cancelar"
-- ------------------------------------------------------------------
-- Só age sobre pendentes: um pedido já confirmado teve estoque baixado e
-- cancelar sem devolver deixaria o saldo errado. Esse caso continua no
-- fluxo normal de Pedidos, não aqui.
create or replace function public.cancel_whatsapp_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  update public.orders
     set status = 'canceled',
         expires_at = null
   where id = p_order_id
     and status = 'aguardando_whatsapp';

  if not found then
    raise exception 'NOT_PENDING';
  end if;
end;
$$;

revoke all on function public.cancel_whatsapp_order(uuid) from public;
grant execute on function public.cancel_whatsapp_order(uuid) to authenticated;
