# King Store

E-commerce completo (loja pública + painel administrativo) para uma loja
de roupa masculina. Next.js 15 (App Router) + Tailwind CSS v4 + shadcn/ui,
rodando na **Cloudflare Workers** via OpenNext, com **D1** (banco),
**Better Auth** (login) e **Workers KV** (fotos).

Identidade visual: editorial dark, brutalista — preto e branco secos,
tipografia enorme, dourado só em três lugares (hover de link, badge de
promoção, foco de input).

Veja também:
- [`DECISIONS.md`](./DECISIONS.md) — todas as decisões de arquitetura e
  por quê, na ordem em que foram tomadas.
- [`docs/OPERACAO.md`](./docs/OPERACAO.md) — guia curto do dia a dia da
  loja: trocar banner, cadastrar produto, dar baixa em pedido.

## Stack

- **Next.js 15** (App Router, TypeScript estrito, Server Components por
  padrão, Server Actions para toda mutação), empacotado para Workers pelo
  **@opennextjs/cloudflare**
- **Tailwind CSS v4** + **shadcn/ui** (Radix + Lucide)
- **Cloudflare D1** (SQLite) com **Drizzle ORM**: schema em
  `lib/db/schema.ts`, migrations geradas pelo drizzle-kit
- **Better Auth** (e-mail e senha) sobre o mesmo D1; senha com PBKDF2
  nativo do Workers (`lib/auth/password.ts`)
- **Workers KV** para as fotos enviadas pelo painel, atrás de
  `lib/storage.ts` (trocar por R2 é mexer só nesse arquivo)
- **Pagamento**: Mercado Pago Checkout Pro (padrão) ou WhatsApp (fallback),
  atrás de uma interface `PaymentProvider` — troca por env var
- **E-mail**: Resend (opcional — sem `RESEND_API_KEY`, confirmação de
  pedido e "esqueci minha senha" simplesmente não enviam, o resto continua)

## Estrutura

```
app/(shop)/...         rotas públicas da loja
app/(admin)/admin/...  painel administrativo (login fora da shell autenticada)
app/api/auth/          endpoints do Better Auth (link de redefinir senha)
app/api/upload/        upload de fotos do painel → KV
app/img/[...key]/      serve as fotos do KV (cache longo, immutable)
app/api/webhooks/...   webhook do Mercado Pago
components/            ui (shadcn), shop, admin
lib/db/                schema Drizzle, cliente D1, helpers de batch/sequência
lib/auth/              Better Auth, hash de senha e as regras de acesso (guards)
lib/data/              leituras tipadas (Server Components)
lib/actions/           Server Actions (toda escrita)
lib/orders/            baixa de estoque e pedidos WhatsApp (transações em batch)
lib/storage.ts         put/get/delete das fotos (KV hoje, R2 amanhã)
lib/validations/       schemas Zod
lib/payments/          PaymentProvider (Mercado Pago / WhatsApp) + conciliação do webhook
drizzle/migrations/    SQL gerado pelo drizzle-kit, aplicado pelo wrangler
drizzle/seed.sql       categorias, marca, 3 produtos, banner, cupom, configurações
scripts/create-admin.mjs  cria ou promove a conta de administrador
```

## Configuração local

1. `npm install`
2. Copie `.env.example` para `.env.local` e preencha ao menos
   `BETTER_AUTH_SECRET` (o comando para gerar um está no arquivo).
3. Banco local (fica em `.wrangler/`, ignorado pelo git):
   ```bash
   npm run db:migrate:local
   npm run db:seed:local
   npm run admin:create -- --email voce@loja.com.br --name "Seu Nome"
   ```
   O script pede a senha (ou lê `ADMIN_PASSWORD`). Se o e-mail já tiver
   conta, ele vira admin e passa a usar a senha informada.
4. `npm run dev` — `http://localhost:3000`, com o D1 e o KV locais
   (`initOpenNextCloudflareForDev` no `next.config.ts`).
5. `npm run preview` — o build real de Workers, no `wrangler dev`
   (`http://localhost:8787`). É o que mais se parece com produção.

## Produção (Cloudflare)

Recursos (já criados): D1 `king-store-db` e KV `king-store-images`,
ligados em `wrangler.jsonc` como `DB` e `IMAGES_KV`.

1. Aplicar as migrations e o seed no D1 de produção:
   ```bash
   npm run db:migrate:remote
   npm run db:seed:remote     # opcional: dados de exemplo
   npm run admin:create -- --email voce@loja.com.br --name "Seu Nome" --remote
   ```
2. No painel do Worker `site-king` (repositório `frangabriel566/site-king`)
   → **Settings → Variables and Secrets**
   (as variáveis ficam só no painel; `keep_vars` no `wrangler.jsonc` impede
   que o deploy as apague):
   - secrets: `BETTER_AUTH_SECRET`, `MERCADOPAGO_ACCESS_TOKEN`,
     `MERCADOPAGO_WEBHOOK_SECRET`, `RESEND_API_KEY`, `MELHORENVIO_TOKEN`
   - variáveis: `BETTER_AUTH_URL` (o domínio final, ex.
     `https://www.kingstore.com.br`), `PAYMENT_PROVIDER`,
     `RESEND_FROM_EMAIL`, `MELHORENVIO_URL`, `MELHORENVIO_EMAIL`
3. Em **Settings → Build → Variables and secrets** (usadas no build):
   `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_WHATSAPP_NUMBER`.
4. Build command: `npx opennextjs-cloudflare build` — Deploy command:
   `npx opennextjs-cloudflare deploy`.
5. Registrar o webhook do Mercado Pago apontando para
   `https://SEU_DOMINIO/api/webhooks/mercadopago`.

Mudou o schema? Edite `lib/db/schema.ts`, rode `npm run db:generate` e
aplique com `db:migrate:local` / `db:migrate:remote`.

## Configurando pagamento

Escolha via `PAYMENT_PROVIDER`:

- **`mercadopago`** (padrão): preencha `MERCADOPAGO_ACCESS_TOKEN`. Para o
  webhook (`/api/webhooks/mercadopago`) funcionar, configure a mesma URL
  no painel do Mercado Pago (Suas integrações → Webhooks) e preencha
  `MERCADOPAGO_WEBHOOK_SECRET` com a chave secreta mostrada lá — sem ela,
  o webhook processa notificações sem validar assinatura (funciona, mas
  não é seguro para produção).
- **`whatsapp`**: preencha `NEXT_PUBLIC_WHATSAPP_NUMBER` (ou o WhatsApp em
  Configurações do painel, que tem prioridade). O checkout monta a
  mensagem do pedido e abre o `wa.me` correspondente.

### Compra direta pelo WhatsApp

Independente de `PAYMENT_PROVIDER`: havendo WhatsApp salvo em
Configurações, a página de produto e a sacola ganham **"Comprar pelo
WhatsApp"**. O botão grava um pedido com status `aguardando_whatsapp` e
código sequencial próprio (`#KS0001`) e abre a conversa já com o código,
os itens (nome, cor, tamanho, quantidade, preço), o link de cada produto
e o total.

- **Não reserva estoque.** A baixa acontece só em **Pedidos WhatsApp →
  Confirmar venda**, numa transação que recusa o pedido inteiro se faltar
  saldo de qualquer variação (`lib/orders/whatsapp.ts`).
- **Pendentes expiram em 48h** e viram `expirado`. Não há cron: a
  varredura roda ao abrir a aba do painel e a cada pedido novo, e
  confirmar um pedido vencido é recusado de qualquer forma.
- Não exige login — um visitante fecha pedido e se identifica na conversa.

## Padrões do projeto

- TypeScript estrito, zero `any`, zero `@ts-ignore`.
- **Sem RLS no D1: as regras de acesso são código**, centralizadas em
  `lib/auth/guards.ts` — `requireAdmin()` em toda Action/rota de admin,
  `requireAdminPage()` em toda página e loader do painel, `requireUser()`
  e filtro por `user.id` em tudo que é do cliente. Leitura pública só de
  conteúdo ativo/publicado.
- Escrita com mais de um statement vai num `batch` do D1 (atômico); o D1
  aceita no máximo 100 parâmetros por statement (`insertChunks`).
- Toda mutação é uma Server Action; nenhuma escrita via `fetch`
  client-side (exceção: o upload de foto, que vai para `/api/upload`).
- Server Components por padrão; `"use client"` só onde há interatividade.
- `npm run build` e `npm run lint` devem terminar limpos antes de cada commit.

## Scripts

```bash
npm run dev               # desenvolvimento (D1/KV locais)
npm run build             # next build (type-check + lint)
npm run preview           # build de Workers + wrangler dev
npm run deploy            # build de Workers + deploy
npm run cf-typegen        # tipos dos bindings (cloudflare-env.d.ts)
npm run db:generate       # nova migration a partir do schema
npm run db:migrate:local  # aplica migrations no D1 local
npm run db:migrate:remote # aplica migrations no D1 de produção
npm run db:seed:local     # dados de exemplo no D1 local
npm run db:seed:remote    # dados de exemplo no D1 de produção
npm run admin:create      # cria/promove admin (--remote para produção)
npm run lint              # eslint
```
