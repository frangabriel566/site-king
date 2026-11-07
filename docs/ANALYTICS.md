# Analytics — eventos e painel

O que o site manda para o Google Analytics, de onde vem cada número do
**Painel → Analytics**, e o que precisa ser configurado fora do código.

## Fontes de dados

| Número no painel | Fonte | Atualização |
| --- | --- | --- |
| Pedidos iniciados, confirmados, pagamentos confirmados, faturamento, ticket médio | Banco D1 (`orders`) — a mesma regra de Relatórios | Na hora |
| Visitantes, sessões, páginas, produtos vistos, adições à sacola, checkouts, cliques no WhatsApp, fontes de tráfego, ranking de produtos | GA4 Data API (`runReport`) | Consolidado: minutos a algumas horas (até 48 h em alguns casos) |
| Tempo real (ativos em 5/30 min, eventos, páginas, localização) | GA4 Realtime API (`runRealtimeReport`) | A página consulta a cada 1 min |
| Taxa de conversão | Pedidos confirmados (D1) ÷ sessões (GA4) | Misto |

O painel nunca mostra número inventado: sem GA4 configurado (ou com erro),
os cartões do GA4 mostram “—” e um aviso explica o motivo. Clique no
WhatsApp nunca conta como venda.

## Eventos (dataLayer → GTM-WZ64DZLP → GA4 G-NPKKW846TD)

| Evento | Quando | Onde no código |
| --- | --- | --- |
| `view_item` | Página de produto aberta (1× por produto por visita à página) | `components/shop/buy-box.tsx` |
| `add_to_cart` | Item entra na sacola (qualquer botão) | `lib/cart/context.tsx` (`addItem`) |
| `begin_checkout` | Checkout aberto com sacola (1× por sacola por aba) | `components/shop/checkout-wizard.tsx` |
| `purchase` | Página do pedido mostra o pedido **confirmado no banco** (pago/confirmado); 1× por pedido por navegador | `components/shop/purchase-tracker.tsx` |
| `click_whatsapp` | Conversa com a loja aberta pelo site (`link_location`, `page_type`, `product_id`, `product_name`) | `components/shop/whatsapp-click-tracker.tsx` + botões de pedido |

Consentimento (LGPD): Consent Mode v2 começa **negado** e passa a
concedido quando o cliente toca em “Aceitar” no aviso de cookies
(`lib/analytics/consent.ts`). Os eventos levam só dados de produto e de
pedido — nada de nome, e-mail, telefone, CPF ou endereço.

## Configuração externa (uma vez)

### 1. GTM — fazer os eventos chegarem ao GA4

1. tagmanager.google.com → contêiner **GTM-WZ64DZLP** → Administrador →
   **Importar contêiner** → arquivo `docs/gtm/king-store-eventos.json` →
   espaço de trabalho atual → **Mesclar** → **Renomear tags, acionadores e
   variáveis conflitantes**.
2. Confira que o contêiner já tem a **Tag do Google** com o ID
   `G-NPKKW846TD` disparando em todas as páginas (é ela que carrega o GA4;
   as tags importadas só enviam os eventos). Se não houver, crie: Nova tag →
   Tag do Google → ID `G-NPKKW846TD` → acionador *Initialization - All Pages*.
3. **Visualizar** (Tag Assistant) em sitekingstore.com.br: abra um produto,
   adicione à sacola, abra o checkout e clique no WhatsApp — os eventos
   `view_item`, `add_to_cart`, `begin_checkout` e `click_whatsapp` devem
   disparar as tags importadas.
4. **Enviar** (publicar) o contêiner.

### 2. GA4 — dimensões do WhatsApp e evento-chave

1. analytics.google.com → Administrador → **Definições personalizadas** →
   Criar dimensões personalizadas (escopo **Evento**):
   `link_location`, `page_type`, `product_name`.
   Sem `link_location` o painel funciona, só não mostra “Cliques no
   WhatsApp por local”.
2. Administrador → **Eventos-chave**: marque `purchase` (normalmente já vem
   marcado) e, se quiser, `click_whatsapp`.

### 3. Google Cloud — permitir que o painel leia o GA4

1. console.cloud.google.com → crie (ou escolha) um projeto.
2. **APIs e serviços → Biblioteca** → ative **Google Analytics Data API**.
3. **IAM e administrador → Contas de serviço → Criar conta de serviço**
   (ex.: `painel-king-store`). Não precisa de papel no projeto.
4. Na conta criada → **Chaves → Adicionar chave → Criar nova chave → JSON**.
   O arquivo baixado é a credencial: guarde com cuidado, não envie por
   WhatsApp/e-mail e não coloque no código.
5. No GA4 → Administrador → **Gerenciamento de acesso da propriedade** →
   “+” → adicione o e-mail da conta de serviço
   (`...@...iam.gserviceaccount.com`) com papel **Leitor**.
6. No GA4 → Administrador → **Detalhes da propriedade** → copie o
   **ID DA PROPRIEDADE** (só números; não é o `G-...`).

### 4. Cloudflare — entregar a credencial ao Worker

dash.cloudflare.com → Workers & Pages → **site-king** → Settings →
**Variables and Secrets**:

- `GA4_PROPERTY_ID` (Text): o número do passo 3.6.
- `GA4_SERVICE_ACCOUNT_JSON` (**Secret**): cole o conteúdo inteiro do
  arquivo JSON do passo 3.4.

Salve (o Worker reinicia com os valores novos; não precisa de deploy). Abra
**Painel → Analytics**: o aviso amarelo some e os números do GA4 aparecem.
Se o Google recusar, o aviso diz o motivo (API desativada, sem acesso à
propriedade, ID errado).

## Limites respeitados

- Tempo real: 7 consultas por leitura, 1 leitura por minuto, só com a aba
  visível, e cache de 30 s compartilhado entre admins.
- Consolidado: 1 lote (5 relatórios) + 1 consulta por período, cache de 2 a
  5 min.
- Token OAuth reaproveitado por ~55 min.
