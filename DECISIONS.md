# DECISIONS.md — King Store

Registro das decisões de arquitetura tomadas durante a construção do projeto,
na ordem em que foram feitas. Cada entrada documenta a ambiguidade encontrada
e a opção mais simples escolhida para resolvê-la.

## Bloco 0 — Ferramental

- **Git não estava instalado no ambiente.** Instalado via `winget install
  Git.Git` para permitir versionamento e commits por bloco, conforme pedido.
- **Diretório de trabalho continha espaços no caminho**
  (`site king store`), e o nome de diretório não é um nome de pacote npm
  válido. O projeto foi criado em uma subpasta temporária
  (`king-store-app`) e movido para a raiz; `package.json.name` foi ajustado
  para `king-store`.
- **Next.js 15 pinado explicitamente.** `create-next-app@latest` instala a
  major mais recente (16.x) por padrão; o pedido especifica Next.js 15, então
  `next` e `eslint-config-next` foram fixados em `15.5.25` (última patch
  estável da série 15.5 no momento da criação).
- **Vulnerabilidade transitiva aceita.** `next@15.5.25` depende de uma versão
  do PostCSS com CVEs conhecidos (XSS em stringify / leitura de arquivo via
  `sourceMappingURL`). O único fix é migrar para Next 16, o que contraria o
  requisito explícito de Next.js 15. Risco aceito: PostCSS roda apenas em
  build-time sobre CSS do próprio repositório, não sobre input de usuário —
  não há superfície de ataque em produção. Reavaliar quando o Next 15 receber
  um patch com PostCSS corrigido.
- **`eslint.config.mjs` reescrito com `FlatCompat`.** O template gerado por
  `create-next-app` (voltado à v16 do `eslint-config-next`) importava
  `eslint-config-next/core-web-vitals` como array de configs flat prontas;
  na v15.5.x o pacote ainda exporta configs no formato legado (`extends`
  string). Ajustado para o padrão oficial do Next 15
  (`@eslint/eslintrc`'s `FlatCompat` + `compat.extends(...)`).
- **shadcn/ui inicializado com preset "Nova"** (`base: radix`,
  `css-variables: true`, `--no-pointer`). É a base de componentes RSC-first
  com Radix + Lucide, compatível com Server Components por padrão.
- **Componente `form` do shadcn não está disponível nesta geração do CLI**
  (apenas via preset específico). Em vez de copiar manualmente uma
  implementação incerta, os formulários (admin e checkout) usam
  `react-hook-form` + `zodResolver` diretamente, com os primitivos `Input`/
  `Label`/`Select` do shadcn e mensagens de erro renderizadas à mão. Mais
  simples e sem dependência de uma API interna não testada.
- **`next-themes` removido do componente `sonner.tsx` gerado.** A loja é
  estritamente dark (sem alternância de tema), então o `Toaster` foi fixado
  em `theme="dark"` sem depender de um pacote de tema não usado em nenhum
  outro lugar do projeto.

## Bloco 0 — Design tokens

- **Colisão de nomes entre o token de marca `--muted` (cor de texto
  `#8A8A8A`) e a variável semântica do shadcn `--muted` (cor de fundo de
  superfícies "muted").** Resolvido mapeando `--color-muted-foreground` do
  shadcn para o token de marca `--muted` (uso idêntico: texto discreto) e
  criando uma variável interna separada `--surface-muted` para o
  preenchimento de fundo que o shadcn espera em `--color-muted`. O token
  `--muted: #8A8A8A` continua existindo literalmente em `globals.css` como
  pedido.
- **`--accent` (dourado) não foi ligado ao hover genérico de menus/dropdowns
  do shadcn.** O pedido restringe o dourado a link hover, badge de promoção
  e foco de input. Hover de itens de menu/dropdown usa uma superfície neutra
  escura (`--surface-hover`, `#1A1A1A`) para não violar a regra de "zero
  cor" da identidade visual. O dourado está disponível como
  `--color-gold` / `var(--accent)` para os três usos permitidos, incluindo
  `--ring` (foco de input).
- **`--radius: 0rem` global.** Toda a escala de radius do shadcn
  (`sm/md/lg/xl/2xl/3xl/4xl`) deriva de `--radius`; zerando a variável base
  satisfaz "sem arredondamento" em todos os componentes automaticamente, sem
  precisar tocar em cada componente individualmente.
- **Fonte única: Archivo (via `next/font/google`), pesos 400–900.** O pedido
  permite Inter ou Archivo; Archivo foi escolhida por ter um peso 800/900
  genuíno e um caráter geométrico mais alinhado ao "brutalista, caro" pedido
  para o wordmark gigante do hero. Usada tanto para display quanto para UI,
  evitando carregar duas famílias tipográficas.
- **Cores semânticas (vermelho/verde/âmbar) autorizadas apenas dentro do
  `/admin`**, para status de pedido, alerta de estoque baixo etc. A restrição
  de "zero gradientes coloridos / base preto e branco" da identidade visual
  se aplica à vitrine pública; o painel administrativo é uma ferramenta de
  operação interna e precisa de sinalização de status legível.

## Bloco 3 — Hero e home

- **Cliente Supabase "público" separado do cliente com sessão.**
  `lib/supabase/server.ts` chama `cookies()` para acompanhar a sessão do
  usuário — mas no App Router, qualquer chamada a `cookies()` força a rota
  inteira para renderização dinâmica, mesmo quando os dados lidos não
  dependem de sessão nenhuma. Isso quebrava o requisito de
  `generateStaticParams + ISR` na PDP e o ISR da home. Criado
  `lib/supabase/public.ts` (`createPublicClient()`), sem `cookies()`, usado
  por todas as leituras 100% públicas (produtos, categorias, banners,
  site_settings) — a RLS dessas tabelas já não depende de `auth.uid()`
  para o caminho público, então não há perda de segurança, só de
  acoplamento desnecessário à sessão.
- **Leituras públicas envolvidas em `safeQuery` com fallback.** Uma
  instabilidade pontual do Supabase (ou, neste ambiente sem projeto Supabase
  real conectado, a ausência de credenciais) não deve derrubar o build
  estático nem a renderização da loja — "o site nunca pode aparecer vazio"
  vale também para falhas de rede, não só para banco vazio. Cada função em
  `lib/data/*` faz fallback para lista vazia / `null` / configurações
  padrão e loga o erro no servidor.
- **`.env.local` deste sandbox usa credenciais placeholder, não reais.**
  Não há projeto Supabase provisionado neste ambiente de desenvolvimento;
  os valores em `.env.local` (gitignored) existem só para permitir rodar
  `next build`/`next dev` localmente e validar que a aplicação renderiza
  corretamente em modo de fallback. Popule com as credenciais reais do seu
  projeto antes de usar auth, checkout ou o painel admin — ver checklist de
  deploy no README.
- **Bloco editorial da home usa a primeira categoria ativa + foto de um
  produto dela**, em vez de um parágrafo de texto de marca fixo. A regra
  "nenhum texto de vitrine hardcoded" cobre explicitamente frases,
  headline e wordmark; um parágrafo editorial persuasivo seria exatamente
  esse tipo de "frase" hardcoded. Nome da categoria (banco) + link "Ver
  coleção →" (rótulo de UI, não copy de marca) evita inventar prosa fixa
  sem precisar de uma tabela nova só para isso.
- **Seção de newsletter da home sem subtítulo de marketing.** Pelo mesmo
  motivo acima: manter só o rótulo "Newsletter" (label de seção, como
  "Buscar"/"Conta"/"Sacola" no header) e o formulário, sem frase de
  vendas hardcoded.
- **Tabela `newsletter_subscribers` adicionada em `0005_newsletter.sql`.**
  Não estava no schema pedido, mas a home exige um bloco de newsletter
  funcional — sem uma tabela, o formulário seria decorativo. Mantida como
  migration separada para não misturar com o schema original, com RLS:
  insert público, select só admin.
- **CTA "ADICIONAR À SACOLA →" do card de produto em destaque do Hero faz
  quick-add real**, usando a primeira variação com estoque do produto
  (buscada no servidor). Se nenhuma variação tiver estoque, o botão vira
  um link para a PDP ("Ver produto →") em vez de adicionar um item
  indisponível. Evita forçar o cliente a escolher cor/tamanho a partir de
  um card que não tem espaço para essa UI, sem quebrar a promessa do rótulo
  quando há estoque de sobra.

## Bloco 4 — Catálogo e produto

- **Filtros de `/colecao` são um componente cliente que só escreve na URL**
  (via `router.push`, sem `scroll: false`… com `scroll: false`, para não
  pular a página a cada clique); a leitura e a query ao banco continuam
  100% no Server Component da página, a partir de `searchParams`. Isso
  cumpre "filtro é URL, não estado" sem duplicar a lógica de filtro em dois
  lugares.
- **Paginação implementada como Server Component com `<Link>` simples**, em
  vez dos primitivos `Pagination`/`PaginationLink` do shadcn (que renderizam
  `<a>` puro dentro de um `Button asChild`). Usar `next/link` diretamente dá
  prefetch e navegação client-side; os primitivos do shadcn foram
  instalados mas não usados aqui.
- **Zoom da galeria é CSS puro (`transform: scale` + `transform-origin`
  seguindo o mouse), sem biblioteca de zoom dedicada.** O swipe mobile usa
  `embla-carousel-react` (já necessário para outros carrosséis). Evita mais
  uma dependência só para o hover-zoom do desktop.
- **Guia de medidas é uma tabela de medidas corporais genérica, hardcoded no
  componente.** É conteúdo de referência utilitário (não "vitrine" — não é
  copy de marca nem preço/estoque), então não precisa vir do banco; não há
  tabela de guia de medidas no schema pedido e criar uma só para isso seria
  desproporcional ao requisito.
- **Acordeão "Trocas e devoluções" da PDP mostra uma linha curta fixa +
  link para `/trocas-e-devolucoes`**, em vez de duplicar o conteúdo da
  política inteira em cada produto. A política completa mora em uma única
  página, que é a fonte de verdade.

## Bloco 5 — Auth e painel administrativo

- **Rotas autenticadas do admin isoladas em `app/(admin)/admin/(dashboard)/`**,
  um route group separado de `admin/login`. O layout com sidebar só deve
  envolver as telas internas — login precisa renderizar sem a shell
  autenticada (e sem checar sessão, senão vira loop de redirecionamento).
- **Toda Server Action de escrita do admin chama `requireAdmin()`
  independentemente do middleware.** O middleware barra a navegação para
  `/admin/*`, mas uma Server Action pode ser invocada diretamente; a
  autorização real tem que estar na própria mutação, não só na borda —
  defesa em profundidade, não redundância.
- **Upload de mídia sempre passa por `sharp` no servidor**, convertendo
  para WebP (qualidade 82, redimensionado a no máx. 2400px de largura)
  antes de gravar no bucket `media`. O cliente nunca fala direto com o
  Storage — a Server Action valida tipo/tamanho do arquivo e usa o cliente
  Supabase da sessão do admin (RLS já permite escrita a quem é
  `is_admin()`; não precisou de service role para isso).
- **Cutout de banner também vira WebP.** WebP preserva canal alfa
  nativamente, então a conversão não quebra a transparência do recorte do
  modelo — não foi necessário abrir exceção de formato para PNG.
- **Preview ao vivo do hero reaproveita o componente `<Hero>` real do
  site**, alimentado pelo estado local do formulário (não pelos dados
  salvos), dentro de um `<CartProvider>` local só para o botão "adicionar
  à sacola" do preview não quebrar (ele não tem provider de carrinho no
  layout do admin). Escala via CSS (`transform: scale`) dentro de um
  container com altura fixa e `overflow-hidden`, já que o Hero real usa
  `100svh` e não daria pra encaixar em um card do painel sem isso.
- **Editar um produto substitui imagens e variações por completo
  (delete + insert)**, em vez de fazer diff item a item. Mais simples de
  implementar corretamente que reconciliar arrays por id, e seguro porque
  `order_items` guarda snapshot próprio — apagar uma variação antiga não
  apaga nem corrompe pedidos já feitos (a FK é `on delete set null`).
- **Reordenação de imagens do produto é drag-and-drop nativo do HTML5**
  (`draggable` + `onDragStart/onDragOver/onDrop`), sem biblioteca extra —
  suficiente para reordenar alguns cartões numa grade.
- **Estoque incluído neste bloco, não no bloco de pedidos/clientes/cupons.**
  É extensão direta do modelo de variações que acabou de ser construído em
  Produtos (mesma tabela, mesmo formulário de edição inline); antecipar
  evita reabrir os mesmos arquivos depois.

## Bloco 6 — Carrinho, conta e checkout

- **Checkout exige conta (login ou cadastro) no passo "dados", em vez de
  aceitar guest checkout.** O schema pede telefone e data de nascimento
  obrigatórios no cadastro do cliente, e a RLS de `orders`/`addresses` é
  literalmente "cliente lê e cria os próprios" (`customer_id = auth.uid()`).
  Aceitar pedidos sem conta exigiria ou burlar essa RLS com service role em
  todo pedido, ou uma segunda tabela de "convidado" fora do schema pedido.
  Exigir conta é a opção mais simples que satisfaz a RLS como está escrita
  — e o cadastro já é rápido (nome, e-mail, senha, telefone, nascimento)
  dentro do próprio passo 1, sem sair do checkout.
- **Ações de login/cadastro têm duas variantes: "page" (redireciona para
  `/conta`) e "embedded" (não redireciona, só retorna sucesso).** Reusar a
  action de `/conta` dentro do checkout faria o `redirect("/conta")`
  tirar o cliente do fluxo de compra no meio do passo 1. A variante
  embedded devolve o controle pro componente cliente, que avança para o
  passo 2 sem sair da página.
- **Criação da linha em `customers` no cadastro usa o cliente
  service-role, não o cliente da sessão.** Dependendo da configuração do
  projeto Supabase, `auth.signUp()` pode não devolver uma sessão
  imediatamente (confirmação de e-mail pendente) — sem sessão, `auth.uid()`
  é nulo e o insert em `customers` esbarraria na própria RLS que exige
  `id = auth.uid()`. Usar o service role só para essa gravação pontual,
  logo após um `signUp()` que já validou o usuário, evita depender de uma
  configuração do projeto que não controlo a partir do código.
- **Confirmação de pedido (`/pedido/[id]`) lê com o cliente service-role,
  não com RLS de sessão.** O id do pedido é um UUID não adivinhável — é o
  mesmo modelo de confiança que qualquer link de confirmação de pedido de
  e-commerce usa. Isso também permite abrir o link de confirmação em outro
  dispositivo/aba sem estar logado nele.
- **`reviseCartAction` recalcula preço e estoque a partir do banco antes de
  cada etapa relevante do checkout** (ao entrar na página e de novo dentro
  de `createOrderAction`), e o resumo do pedido é renderizado a partir
  desse resultado — nunca dos valores guardados no `localStorage`. Se um
  item ficou sem estoque ou mudou de preço entre a sacola e o checkout, o
  cliente vê a quantidade ajustada antes de pagar.
- **Cupom nunca é validado no cliente.** `applyCouponAction` chama a
  função `validate_coupon` do Postgres (criada no bloco de banco), então a
  tabela `coupons` nunca precisa ser lida diretamente pelo navegador — só
  o resultado (desconto calculado) trafega.
- **Frete é uma tabela fixa de duas opções (`padrão`/`expressa`) definida
  em `lib/constants.ts`, com frete grátis acima de R$ 399.** O pedido não
  detalha integração com transportadora nem cálculo por CEP/peso; uma
  tabela fixa é a opção mais simples que atende ao passo "frete" do
  checkout.
- **Endereço do checkout é sempre salvo em `addresses`** (e marcado padrão
  se for o primeiro), além de gravado como snapshot em
  `orders.shipping_address`. Assim o cliente já vê o endereço na aba
  "Endereços" da conta sem precisar cadastrá-lo de novo, e o pedido
  mantém seu próprio retrato do endereço mesmo que o cadastro mude depois.
- **Pagamento (Mercado Pago/WhatsApp) ainda não é acionado ao final do
  checkout neste bloco** — `createOrderAction` cria o pedido com
  `status='pending'` e redireciona para `/pedido/[id]`. A integração real
  com o provedor de pagamento é o próximo bloco ("pagamento e webhook"),
  que vai trocar esse redirecionamento final por a preferência do Mercado
  Pago ou o link do WhatsApp.

## Bloco 7 — Pagamento e webhook

- **`PaymentProvider` é uma interface com duas implementações
  (`MercadoPagoProvider`, `WhatsAppProvider`) selecionadas por
  `PAYMENT_PROVIDER`**, chamada de dentro de `createOrderAction` logo após
  o pedido e os itens serem gravados. Se a chamada ao provedor falhar (ex.:
  token do Mercado Pago ausente), a Server Action ainda retorna sucesso
  com `payment: null` — o pedido já existe e fica acessível em
  `/pedido/[id]`, então uma falha de rede ao criar a preferência de
  pagamento não derruba um pedido que já foi persistido.
- **Assinatura do webhook validada manualmente** (`x-signature` /
  `x-request-id` + HMAC-SHA256 do manifesto `id:...;request-id:...;ts:...;`
  contra `MERCADOPAGO_WEBHOOK_SECRET`), replicando o algoritmo documentado
  pelo Mercado Pago — o SDK oficial não expõe um helper de verificação de
  assinatura pronto. Testado isoladamente com um script ad-hoc antes de
  integrar (assinatura válida passa, secret errado/dataId adulterado/
  assinatura ausente todos falham).
- **Idempotência do webhook em duas camadas.** (1) O handler HTTP checa o
  `status` atual do pedido antes de fazer qualquer coisa — se já está
  `paid`/`processing`/`shipped`/`delivered`, responde 200 sem reprocessar.
  (2) A função `fulfill_order_stock` no Postgres (bloco de banco) também é
  idempotente por si só via `orders.stock_decremented_at`. Duas camadas
  porque o webhook pode, em teoria, ser chamado fora de ordem ou por um
  caminho diferente no futuro — a garantia real de "não duplicar baixa de
  estoque" mora no banco, não no handler HTTP.
- **Webhook sempre usa o cliente service-role.** Não existe sessão de
  usuário numa notificação de servidor para servidor do Mercado Pago; o
  RLS de `orders`/`order_items` não tem (nem deveria ter) uma policy que
  cubra esse caso.
- **E-mail de confirmação via Resend, silenciosamente desativado sem
  `RESEND_API_KEY`.** Some caso a chave não esteja configurada, e uma
  falha de envio é logada mas não derruba o processamento do webhook — o
  pedido já foi marcado como pago antes do e-mail ser sequer tentado, e um
  problema no provedor de e-mail não pode fazer o Mercado Pago achar que o
  webhook falhou e reenviar indefinidamente.

## Bloco 8 — Pedidos, clientes, cupons e dashboard

- **Impressão do pedido reaproveita a própria página de detalhe** com
  `window.print()` e classes `print:hidden` na sidebar e nos controles do
  formulário de status, em vez de uma rota/PDF dedicados. O conteúdo que
  sobra ao imprimir (itens, cliente, endereço, pagamento) já é exatamente
  o que uma via impressa de pedido precisa.
- **Busca de pedidos aceita número do pedido OU nome do cliente no mesmo
  campo** — se o termo digitado é numérico, filtra por `order_number`
  exato; senão, faz `ilike` em `customer_snapshot->>name`. Evita dois
  campos de busca separados para um caso de uso simples.
- **`revalidatePath("/", "layout")` em vez de `revalidatePath("/")`** nas
  actions de categorias, banners e configurações. Header/Footer moram no
  layout de `(shop)`, compartilhado por todas as rotas da loja — revalidar
  só `"/"` deixaria páginas estáticas como `/produto/[slug]` servindo nav/
  rodapé desatualizados até o próximo ISR natural.
- **Dashboard define "vendas" como pedidos com status `paid`, `processing`,
  `shipped` ou `delivered`** (exclui `pending` e `canceled`) tanto para
  vendas do dia/mês quanto para o ticket médio. Pedido pendente de
  pagamento não é venda ainda; cancelado nunca foi.
- **Gráfico de 30 dias é `recharts` puro, sem o wrapper `ChartContainer` do
  shadcn.** O wrapper padroniza tema/legenda para múltiplas séries; aqui é
  uma série única (receita/dia) com paleta da marca (dourado sobre fundo
  escuro) — mais simples estilizar o `recharts` direto do que configurar o
  `ChartConfig` do wrapper para um caso de uso tão pequeno. Fica para o
  bloco de performance decidir se vale a pena isolar o gráfico atrás de
  `next/dynamic`, já que `recharts` pesa bastante no bundle do `/admin`.

## Bloco 9 — SEO, acessibilidade e performance

- **Conteúdo de `/sobre`, `/trocas-e-devolucoes` e `/politica-de-privacidade`
  é hardcoded no código, ao contrário do resto da vitrine.** A regra
  "nenhum texto de vitrine hardcoded" enumera explicitamente nav, frases,
  headline e wordmark — conteúdo institucional/legal (política de
  privacidade, prazos de troca) não é copy de vendas, é texto de
  compliance, do mesmo jeito que o aviso de cookies já era. Os textos
  atuais são um ponto de partida genérico: **o lojista precisa revisar
  com um advogado antes de publicar em produção**, especialmente a
  política de privacidade (LGPD) e o prazo de troca — isso está anotado
  também no README.
- **`/sacola` foi dividida em `page.tsx` (Server Component, só com a
  `metadata`) + `BagView` (Client Component com o carrinho).** A página
  original tinha `"use client"` no topo do arquivo, o que silenciosamente
  descarta qualquer `export const metadata` — Next.js exige que o export
  de metadata venha de um Server Component. Sem essa separação, `/sacola`
  ficaria sem título/descrição próprios.
- **`SearchOverlay` e o gráfico do dashboard (`recharts`) viram chunks
  separados via `next/dynamic({ ssr: false })`**, carregados só quando o
  usuário abre a busca ou visita `/admin`. No dashboard isso derrubou o
  First Load JS de ~206kB para ~113kB — era de longe o maior contribuinte
  do bundle do admin, e não é usado em nenhuma outra rota.
- **`robots.ts` bloqueia `/admin`, `/api`, `/checkout`, `/conta` e
  `/sacola` de indexação** — páginas autenticadas ou transacionais não têm
  valor de SEO e não deveriam aparecer em busca.
- **`sitemap.ts` é gerado dinamicamente a partir do banco** (produtos
  ativos + categorias ativas), não uma lista estática — um produto novo
  cadastrado no painel aparece no sitemap no próximo rebuild/revalidação,
  sem precisar editar código.
- **Lighthouse não pôde ser rodado neste ambiente de desenvolvimento.**
  Duas limitações reais: (1) não há projeto Supabase real conectado, então
  a home renderiza com dados de fallback (sem banner, sem produtos) — um
  score aqui não seria representativo da loja real com o seed aplicado;
  (2) o Chrome headless disponível neste sandbox recusou a página com uma
  interstitial mesmo em `localhost`, provavelmente uma restrição do
  próprio ambiente de execução, não da aplicação. Recomendo rodar
  `npx lighthouse` (ou o painel do Chrome DevTools) contra o deploy real
  no Vercel, já com o seed aplicado, como parte do checklist de deploy.

## Bloco 10 — Documentação

- **README.md cobre setup local, configuração do Supabase (ordem exata das
  migrations + seed), configuração de pagamento e checklist de deploy**;
  `docs/OPERACAO.md` é o guia do dia a dia (trocar banner, cadastrar
  produto, dar baixa em pedido) para quem opera a loja sem tocar em
  código. Separei os dois porque têm público diferente — quem faz deploy
  não é necessariamente quem opera a loja depois.
- **Textos institucionais/legais marcados explicitamente como ponto de
  partida, não como texto jurídico definitivo.** Uma política de
  privacidade e uma política de trocas reais têm implicações legais
  (LGPD, CDC) que não deveriam sair de um template genérico sem revisão —
  isso está sinalizado tanto no README quanto no comentário do bloco 9
  acima.

## Bloco 11 — Conexão com projeto Supabase real e verificação ao vivo

O usuário forneceu credenciais de um projeto Supabase real
(`arcxhesbfcnwcngbxlmn.supabase.co`). Isso permitiu, pela primeira vez,
testar contra infraestrutura de verdade em vez de só revisar o SQL:

- **Migrations aplicadas com sucesso, nessa ordem**, via conexão direta
  Postgres (`pg` a partir de um script descartável, já que não havia
  `psql` nem a CLI do Supabase disponíveis no ambiente). As 5 migrations
  passaram de primeira.
- **Bug real encontrado e corrigido no `seed.sql`:** a geração de SKU
  usava `upper(left(slug, 6))` como prefixo — "moletom-oversized-..." e
  "moletom-careca-..." colidem nos 6 primeiros caracteres, então o
  segundo produto violava a constraint `unique(sku)`. Como um script
  multi-statement roda como uma transação implícita no protocolo simples
  do Postgres, a falha não deixou nada parcial no banco — bastou corrigir
  e rodar de novo. Troquei o prefixo para os 3 últimos caracteres do
  `id` do produto (únicos por construção, já que os UUIDs do seed
  terminam em 201..208), em vez de depender do texto do slug.
- **RLS testada de verdade com a chave anon/publishable**, não só lida no
  código: tentativas de `insert`/`update`/`delete` em `products`,
  `categories`, `banners`, `site_settings`, `coupons`, `orders` e
  `profiles` foram todas para 0 linhas afetadas (o comportamento correto
  de RLS no Postgres — a policy filtra como um `WHERE`, então uma
  escrita/leitura sem match não dá erro, só afeta/retorna zero linhas).
  Confirmei consultando o estado real depois de cada tentativa. A tabela
  `coupons` retorna 0 linhas para anon mesmo tendo 1 cupom cadastrado —
  a validação só é possível pela função `validate_coupon`, que funcionou
  normalmente.
- **Storage testado de ponta a ponta**: login como o admin seedado →
  upload num bucket `media` → URL pública retorna 200 com o conteúdo
  certo → uma segunda tentativa de upload sem estar logado é negada pela
  RLS. (`supabase.storage.getBucket()` retornou "Bucket not found" —
  isolei que é só uma particularidade desse endpoint de metadata
  específico: o bucket existe (`select * from storage.buckets` confirma),
  as 4 policies existem, e as duas operações que o app realmente usa —
  `upload()` e `getPublicUrl()` — funcionam perfeitamente. Não é usado em
  nenhum lugar do código.)
- **Login do admin seedado testado** (`admin@kingstore.com.br`, com a
  senha definida no seed): autentica e a leitura de `profiles.role`
  retorna `admin` corretamente.
- **Home renderizada localmente contra o banco real**: banner, wordmark
  "KING", produtos e categorias aparecem no HTML — o modo de fallback
  (dados vazios) não é mais o caminho ativo agora que há credenciais
  reais em `.env.local`.

## Bloco 12 — Login do admin pelo "Conta" da vitrine

A pedido do usuário: entrar pelo botão **CONTA** do header com um e-mail
que tem `role = 'admin'` agora redireciona direto para `/admin`, em vez de
cair no painel "Minha conta" do cliente — sem precisar guardar/digitar a
URL `/admin/login` separadamente. Implementado em dois pontos:
`customerSignInAction` checa a role logo após autenticar e redireciona
para `/admin` antes de ir para `/conta`; e a própria página `/conta`
redireciona um admin já autenticado (sessão existente, sem passar pelo
formulário de novo) do mesmo jeito — cobre tanto o login quanto acessar
`/conta` diretamente já logado. `/admin/login` continua existindo e
funcionando como entrada alternativa.

(Durante essa mudança, descobri por que `/conta` mostrava o painel de
cliente pro admin: `customerSignInAction` nunca checava a role, só
autenticava e sempre redirecionava para `/conta` — o admin conseguia
logar ali porque é a mesma tabela `auth.users`, sem verificação de
role no fluxo do cliente antes desta correção. Também aprendi, do jeito
difícil, a nunca rodar `npm run build` com `npm run dev` ativo no mesmo
diretório — os dois escrevem em `.next/` e um builda por cima do cache
do outro, corrompendo o dev server em runtime até um restart limpo.)

## Bloco 13 — Bug real: `z.uuid()` rejeitava os ids do seed

O usuário reportou: ao criar/editar um produto e salvar, os campos
desapareciam. Reproduzi de ponta a ponta com Puppeteer contra o servidor
de dev real (login como admin, preencher o formulário, subir imagem,
adicionar variação, submeter) e inspecionei o `FormData` exato que o
navegador monta no clique do botão — não uma suposição sobre o React,
o objeto real.

**Causa raiz:** `category_id` (e `featured_product_id` de banner,
`order_id`, `variant_id`) eram validados com `z.uuid()`, que no Zod v4
exige um UUID **estritamente compatível com a RFC 4122** (dígitos de
versão e variante corretos). Os ids que o seed atribui à mão —
`11111111-1111-1111-1111-111111111101` e por aí — são valores `uuid`
perfeitamente válidos para o Postgres (a coluna não impõe versão/variante
nenhuma), mas **não passam** na checagem RFC do `z.uuid()`. Toda vez que
o formulário submetia um `category_id` de uma categoria do seed, a
validação falhava silenciosamente com "Selecione uma categoria" — o
formulário nunca chegava a tocar no banco, e o que parecia "os dados
sumindo" era a página inteira voltando ao estado vazio de erro.

Troquei os cinco usos de `z.uuid()` (`lib/validations/product.ts` × 3,
`banner.ts`, `order.ts`, `checkout.ts`) por `z.guid()`, que checa só o
formato 8-4-4-4-12 em hex sem exigir versão/variante — aceita tanto os
ids do seed quanto qualquer `gen_random_uuid()` real gerado pelo app.

**Efeito colateral descoberto durante a investigação:** a tabela
`products` estava com **0 linhas** no banco ao eu começar a investigar —
alguém (ou o próprio usuário testando) tinha apagado os 8 produtos do
seed antes de me pedir ajuda, provavelmente por causa do mesmo bug (o
formulário nunca salvava, e alguma tentativa de "recomeçar" limpou os
produtos existentes). Restaurei rodando `seed.sql` de novo (idempotente
para categorias/banner/settings/cupom via `on conflict do nothing`) e
corrigi manualmente `banners.featured_product_id`, que tinha sido zerado
pelo `on delete set null` quando os produtos foram apagados.

**Lição de processo:** quando um bug relatado pelo usuário não tem causa
óbvia pela leitura do código, vale montar uma reprodução automatizada de
verdade (aqui, Puppeteer contra o Chrome já instalado, mais um script
`pg` direto no banco) em vez de ficar corrigindo hipóteses às cegas —
inclusive corrigi duas hipóteses erradas minhas no caminho (o seletor do
botão de submit pegando o "Sair" da sidebar por engano; depois
`querySelector("form")` pegando o formulário errado) antes de chegar na
causa real.

## Bloco 14 — Upload direto ao Storage (fix do limite de 1MB)

O usuário reportou "Body exceeded 1 MB limit" ao subir foto de produto —
o arquivo passava pela Server Action `uploadMediaAction`, sujeita ao
limite de corpo de requisição do Next.js. Refatorado para upload direto
do navegador ao Supabase Storage, sem tocar o servidor Next.js:

- **Compressão 100% client-side** (`lib/client-upload.ts`): `createImageBitmap`
  com `imageOrientation: "from-image"` (corrige fotos de celular com EXIF
  de rotação) → redimensiona pro maior lado ≤ 2000px via `<canvas>` →
  `canvas.toBlob("image/webp", 0.85)`. Arquivo original > 10MB é rejeitado
  antes de processar.
- **Upload direto com progresso real**: o SDK do Supabase (`storage.upload()`)
  não expõe progresso de upload (usa `fetch` por baixo, que não tem API de
  upload-progress) nem repassa `AbortSignal` pra essa chamada especificamente.
  Em vez de reimplementar o protocolo multipart na mão (frágil a mudanças
  futuras do SDK), criei um `fetch` substituto baseado em `XMLHttpRequest`
  (`createProgressFetch`) e injetei via `global.fetch` num client Supabase
  temporário — o SDK continua montando a requisição (headers, FormData)
  normalmente, eu só troco a camada de transporte pra ganhar
  `xhr.upload.onprogress` e `xhr.abort()` (cancelar).
- **Autorização continua vindo da RLS**, não de um novo mecanismo: o client
  temporário usa a mesma sessão do admin (token pego via
  `supabase.auth.getSession()` do client do navegador), então
  `media_admin_insert` (bloco de banco) barra não-admin exatamente como
  antes.
- **Limpeza de órfãos**: imagens marcadas `isNew` (subidas nesta sessão de
  edição) são apagadas do Storage se removidas da grade antes de salvar,
  ou se o formulário for desmontado sem salvar (`savingRef` suprime essa
  limpeza no caminho de sucesso, já que o redirect do Server Action
  desmonta o formulário mesmo quando o salvamento deu certo). Fechar a
  aba/atualizar a página não aciona essa limpeza — não há API confiável
  pra rodar uma chamada de rede assíncrona em `beforeunload`; é uma
  limitação aceita, não um requisito não atendido.
- **`sharp` removido do `package.json`** — ficou sem nenhum uso depois que
  a conversão para WebP passou a acontecer no navegador via `<canvas>`.
- **`experimental.serverActions.bodySizeLimit: '5mb'`** ficou como rede de
  segurança no `next.config.ts`, exatamente como pedido — mas o upload de
  imagem em si não passa mais por Server Action nenhuma, então esse limite
  na prática só protege os payloads JSON pequenos (`images_json`/
  `variants_json`) que os formulários de produto/banner ainda enviam.

**Teste real**: gerei uma foto sintética de 4032×3024 (resolução típica de
celular) com ruído por pixel — pior caso possível para compressão, já que
fotos reais têm muito mais coerência espacial — pesando 7,5MB em JPEG.
Upload completo em ~2,6s, sem nenhum erro de limite de corpo. Resultado
final salvo: **2000×1500px, WebP, 1,9MB**. Testei também o fluxo completo
(nome, preço, categoria, gerador de variação, salvar) com essa mesma foto
grande — produto criado corretamente no banco. Uma foto real de celular
(não ruído aleatório) deve comprimir bem mais que isso nas mesmas
dimensões/qualidade, já que WebP explora repetição e gradiente suave muito
melhor do que ruído puro.

### Nenhuma ambiguidade restante exigiu confirmação do usuário

Todas as decisões de arquitetura ao longo dos 10 blocos foram resolvidas
pela opção mais simples que atendesse ao requisito literal, documentada
no momento em que a ambiguidade apareceu (ver blocos acima). Os únicos
pontos que dependem de uma ação humana fora do código são credenciais
reais (projeto Supabase, Mercado Pago, Resend, domínio) — nenhum deles é
uma decisão de modelagem ou arquitetura, são configurações de ambiente
cobertas no checklist de deploy do README.

## Bloco 15 — Troca do design system da loja pública + entidade de marca

Troca completa do visual da vitrine: de editorial dark/brutalista para
varejo claro e denso (modelo Netshoes). O painel admin não foi tocado.

- **Isolamento de tema via CSS scope, não duplicação de componente**:
  `:root` em `app/globals.css` continua sendo o tema escuro original —
  agora só o admin usa esses valores. Uma nova classe `.storefront-theme`
  redefine todas as mesmas variáveis (`--bg`, `--fg`, `--radius`, etc.)
  para a paleta clara, aplicada uma única vez no wrapper raiz de
  `app/(shop)/layout.tsx`. Todo componente existente que já usava classes
  Tailwind semânticas (`bg-bg`, `text-fg`, `border-line`) herdou o tema
  novo automaticamente, sem precisar reescrever cada arquivo — só quem
  tinha cor **hardcoded** (`bg-[#111111]` etc.) ou pressupunha "estou num
  fundo escuro" via `text-fg`/`text-ink-muted` precisou de ajuste manual
  (checkout, carrinho, `size-guide-modal`, `cookie-banner` — todos tinham
  esse bug de contraste antes do fix).
- **`--radius` também é escopado**: a escala `--radius-sm..4xl` do
  `@theme inline` foi trocada de valores fixos (`0rem` cravado em cada
  degrau) para múltiplos proporcionais de `var(--radius)`, para que
  `:root` (admin, `--radius: 0rem`) continue com cantos 100% retos em
  todos os componentes shadcn sem precisar de override por componente, e
  a loja (`--radius: 8px`) ganhe a escala arredondada só por herdar o
  escopo.
- **`--gold` (dourado puro, fills/badges) e `--accent` (usado só pelo
  focus ring) foram desacoplados** — antes `--accent` fazia as duas
  funções. Manter os dois na mesma variável teria forçado o anel de foco
  a usar o dourado puro (2,4:1, reprovado) ou o texto/badge a usar a
  versão escurecida seguro-para-texto (perderia saturação). Resolvido tal
  que `--gold` sempre é o valor puro da logo e `--accent`/`--ring` usam
  `--gold-text` (4,5:1+) só na loja.
- **Migration `0008_brands.sql`**: tabela `brands` (mesmo padrão de RLS de
  `categories`: leitura pública só de ativas, escrita só admin) e 4
  colunas novas em `products` (`brand_id`, `manufacturer_ref`,
  `attributes` jsonb, `badge`). `brand_id` é `on delete set null` — testado
  ao vivo (criei marca, associei a um produto, apaguei a marca): o produto
  continuou existindo com `brand_id = null`. Dado o histórico de produtos
  sumindo neste projeto, essa verificação foi feita antes de considerar o
  bloco fechado, não só lida do SQL.
- **CRUD de marca é uma cópia estrutural do de categoria** — mesma forma
  de Server Action (`quickCreateBrandAction` espelha
  `quickCreateCategoryAction`), mesmo padrão de select com opção "criar
  nova" embutida no formulário de produto. Único acréscimo: o
  `DeleteButton` ganhou uma prop `description` opcional pra mostrar
  "N produtos usam esta marca" antes de confirmar a exclusão (as outras
  entidades continuam com o texto genérico).
- **Simplificações assumidas sem schema novo** (fora do que o bloco de
  schema pediu, então não implementadas via migration):
  - "Mais vendidos" na home reaproveita `featured` (o mesmo campo que já
    existia como "Destaque na home") em vez de agregar `order_items` —
    não há política de RLS pública pra ler pedidos, e criar uma função
    `security definer` só pra isso não estava no escopo pedido.
  - Favoritos (ícone de coração no card) é só `localStorage`, por
    dispositivo — não existe tabela de wishlist.
  - "Calcular frete e prazo" no card de compra usa o lookup de CEP já
    existente (ViaCEP) e mostra uma janela de prazo estimada por região;
    não existe motor de cálculo de frete real em nenhum lugar do projeto
    (nem no checkout), então não fabriquei um valor de frete falso — o
    texto deixa explícito que o valor final sai no checkout.
  - Categorias não têm campo de imagem/ícone no schema — a faixa de
    categorias da home usa um monograma (inicial do nome) em vez de foto.
  - Dropdown de subcategoria no header não foi implementado — `categories`
    é uma tabela plana, sem `parent_id`; o pedido original de schema não
    incluía isso.
- **Contraste**: todas as combinações de token validadas por cálculo de
  WCAG (não só visual). Uma reprovou: `--discount` (`#0F8A3C`, o valor
  literal do pedido) dava 4,45:1 em branco — abaixo do mínimo de 4,5:1
  pra texto de corpo. Escurecido pra `#0D7A34` (5,45:1), visualmente quase
  idêntico.
- **`npm run build` e `npx tsc --noEmit` limpos**, zero warnings de lint.
  Testado ao vivo via Puppeteer em 375/768/1440px: home, catálogo, página
  de produto, e o fluxo completo de marca (criar → associar a produto →
  aparece no filtro do catálogo, na ficha técnica do produto e em
  `/marca/[slug]` sem rebuild) — e o painel admin, pra confirmar que
  segue idêntico ao de antes.


## Bloco 16 — Compra direta pelo WhatsApp

Botão "Comprar pelo WhatsApp" na página de produto e na sacola (gaveta e
página cheia), aba "Pedidos WhatsApp" no painel, e a garantia de
`og:image` em todo produto — que é pré-requisito do resto: o link que o
cliente cola na conversa **é** a vitrine naquele momento.

- **Reaproveita `orders`/`order_items`; não há tabela paralela.** Uma
  venda de WhatsApp confirmada precisa baixar o mesmo estoque, contar no
  mesmo Dashboard (`PAID_STATUSES`) e aparecer na mesma lista de Pedidos.
  Uma segunda tabela significaria duplicar as três coisas e vê-las
  divergir. O custo é dois status novos no `check` de `orders.status`:
  `aguardando_whatsapp` e `expirado`.
- **`expirado` separado de `canceled`**, embora fosse mais barato reusar
  o segundo. "O cliente sumiu" e "a loja desistiu" levam a conversas
  diferentes no dia seguinte, e o único jeito de distinguir os dois
  depois seria comparar `expires_at` com a data — o que erra assim que
  alguém cancela à mão um pedido já vencido.
- **`code` (`KS0001`) é coluna própria, não `order_number` formatado.**
  `order_number` é o número interno de *todo* pedido e já estava na casa
  dos milhares; a compra por WhatsApp precisa de algo curto o bastante
  para o cliente ditar por áudio. Sequence própria (`whatsapp_order_code_seq`),
  `unique`, nulo em pedido que não nasceu por este caminho.
- **O pedido inteiro é uma função `security definer`
  (`create_whatsapp_order`), não uma sequência de inserts na Server
  Action.** Dois motivos, e o segundo é o que decidiu:
  1. A política de insert de `orders` exige `customer_id = auth.uid()`,
     que nenhum visitante anônimo satisfaz — e exigir login aqui mataria
     o ponto do recurso. Afrouxar a política deixaria qualquer um inserir
     pedidos com qualquer total; a função é uma porta estreita que decide
     status, código, prazo e valor sozinha.
  2. Preço, nome, cor e tamanho são lidos do banco **dentro** dela. A
     sacola vive em `localStorage` e nunca é fonte de verdade para
     dinheiro — mesma regra que `reviseCartItems()` já aplicava no
     checkout.
  A mensagem do WhatsApp é montada a partir do que a função devolveu, não
  do que o navegador achava que tinha.
- **Não reserva estoque, e o texto diz isso.** A primeira versão da
  mensagem falava em "pedido reservado"; seria mentira, já que nada é
  decrementado antes da confirmação. O que expira é o código, e é isso
  que a frase diz. Na criação o pedido é *aparado* ao estoque existente
  (item que sumiu cai fora, quantidade maior que o saldo encolhe) e a
  resposta traz `adjusted`, que vira um toast — mandar ao cliente uma
  lista prometendo o que a loja não tem é pior do que o ajuste.
- **`confirm_whatsapp_order` aborta por falta de estoque; `fulfill_order_stock`
  não.** Elas parecem a mesma função e fazem o oposto de propósito: no
  webhook do Mercado Pago o dinheiro já entrou, então ignorar uma
  variação sem saldo e seguir é o mal menor. Aqui ninguém pagou ainda, e
  o atendente precisa saber que não pode vender **antes** de responder.
  A exception nomeia a peça que faltou e desfaz tudo (nenhuma outra
  variação é decrementada). O loop percorre `order by variant_id` para
  que dois admins confirmando ao mesmo tempo travem na mesma ordem em vez
  de deadlockar, e a linha do pedido é travada com `for update`, então
  dois cliques viram uma confirmação e um `NOT_PENDING`.
- **Expiração sem cron.** Não existe agendador neste projeto. A varredura
  (`expire_whatsapp_orders`) roda ao abrir a aba e dentro de cada pedido
  novo — o estado está correto sempre que alguém olha. A rede de
  segurança de verdade não é ela: é `confirm_whatsapp_order` recusar um
  pedido vencido mesmo que a varredura ainda não tenha passado.
  Consequência aceita: sem visitas ao painel e sem vendas novas, um
  pedido vencido fica exibindo `aguardando_whatsapp` até a próxima delas.
- **Bug encontrado relendo o SQL, não em teste**: `orders.customer_id`
  aponta para `customers`, não para `auth.users`. Gravar `auth.uid()`
  direto estouraria a FK para quem tem conta de autenticação sem cadastro
  de cliente completo — estado que existe (o checkout normal o barra com
  "complete seu cadastro"). Sem cadastro, o pedido segue como visitante.
- **A ficha do pedido troca o formulário de status por um aviso enquanto
  o pedido está `aguardando_whatsapp`.** Aquele formulário levaria o
  pedido a "Pago" por `fulfill_order_stock()` — a versão tolerante — e
  contornaria silenciosamente a checagem transacional. A única porta
  enquanto a venda não fechou é a aba de WhatsApp.
- **Buscar por código ignora o filtro de status.** O atendente digita o
  código que o cliente mandou para achar *aquele* pedido; devolver "nada
  encontrado" porque ele já foi confirmado e a aba estava em "Aguardando"
  seria esconder exatamente a resposta pedida.
- **`og:image` garantido em três camadas**: foto da galeria → foto da
  variação (o caso normal de peça única, que antes era compartilhada sem
  imagem nenhuma) → cartão gerado por `ImageResponse` em
  `produto/[slug]/opengraph-image.tsx`. A terceira camada só entra porque
  a metadata **omite a chave** `openGraph.images` em vez de passá-la como
  `undefined` — é a ausência dela que deixa o convention de arquivo
  assumir.
- **A aba abre no gesto do clique, antes do `await`.** `window.open()`
  depois da resposta da Server Action é o que todo bloqueador de pop-up
  móvel recusa — era assim que o botão simplesmente não fazia nada no
  iPhone. A aba é aberta em branco e recebe a URL no fim; se mesmo assim
  vier bloqueada, a aba atual navega, porque o pedido já existe e o
  cliente já tem o código.
- **Correção de borda no menu do painel**: `pathname.startsWith(href)`
  acendia "Pedidos" e "Pedidos WhatsApp" ao mesmo tempo — o segundo href
  começa com o primeiro. Passou a exigir a barra.
- **Três cópias do mapa de rótulos de status viraram uma**
  (`ORDER_STATUS_LABEL` em `lib/constants`): com dois status novos, a
  alternativa era lembrar dos três lugares.
- **Verificação**: `npx tsc --noEmit`, `npx eslint` e `npm run build`
  limpos; a migration foi passada pelo parser do próprio Postgres
  (`libpg_query`) — 17 statements e os 4 corpos plpgsql — e o nome
  `orders_status_check`, que o `drop constraint` pressupõe, foi conferido
  contra o banco real. `next start` serviu a página de produto com
  `og:image` e o botão, a sacola, o cartão gerado (PNG 1200x630, com
  acentos) e o redirect de `/admin/pedidos-whatsapp` para o login.
  **O que não foi verificado ao vivo**: nada que dependa da migration —
  ela não foi aplicada, porque este ambiente não tem credencial de banco
  nem CLI do Supabase, só a `service_role` (que não roda DDL). Rodar
  `0014_whatsapp_orders.sql` no SQL Editor é o passo que falta.

## Bloco 17 — Aba "Conta": troca de e-mail e senha do painel

Antes disto, mudar a credencial do admin só era possível pelo painel do
Supabase. O gatilho foi descobrir que a senha seedada estava **commitada
em três arquivos** (`README.md`, `DECISIONS.md`, `supabase/seed.sql`):
quem clonasse o repositório tinha o acesso ao painel de toda instalação.

- **Aba própria, não seção de Configurações.** A primeira versão pendurou
  isto no fim de Configurações; virou aba separada porque credencial não
  pode viajar junto de um "Salvar configurações" de rotina — e porque o
  campo "E-mail" daquele formulário é o de *contato da loja*, que sai no
  rodapé do site. Os dois já tinham sido confundidos, então Configurações
  agora diz em uma linha onde fica o outro.
- **As duas operações pedem a senha atual.** `updateUser()` não pede: sem
  essa checagem, uma aba esquecida aberta num computador compartilhado
  bastaria para alguém tomar a conta trocando o e-mail de acesso.
- **A conferência da senha usa o `createPublicClient`, não o cliente da
  sessão.** Chave anon, `persistSession: false`, nenhum cookie: o
  `signInWithPassword` de verificação é feito e descartado. Com o cliente
  da sessão, esse sign-in reescreveria os cookies do admin no meio da
  própria troca de senha, e um erro no passo seguinte o deixaria numa
  sessão nova que ele não pediu.
- **A troca de e-mail não promete o que não aconteceu.** Com confirmação
  de e-mail ligada no Supabase, `updateUser({email})` não troca nada na
  hora: guarda o endereço como pendente e manda um link. Dá para saber em
  qual dos dois mundos o projeto está comparando o `user.email` que volta
  com o que foi pedido — e só no caso aplicado é que `profiles.email`
  (lido pela listagem de Clientes) é sincronizado junto.
- **Mensagens do GoTrue traduzidas só onde dependem do que o operador
  digitou** — e-mail recusado, senha fraca, e-mail já usado, limite de
  tentativas. O resto vira uma frase genérica **com o original no log do
  servidor**; foi exatamente isso que permitiu descobrir, durante o
  teste, que o Supabase recusa domínios como `example.com` com
  `Email address ... is invalid`, causa que sem o log teria ficado
  invisível.
- **`seed.sql` deixou de trazer senha literal.** Agora lê
  `current_setting('kingstore.admin_password')`, definido por um `set` no
  topo do arquivo, e um bloco `do $$` **recusa rodar** com o valor de
  exemplo ou com menos de 8 caracteres — um seed que "funciona" com a
  senha de exemplo é o mesmo problema de volta. Isso não limpa o
  histórico do git: o que a troca faz é tornar a senha antiga inútil.
- **Verificação ao vivo** com um admin descartável criado e apagado para
  isto (as credenciais reais do usuário nunca foram tocadas): senha atual
  errada, confirmação divergente, nova igual à atual, senha curta e troca
  válida — cada uma com sua mensagem; a sessão sobrevive à troca; a senha
  antiga passa a ser recusada no login e a nova entra. Três submissões
  seguidas com erro não derrubam a página (isso foi investigado a fundo
  porque um script de teste mal escrito fez parecer que derrubava).
  A troca de e-mail teve os dois caminhos de recusa confirmados; o caminho
  de sucesso não foi exercitado ao vivo porque exigiria enviar e-mail de
  confirmação a um endereço real de terceiro.

## Bloco 18 — A sacola deixava pedir mais do que existe

Defeito encontrado auditando o catálogo real, não relatado: **109 das 119
variações da loja têm estoque 1**. O botão "+" da sacola não tinha teto
nenhum, então o caso normal deste catálogo era o cliente subir para 3,
ver `R$ 224,70` e receber um pedido de `R$ 74,90` — tanto o checkout
(`reviseCartItems`) quanto a compra por WhatsApp (`create_whatsapp_order`)
aparam a quantidade no servidor, e ele só descobria depois.

- **`getCartStock` separada de `reviseCartItems`**, embora as duas leiam
  estoque. Aquela monta um pedido e por isso **descarta** as linhas sem
  saldo, o que serve ao checkout e não serve à sacola — que precisa
  justamente dizer "esta aqui acabou". A nova devolve um mapa cru, com
  zero incluído; o que não volta (variação apagada, produto arquivado) é
  tratado como zero por quem chama.
- **A página da sacola corrige a quantidade; a gaveta não.** Clampar por
  baixo de uma gaveta que o cliente só espiou seria mexer na sacola dele
  sem que ele visse. Na página, onde a decisão de compra acontece, um
  total falso é pior do que um carrinho corrigido com aviso — e é o mesmo
  comportamento que o checkout já aplicava, só que agora visível.
- **Peça esgotada não é removida sozinha.** Ela sai do total e ganha
  "Esgotado — não entra no pedido" com o preço riscado, mas continua na
  lista: apagar silenciosamente a escolha de alguém é pior do que mostrar
  que ela não dá mais.
- **`limitOf` devolve `null` enquanto a consulta não voltou**, e nada
  trava nesse estado. Travar por precaução barraria uma sacola
  perfeitamente válida no primeiro render; o servidor continua sendo quem
  decide na hora do pedido.
- **A gaveta só consulta quando está aberta.** Ela é montada no layout,
  isto é, em *toda* página da loja — sem esse interruptor, cada navegação
  dispararia uma ida ao servidor por um painel que ninguém abriu.
- **Efeito colateral que confirma o acerto**: com a sacola já correta, a
  compra por WhatsApp parou de emitir o aviso "alguns itens foram
  ajustados" — não há mais o que ajustar quando a mensagem sai.
- **Verificação ao vivo**, com uma variação zerada de propósito e
  devolvida depois: sacola de 3 linhas (uma com quantidade 3 sobre
  estoque 1, uma válida, uma esgotada) passou a mostrar "2 itens /
  R$ 169,80" em vez de "5 itens / R$ 404,50"; o `localStorage` foi
  corrigido para `[1,1,1]`; o "+" ficou desabilitado nas duas com "Última
  unidade"; e o pedido de WhatsApp gerado a partir dela saiu só com a
  peça disponível. Cinco rotas varridas depois da mudança sem nenhum erro
  de console.

### Sobre o `<next-route-announcer>`

Reportado como erro na sacola; **não é erro nem é da sacola**. É o
elemento que o próprio Next.js insere no `<body>` de toda página do App
Router, com uma região `aria-live` que anuncia mudanças de rota para
leitores de tela. Confirmado idêntico em `/`, `/colecao`, `/produto/…`,
`/sacola` e `/checkout`, com zero erro de console em todas.

## Bloco 19 — Fotos que quebravam sozinhas na página de produto

Sintoma relatado com print: na página de produto, a foto grande e uma das
miniaturas apareciam como o ícone de imagem quebrada com o texto do `alt`
("Frente") ao lado, enquanto as outras duas miniaturas carregavam normal.
Recarregar mudava *quais* fotos quebravam, não *se* quebravam.

- **Não era URL ruim, e isso foi verificado antes de escrever qualquer
  linha.** As 153 imagens cadastradas (`product_images`, `product_variants`
  e `banners`) foram baixadas uma a uma direto do Storage e depois pedidas
  de novo através do otimizador do Next: 200 em todas, nas duas pontas.
  Duzentos pedidos simultâneos ao `/_next/image` com cache frio também
  voltaram 200 — só que o mais lento levou 5,3s.
- **A causa é esse 5,3s.** O otimizador baixa o arquivo do Supabase a cada
  cache frio e **desiste aos 7s** (o timeout é do próprio Next,
  `next/dist/server/image-optimizer.js`). Uma página de produto dispara
  ~20 desses pedidos de uma vez; basta uma oscilação de rede para um deles
  estourar e voltar 504. E aí vem a parte que transforma um soluço em
  defeito visível: **o `next/image` não tenta de novo**. O `<img>` guarda o
  erro e só sai dele num reload da página inteira — daí "algumas carregam,
  outras não, e a cada reload são outras".
- **`SafeImage` em vez de `Image` em toda a vitrine**
  (`components/shop/safe-image.tsx`). Cada falha escala um degrau:
  1. pedido normal, otimizado;
  2. o mesmo pedido com `?retry=1` grudado na URL de origem — a URL final
     muda, então nem o erro que o navegador guardou nem a entrada em disco
     do otimizador conseguem devolver o mesmo 504. Funciona porque
     `remotePatterns` só compara query string quando a chave `search` é
     declarada, e a nossa não declara;
  3. `unoptimized` — o arquivo vem direto do CDN do Supabase, pulando o
     otimizador de vez.
- **O terceiro degrau é o que de fato salva a foto, não um enfeite.** Se o
  problema é o pulo pelo otimizador, ir direto na origem entrega a imagem
  real em vez de esconder o defeito. Sai caro em bytes — mas os uploads já
  são WebP de no máximo 2560px (`lib/client-upload.ts`), então o arquivo
  cru é da ordem de 120KB, não de 5MB.
- **O quadro "Sem imagem" é o último recurso, não o primeiro.** Ele já
  existia para produto sem foto cadastrada; agora cobre também a foto que
  não carregou de jeito nenhum. Um quadro cinza deliberado é melhor que o
  ícone quebrado do navegador, mas é pior que a foto — por isso vem depois
  das três tentativas, nunca no lugar delas.
- **A espera de 600ms entre tentativas é proposital.** A falha vem de
  congestionamento; repetir no mesmo instante cai no mesmo congestionamento.
- **Trocar a foto no mesmo slot zera a escalada** (outra cor no seletor, outro
  produto num card reaproveitado). Sem isso a foto nova herdaria o estágio da
  anterior e iria direto para o quadro cinza sem nunca ter sido pedida.
- **Rótulo do quadro por contexto.** "Sem imagem" serve para foto de produto;
  num swatch de 56px ou num logo ele não cabe nem faz sentido, então ali o
  `fallbackLabel` é a inicial da cor, a inicial da categoria ou o nome da
  marca/loja — o mesmo texto que esses pontos já mostravam quando não havia
  imagem cadastrada. Nos banners o rótulo é vazio: legenda sobre a arte de um
  hero seria pior que o vazio.
- **Verificação ao vivo com Playwright**, interceptando as respostas do
  otimizador na própria página de produto. Quatro cenários: sem falha, a foto
  carrega; **um 504 isolado**, a foto se recupera sozinha na segunda tentativa
  (era exatamente esse caso que ficava quebrado para sempre); **otimizador
  fora do ar**, a foto aparece servida direto do CDN, com a galeria e as três
  miniaturas intactas; **tudo fora do ar**, o painel "SEM IMAGEM" no lugar do
  ícone quebrado. `tsc`, `eslint` e `next build` limpos.
