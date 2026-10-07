-- King Store — seed.sql (Cloudflare D1)
-- Brings a fresh database to a demo-ready state: site settings, 5
-- categories, 1 brand, 3 products with photos and variants (one on each
-- home rail), 1 active banner and a welcome coupon. Photos are picsum
-- placeholders — replace them from the admin panel.
--
-- No admin user here: create it with `npm run admin:create` (see README),
-- which hashes the password the same way the app does.
--
--   npm run db:seed:local     # .wrangler local database
--   npm run db:seed:remote    # production D1
--
-- Safe to run twice: every insert is INSERT OR IGNORE on a fixed id.

-- Selling promises (parcelas, Pix, selo "Novo", frases de troca/segurança)
-- are left empty on purpose: the store fills them in Configurações → Vitrine.
INSERT OR IGNORE INTO site_settings (id, store_name, shipping_note, free_shipping_note, free_shipping_threshold, low_stock_units, footer_payment_text, footer_security_text, footer_privacy_text)
VALUES (1, 'King Store', 'Envio em até 2 dias úteis após a confirmação do pagamento.', 'Frete grátis acima de R$ 399', 399, 3, 'Cartão, Pix e boleto', 'Compra segura', 'Dados protegidos');

INSERT OR IGNORE INTO categories (id, name, slug, position, active) VALUES
  ('11111111-1111-1111-1111-111111111101', 'Moletons', 'moletons', 1, 1),
  ('11111111-1111-1111-1111-111111111102', 'Camisetas', 'camisetas', 2, 1),
  ('11111111-1111-1111-1111-111111111103', 'Calças', 'calcas', 3, 1),
  ('11111111-1111-1111-1111-111111111104', 'Acessórios', 'acessorios', 4, 1),
  ('11111111-1111-1111-1111-111111111105', 'Calçados', 'calcados', 5, 1);

INSERT OR IGNORE INTO brands (id, name, slug, description, position, active) VALUES
  ('55555555-5555-5555-5555-555555555501', 'King Store', 'king-store', 'Linha própria da casa.', 1, 1);

-- search_text = name + brand + category, lowercase and without accents
-- (lib/search-text.ts); the app keeps it up to date on every save.
INSERT OR IGNORE INTO products (
  id, slug, name, short_description, description, price, compare_at_price,
  category_id, brand_id, badge, status, featured, position,
  weight_grams, length_cm, width_cm, height_cm, search_text
) VALUES
  ('22222222-2222-2222-2222-222222222201', 'moletom-oversized-essential', 'Moletom Oversized Essential',
   'Moletom peso pesado, corte oversized.',
   'Moletom em moletom peso pesado, corte oversized e acabamento emborrachado. Peça central do guarda-roupa de inverno, pensada para durar.',
   349.90, 399.90, '11111111-1111-1111-1111-111111111101', '55555555-5555-5555-5555-555555555501',
   'lancamento', 'active', 1, 1, 800, 35, 30, 8,
   'moletom oversized essential king store moletons'),
  ('22222222-2222-2222-2222-222222222202', 'camiseta-basica-premium', 'Camiseta Básica Premium',
   'Malha pesada 220g/m², modelagem reta.',
   'Camiseta de malha pesada 220g/m², modelagem reta e gola reforçada. A base de qualquer produção.',
   129.90, NULL, '11111111-1111-1111-1111-111111111102', '55555555-5555-5555-5555-555555555501',
   'mais_vendido', 'active', 1, 2, 300, 30, 25, 4,
   'camiseta basica premium king store camisetas'),
  ('22222222-2222-2222-2222-222222222203', 'calca-cargo-wide', 'Calça Cargo Wide',
   'Sarja pesada, caimento wide.',
   'Calça cargo em sarja pesada, caimento wide e bolsos utilitários. Referência street com acabamento premium.',
   349.90, 419.90, '11111111-1111-1111-1111-111111111103', '55555555-5555-5555-5555-555555555501',
   'oferta', 'active', 0, 3, 700, 40, 30, 6,
   'calca cargo wide king store calcas');

INSERT OR IGNORE INTO product_images (id, product_id, url, alt, position) VALUES
  ('66666666-6666-6666-6666-666666666101', '22222222-2222-2222-2222-222222222201', 'https://picsum.photos/seed/moletom-oversized-essential-1/1200/1500?grayscale', 'Frente', 0),
  ('66666666-6666-6666-6666-666666666102', '22222222-2222-2222-2222-222222222201', 'https://picsum.photos/seed/moletom-oversized-essential-2/1200/1500?grayscale', 'Costas', 1),
  ('66666666-6666-6666-6666-666666666201', '22222222-2222-2222-2222-222222222202', 'https://picsum.photos/seed/camiseta-basica-premium-1/1200/1500?grayscale', 'Frente', 0),
  ('66666666-6666-6666-6666-666666666202', '22222222-2222-2222-2222-222222222202', 'https://picsum.photos/seed/camiseta-basica-premium-2/1200/1500?grayscale', 'Costas', 1),
  ('66666666-6666-6666-6666-666666666301', '22222222-2222-2222-2222-222222222203', 'https://picsum.photos/seed/calca-cargo-wide-1/1200/1500?grayscale', 'Frente', 0),
  ('66666666-6666-6666-6666-666666666302', '22222222-2222-2222-2222-222222222203', 'https://picsum.photos/seed/calca-cargo-wide-2/1200/1500?grayscale', 'Costas', 1);

INSERT OR IGNORE INTO product_variants (id, product_id, color, color_hex, size, sku, stock) VALUES
  ('77777777-7777-7777-7777-777777777101', '22222222-2222-2222-2222-222222222201', 'Preto', '#0A0A0A', 'M', 'MOLETOM-OVERSIZED-ESSENTIAL-PRETO-M', 5),
  ('77777777-7777-7777-7777-777777777102', '22222222-2222-2222-2222-222222222201', 'Preto', '#0A0A0A', 'G', 'MOLETOM-OVERSIZED-ESSENTIAL-PRETO-G', 3),
  ('77777777-7777-7777-7777-777777777103', '22222222-2222-2222-2222-222222222201', 'Cinza', '#8A8A8A', 'M', 'MOLETOM-OVERSIZED-ESSENTIAL-CINZA-M', 2),
  ('77777777-7777-7777-7777-777777777201', '22222222-2222-2222-2222-222222222202', 'Branco', '#FFFFFF', 'P', 'CAMISETA-BASICA-PREMIUM-BRANCO-P', 10),
  ('77777777-7777-7777-7777-777777777202', '22222222-2222-2222-2222-222222222202', 'Branco', '#FFFFFF', 'M', 'CAMISETA-BASICA-PREMIUM-BRANCO-M', 10),
  ('77777777-7777-7777-7777-777777777203', '22222222-2222-2222-2222-222222222202', 'Preto', '#0A0A0A', 'M', 'CAMISETA-BASICA-PREMIUM-PRETO-M', 8),
  ('77777777-7777-7777-7777-777777777301', '22222222-2222-2222-2222-222222222203', 'Padrão', NULL, '40', 'CALCA-CARGO-WIDE-40', 4),
  ('77777777-7777-7777-7777-777777777302', '22222222-2222-2222-2222-222222222203', 'Padrão', NULL, '42', 'CALCA-CARGO-WIDE-42', 1);

INSERT OR IGNORE INTO banners (
  id, eyebrow, headline_line1, headline_line2, wordmark, cta_label, cta_href,
  image_url, featured_product_id, active, position
) VALUES (
  '44444444-4444-4444-4444-444444444401', 'COLEÇÃO 01 / INVERNO 2026', 'VISTA-SE', 'COMO UM REI.',
  'KING', 'COMPRAR AGORA →', '/colecao',
  'https://picsum.photos/seed/king-hero-bg/1920/1080?grayscale',
  '22222222-2222-2222-2222-222222222201', 1, 1
);

INSERT OR IGNORE INTO coupons (id, code, type, value, min_total, active) VALUES
  ('88888888-8888-8888-8888-888888888801', 'BEMVINDO10', 'percent', 10, 0, 1);
