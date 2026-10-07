# Guia de operação da loja

Guia curto para quem toca a loja no dia a dia pelo painel
(`/admin`), sem precisar mexer em código.

## Entrar no painel

Acesse `/admin/login` com o e-mail e senha de administrador. Esqueceu a
senha? Use **"Esqueci minha senha"** na própria tela de login: chega um
link por e-mail (precisa da `RESEND_API_KEY` configurada). Sem e-mail
configurado, quem tem acesso ao projeto define uma senha nova com
`npm run admin:create -- --email SEU_EMAIL --remote` (ver README).

## Trocar o banner da home

O banner que aparece na home é o que estiver **ativo** com a **menor
posição** — dá pra deixar vários cadastrados e só ativar um por vez, ou
usar a posição para decidir qual aparece primeiro.

1. `/admin/banners` → **Novo banner** (ou clique no lápis de um existente).
2. Preencha eyebrow, headline (duas linhas), wordmark e o texto/link do
   botão principal.
3. Envie a **imagem de fundo** e, se tiver, o **recorte** (PNG do modelo
   com fundo transparente) — o painel converte tudo para WebP
   automaticamente. Sem recorte, a wordmark gigante aparece com opacidade
   reduzida em vez de "atrás" de alguém; com recorte, ela aparece atrás da
   pessoa.
4. Escolha o **produto em destaque** (opcional) — ele aparece no card do
   canto inferior direito do hero, com preço e um botão que já adiciona a
   primeira variação com estoque à sacola.
5. O **preview ao vivo** à direita do formulário mostra exatamente como o
   hero vai ficar, atualizando a cada campo digitado — sem precisar salvar
   para ver o resultado.
6. Marque **Ativo** e clique em **Salvar**. A home reflete a mudança na
   hora, sem precisar de novo deploy.

## Cadastrar um produto novo

1. Antes de mais nada, confira se a **categoria** do produto já existe em
   `/admin/categorias` — se não, crie por lá primeiro.
2. `/admin/produtos` → **Novo produto**.
3. Preencha nome (o slug é gerado automaticamente, mas pode editar),
   descrição, preço e, se for o caso, o "preço de" (para mostrar riscado).
4. Escolha a categoria e o status:
   - **Rascunho**: não aparece na loja, só no painel.
   - **Ativo**: aparece na coleção e pode ser comprado.
   - **Arquivado**: sai da loja sem apagar o histórico de pedidos que já
     usaram esse produto.
5. Marque **Destaque na home** se quiser que ele apareça na seção
   "Destaques" da home.
6. Envie as **imagens** (arraste para reordenar — a primeira é a foto de
   capa do produto na listagem).
7. Cadastre as **variações** (cor × tamanho): clique em **Adicionar
   variação** para cada combinação, preencha cor, cor em hex (aparece como
   bolinha de cor no site), tamanho, SKU (opcional) e estoque.
8. **Salvar produto**.

Editar um produto depois substitui completamente as imagens e variações
pelas que estiverem no formulário no momento de salvar — se você removeu
uma variação sem querer, é só adicionar de volta antes de salvar.

## Dar baixa em pedido / atualizar status

O estoque é baixado **automaticamente** quando o pagamento é confirmado
(via webhook do Mercado Pago) ou, no fluxo WhatsApp, quando você mesmo
marca o pedido como pago. Você não precisa (e não deve) editar o estoque
manualmente por causa de uma venda — isso é para ajustes reais de
inventário, em `/admin/estoque`.

1. `/admin/pedidos` → clique no número do pedido (ou filtre por status /
   busque por nome ou número primeiro).
2. Confira itens, endereço de entrega e dados do cliente.
3. No painel à direita:
   - Mude o **status** conforme o pedido avança (pago → em preparação →
     enviado → entregue), ou **cancelado** se necessário.
   - Preencha o **código de rastreio** quando despachar.
   - **Salvar**.
4. **Imprimir** gera uma via limpa do pedido (sem menu/sidebar) direto do
   navegador, útil para separar itens ou colar na embalagem.

## Ajustar estoque manualmente

`/admin/estoque` lista toda variação de todo produto, com o número em
destaque em âmbar quando está baixo (5 unidades ou menos). Edite o campo
e clique fora — salva sozinho.

## Cupons

`/admin/cupons` → **Novo cupom**. Escolha percentual ou valor fixo, um
pedido mínimo (opcional) e uma data de expiração (opcional). O cupom só
funciona se estiver **Ativo**. A validação acontece sempre no servidor no
momento do checkout — o cliente nunca consegue "ver" a lista de cupons
existentes navegando pelo site.

## Configurações gerais

`/admin/configuracoes` reúne o que aparece em vários lugares do site ao
mesmo tempo: nome da loja, logo, WhatsApp (usado tanto no botão flutuante
quanto no checkout via WhatsApp), redes sociais, as frases de envio/frete
grátis que aparecem no rodapé do hero, e a faixa de avisos no topo do
site (com um interruptor para ligar/desligar sem apagar as mensagens).

### Vitrine: preço, selos e confiança

Na mesma tela, a seção **Vitrine** define as condições que a loja mostra
nos cards, na página do produto e na sacola. **Campo vazio = não mostrar**:
nada aparece para o cliente sem ter sido definido aqui.

- **Parcelas sem juros** — "3x de R$ 33,30 sem juros". Precisa bater com o
  que o Mercado Pago da loja oferece sem juros.
- **Desconto no Pix (%)** — mostra o preço no Pix. É só exibição: o
  checkout online não aplica o desconto sozinho; a loja precisa honrá-lo
  (ex.: na venda pelo WhatsApp).
- **Frete grátis a partir de (R$)** — zera o frete no checkout a partir
  desse subtotal e alimenta a barra "Faltam R$ X para frete grátis" da
  sacola e a faixa do topo do site.
- **Selo "Novo" por (dias)** — produtos cadastrados há até esse número de
  dias.
- **"Últimas unidades" com até (peças)** — soma o estoque de todas as cores
  e tamanhos do produto.
- **Frase de trocas** e **frase de compra segura** — junto com o frete
  grátis, formam a faixa de confiança embaixo do botão de compra. A frase
  de trocas também entra na faixa de benefícios da home, ao lado do
  WhatsApp e das parcelas.

### Faixa de avisos (topo do site)

Uma mensagem por linha, até 6, de até 90 caracteres cada (com uns 40 ela
cabe inteira no celular). Com o interruptor ligado, as mensagens se
revezam a cada 5 segundos acima do logo, em todas as páginas da loja; o
cliente pode passar pelas setas, e a faixa para quando ele usa as setas
ou põe o mouse em cima. Desligada ou vazia, a faixa mostra a regra de
frete grátis (se houver). Ao falar de frete grátis numa mensagem, use o
mesmo valor da seção Vitrine — é ele que o checkout aplica.

### Vitrines da home

As vitrines da home se montam sozinhas, só com produtos ativos e com
estoque:

- **Novidades** — os cadastrados por último.
- **Ofertas** — os que têm preço "de" maior que o preço, maior desconto
  primeiro.
- **Mais vendidos** — soma das peças vendidas em pedidos confirmados
  (pago, em preparação, enviado, entregue). Fica escondida até a primeira
  venda confirmada.

O **selo no produto** (cadastro do produto → Exibição) só põe a etiqueta
"Lançamento", "Mais vendido" ou "Oferta" no card e na página do produto; ele
não escolhe mais a vitrine. O interruptor **Aparecer primeiro no catálogo**
põe o produto na frente na ordem "Relevância" de /colecao.

### Rodapé

Os três selos da última linha do rodapé (formas de pagamento, segurança e
privacidade) vêm de Configurações → **Rodapé**. Cada um só aparece se
estiver preenchido. Depois da migration `0002`, eles vêm com os textos que
o site já mostrava ("Cartão, Pix e boleto", "Compra segura", "Dados
protegidos"). Confira se continuam valendo para a loja.

## Categorias: foto e guia de medidas

Em `/admin/categorias`, cada categoria pode ter:

- **Foto** — aparece no círculo da home e no menu do celular, recortada em
  círculo. Sem foto, a loja usa a do primeiro produto da categoria.
- **Guia de medidas** — a tabela que abre em "Guia de medidas" na página de
  cada produto da categoria. Crie a tabela e preencha linha por linha, ou
  use **Colar de uma planilha** (copie as células no Excel/Google Planilhas;
  a primeira linha é o título das colunas). Linhas e colunas vazias são
  descartadas ao salvar. **Sem tabela, o link não aparece** — a loja não
  mostra medidas genéricas. Quando o cliente já escolheu um tamanho, a
  linha dele aparece destacada (a primeira coluna precisa ser o tamanho,
  escrito como na grade do produto: P, M, G…).
