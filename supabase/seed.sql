-- King Store — seed.sql
-- Brings a fresh project to a demo-ready state: 1 admin, 4 categories,
-- 8 products with variants/images, 1 active banner, site settings and
-- one welcome coupon. Product photography is placeholder (picsum,
-- grayscale) — swap for real assets from the admin panel.
--
-- IMPORTANT: the seeded admin password below is a placeholder for a
-- fresh dev/staging environment only. Change it immediately after the
-- first login in any environment that is reachable by anyone else.

-- ------------------------------------------------------------------
-- Admin user (auth.users + auth.identities + profiles.role)
-- ------------------------------------------------------------------
do $$
declare
  v_admin_id uuid := '33333333-3333-3333-3333-333333333301';
begin
  if not exists (select 1 from auth.users where id = v_admin_id) then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, last_sign_in_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_admin_id,
      'authenticated',
      'authenticated',
      'admin@kingstore.com.br',
      crypt('KingStore#2026', gen_salt('bf')),
      now(), now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      now(), now(),
      '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      v_admin_id,
      v_admin_id::text,
      format('{"sub":"%s","email":"%s"}', v_admin_id, 'admin@kingstore.com.br')::jsonb,
      'email', now(), now(), now()
    );
  end if;

  update public.profiles set role = 'admin' where id = v_admin_id;
end $$;

-- ------------------------------------------------------------------
-- Categories
-- ------------------------------------------------------------------
insert into public.categories (id, name, slug, position, active) values
  ('11111111-1111-1111-1111-111111111101', 'Moletons', 'moletons', 1, true),
  ('11111111-1111-1111-1111-111111111102', 'Camisetas', 'camisetas', 2, true),
  ('11111111-1111-1111-1111-111111111103', 'Calças', 'calcas', 3, true),
  ('11111111-1111-1111-1111-111111111104', 'Acessórios', 'acessorios', 4, true)
on conflict (id) do nothing;

-- ------------------------------------------------------------------
-- Products
-- ------------------------------------------------------------------
insert into public.products (id, slug, name, description, price, compare_at_price, category_id, status, featured, position) values
  ('22222222-2222-2222-2222-222222222201', 'moletom-oversized-essential',
   'Moletom Oversized Essential',
   'Moletom em moletom peso pesado, corte oversized e acabamento emborrachado. Peça central do guarda-roupa de inverno, pensada para durar.',
   349.90, 399.90, '11111111-1111-1111-1111-111111111101', 'active', true, 1),

  ('22222222-2222-2222-2222-222222222202', 'moletom-careca-slim',
   'Moletom Careca Slim',
   'Moletom sem capuz, caimento slim e gola careca reforçada. Algodão penteado 100%, para o dia a dia sem esforço.',
   289.90, null, '11111111-1111-1111-1111-111111111101', 'active', false, 2),

  ('22222222-2222-2222-2222-222222222203', 'camiseta-basica-premium',
   'Camiseta Básica Premium',
   'Camiseta de malha pesada 220g/m², modelagem reta e gola reforçada. A base de qualquer produção.',
   129.90, null, '11111111-1111-1111-1111-111111111102', 'active', true, 3),

  ('22222222-2222-2222-2222-222222222204', 'camiseta-manga-longa-ribbed',
   'Camiseta Manga Longa Ribbed',
   'Manga longa em malha ribana, punho justo e caimento justo ao corpo. Camada essencial para compor looks de inverno.',
   159.90, 189.90, '11111111-1111-1111-1111-111111111102', 'active', false, 4),

  ('22222222-2222-2222-2222-222222222205', 'calca-cargo-wide',
   'Calça Cargo Wide',
   'Calça cargo em sarja pesada, caimento wide e bolsos utilitários. Referência street com acabamento premium.',
   349.90, null, '11111111-1111-1111-1111-111111111103', 'active', true, 5),

  ('22222222-2222-2222-2222-222222222206', 'calca-alfaiataria-reta',
   'Calça Alfaiataria Reta',
   'Calça de alfaiataria em tecido de queda fluida, corte reto e cintura alta. Da rua ao jantar sem trocar de roupa.',
   389.90, 449.90, '11111111-1111-1111-1111-111111111103', 'active', false, 6),

  ('22222222-2222-2222-2222-222222222207', 'bone-aba-reta-king',
   'Boné Aba Reta King',
   'Boné aba reta em sarja encorpada, bordado em alto relevo e regulagem em fivela metálica.',
   129.90, null, '11111111-1111-1111-1111-111111111104', 'active', false, 7),

  ('22222222-2222-2222-2222-222222222208', 'cinto-couro-legitimo',
   'Cinto Couro Legítimo',
   'Cinto em couro legítimo curtido naturalmente, fivela em metal escovado. Acompanha caixa da marca.',
   179.90, null, '11111111-1111-1111-1111-111111111104', 'active', false, 8)
on conflict (id) do nothing;

-- ------------------------------------------------------------------
-- Product images (3 per product, grayscale placeholders)
-- ------------------------------------------------------------------
insert into public.product_images (product_id, url, alt, position)
select p.id, img.url, p.name, img.position
from public.products p
join lateral (
  values
    ('https://picsum.photos/seed/' || p.slug || '-1/1200/1500?grayscale', 0),
    ('https://picsum.photos/seed/' || p.slug || '-2/1200/1500?grayscale', 1),
    ('https://picsum.photos/seed/' || p.slug || '-3/1200/1500?grayscale', 2)
) as img(url, position) on true
where not exists (select 1 from public.product_images pi where pi.product_id = p.id);

-- ------------------------------------------------------------------
-- Product variants (color x size). One size per product is left at
-- zero stock on purpose, to exercise the "sold out but still listed,
-- struck through" UI on the product page.
-- ------------------------------------------------------------------
insert into public.product_variants (product_id, color, color_hex, size, sku, stock)
select p.id, v.color, v.color_hex, v.size,
       -- last 3 chars of the (fixed, per-product) id are unique by
       -- construction here, unlike a truncated slug prefix which can
       -- collide between similarly-named products (e.g. two "moletom-*").
       upper(right(p.id::text, 3)) || '-' || upper(left(v.color, 3)) || '-' || v.size,
       v.stock
from public.products p
join lateral (
  values
    ('Preto', '#0A0A0A', 'P', 12),
    ('Preto', '#0A0A0A', 'M', 18),
    ('Preto', '#0A0A0A', 'G', 15),
    ('Preto', '#0A0A0A', 'GG', 0),
    ('Off-White', '#EDEBE4', 'P', 8),
    ('Off-White', '#EDEBE4', 'M', 10),
    ('Off-White', '#EDEBE4', 'G', 6),
    ('Off-White', '#EDEBE4', 'GG', 4)
) as v(color, color_hex, size, stock) on true
where not exists (select 1 from public.product_variants pv where pv.product_id = p.id);

-- ------------------------------------------------------------------
-- Banner (active) — wordmark falls back to reduced opacity, since no
-- cutout_url is seeded. Upload a real PNG cutout from the admin panel.
-- ------------------------------------------------------------------
insert into public.banners (
  id, eyebrow, headline_line1, headline_line2, wordmark, cta_label, cta_href,
  image_url, cutout_url, featured_product_id, active, position
) values (
  '44444444-4444-4444-4444-444444444401',
  'COLEÇÃO 01 / INVERNO 2026',
  'VISTA-SE',
  'COMO UM REI.',
  'KING',
  'COMPRAR AGORA →',
  '/colecao',
  'https://picsum.photos/seed/king-hero-bg/1920/1080?grayscale',
  null,
  '22222222-2222-2222-2222-222222222201',
  true,
  1
)
on conflict (id) do nothing;

-- ------------------------------------------------------------------
-- Site settings (single row)
-- ------------------------------------------------------------------
insert into public.site_settings (
  id, store_name, logo_url, whatsapp, email, instagram, tiktok, youtube,
  shipping_note, free_shipping_note, announcement, announcement_active
) values (
  1, 'King Store', null, '5511999999999', 'contato@kingstore.com.br',
  '@kingstore', '@kingstore', '@kingstore',
  'Envios para todo o Brasil em até 2 dias úteis',
  'Frete grátis acima de R$ 399',
  'FRETE GRÁTIS ACIMA DE R$ 399 · USE O CUPOM BEMVINDO10 NA PRIMEIRA COMPRA',
  true
)
on conflict (id) do update set
  store_name = excluded.store_name,
  whatsapp = excluded.whatsapp,
  email = excluded.email,
  instagram = excluded.instagram,
  tiktok = excluded.tiktok,
  youtube = excluded.youtube,
  shipping_note = excluded.shipping_note,
  free_shipping_note = excluded.free_shipping_note,
  announcement = excluded.announcement,
  announcement_active = excluded.announcement_active;

-- ------------------------------------------------------------------
-- Welcome coupon, matches the announcement bar copy above
-- ------------------------------------------------------------------
insert into public.coupons (code, type, value, min_total, active, expires_at)
values ('BEMVINDO10', 'percent', 10, 0, true, null)
on conflict (code) do nothing;
