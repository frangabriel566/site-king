# King Store

E-commerce completo (loja pública + painel administrativo) para uma loja
de roupa masculina. Next.js 15 (App Router) + Tailwind CSS v4 + shadcn/ui
+ Supabase (Postgres, Auth, Storage, RLS) + Vercel.

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
  padrão, Server Actions para toda mutação)
- **Tailwind CSS v4** + **shadcn/ui** (Radix + Lucide)
- **Supabase**: Postgres com RLS em toda tabela, Auth, Storage
- **Pagamento**: Mercado Pago Checkout Pro (padrão) ou WhatsApp (fallback),
  atrás de uma interface `PaymentProvider` — troca por env var
- **E-mail**: Resend (opcional — sem `RESEND_API_KEY`, o e-mail de
  confirmação simplesmente não é enviado, o resto do fluxo continua)
- **Vercel** para deploy

## Estrutura

```
app/(shop)/...        rotas públicas da loja
app/(admin)/admin/...  painel administrativo (login fora da shell autenticada)
app/api/webhooks/...   webhook do Mercado Pago
components/ui/         shadcn/ui
components/shop/       componentes da loja pública
components/admin/      componentes do painel
lib/supabase/          clientes Supabase (browser, server, admin/service-role, público sem cookies)
lib/data/               leituras tipadas (Server Components)
lib/actions/            Server Actions (toda escrita)
lib/validations/        schemas Zod
lib/payments/           PaymentProvider (Mercado Pago / WhatsApp) + webhook helpers
lib/whatsapp/           número da loja + mensagem da compra direta pelo WhatsApp
lib/cart/               Context do carrinho (localStorage)
supabase/migrations/    schema, RLS, funções, storage — nessa ordem
supabase/seed.sql       admin + categorias + produtos + banner + settings de demonstração
```

## Configuração local

1. Copie `.env.example` para `.env.local` e preencha com as credenciais do
   seu projeto Supabase (veja a seção seguinte) e, se for testar
   pagamento, do Mercado Pago.
2. `npm install`
3. `npm run dev` — abre em `http://localhost:3000`

> Sem um projeto Supabase real conectado, o site ainda builda e roda: as
> leituras públicas (`lib/data/*`) têm fallback para dados vazios em vez
> de derrubar a página, mas nada de auth/checkout/admin funciona de fato.
> Isso é intencional — ver `DECISIONS.md`, bloco "Hero e home".

## Configurando o projeto Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Rode **todos** os arquivos de `supabase/migrations/` em ordem numérica
   (`0001_schema.sql` → `0014_whatsapp_orders.sql`), pelo SQL Editor do
   painel Supabase ou via `supabase db push` com a CLI. A ordem importa:
   cada arquivo a partir do `0006` altera o que os anteriores criaram.
3. Rode `supabase/seed.sql` para popular o banco (1 admin, 4 categorias, 8
   produtos com variações e fotos placeholder, 1 banner ativo,
   configurações da loja, 1 cupom de boas-vindas). Isso sobe um ambiente
   novo do zero em poucos minutos.
   - Login do admin seedado: `admin@kingstore.com.br` / `KingStore#2026`
     — **troque essa senha imediatamente** depois do primeiro login em
     qualquer ambiente acessível por outra pessoa.
4. Em **Authentication → Settings**, desative a confirmação de e-mail
   obrigatória (ou aceite que o cadastro no checkout pode pedir para o
   cliente confirmar o e-mail antes de conseguir logar — o código já
   trata os dois casos, mas a experiência é mais fluida sem confirmação
   obrigatória).
5. Copie **Project URL**, **anon public key** e **service_role key** de
   **Settings → API** para `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`.
6. (Opcional, mas recomendado) Regenere `lib/database.types.ts` a partir
   do projeto real depois de linkar a CLI:
   ```bash
   supabase gen types typescript --linked > lib/database.types.ts
   ```
   O arquivo atual foi escrito à mão espelhando exatamente as migrations
   (não havia projeto Supabase real disponível durante a construção) —
   regenerar garante que ele nunca diverge do schema de verdade.

## Configurando pagamento

Escolha via `PAYMENT_PROVIDER` no `.env`:

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
  saldo de qualquer variação (`confirm_whatsapp_order`).
- **Pendentes expiram em 48h** e viram `expirado`. Não há cron: a
  varredura (`expire_whatsapp_orders`) roda ao abrir a aba do painel e a
  cada pedido novo, e confirmar um pedido vencido é recusado de qualquer
  forma.
- Não exige login — um visitante fecha pedido e se identifica na conversa.

## Padrões do projeto

- TypeScript estrito, zero `any`, zero `@ts-ignore`.
- RLS ativa em toda tabela (`is_admin()` como helper); leitura pública
  restrita a conteúdo ativo/publicado, escrita restrita a admin.
- `service_role` só em `lib/supabase/admin.ts` e só importado de arquivos
  `'use server'` (Server Actions, Route Handlers) — nunca em Client
  Components, nunca no bundle do navegador.
- Toda mutação é uma Server Action; nenhuma escrita via `fetch` client-side.
- Server Components por padrão; `"use client"` só onde há interatividade.
- `npm run build` e `npm run lint` devem terminar limpos antes de cada commit.

## Scripts

```bash
npm run dev     # desenvolvimento
npm run build   # build de produção (roda type-check + lint)
npm run start   # serve o build de produção
npm run lint    # eslint
```

## Deploy

Ver checklist completo no final da conversa/entrega do projeto, ou
resumidamente:

**Supabase**: projeto criado → migrations aplicadas na ordem → seed
rodado → confirmação de e-mail configurada → chaves copiadas.

**Vercel**: importar o repositório → colar todas as variáveis de
`.env.example` (com valores reais) em Project Settings → Environment
Variables → deploy → configurar o domínio final em
`NEXT_PUBLIC_SITE_URL` e redeploy (ele é usado para montar links de
retorno do Mercado Pago e URLs absolutas de metadata/sitemap) → registrar
a URL do webhook do Mercado Pago apontando para
`https://SEU_DOMINIO/api/webhooks/mercadopago`.
