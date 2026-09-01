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

(Este arquivo continuará sendo atualizado a cada bloco funcional.)
