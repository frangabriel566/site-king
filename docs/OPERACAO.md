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

`/admin/cupons` → **Novo cupom**:

- **Código** — salvo em maiúsculas e sem espaços; o cliente pode digitar
  "teste 10" ou "Teste10" que funciona igual.
- **Tipo e valor** — percentual (até 100%) ou valor fixo em R$. O desconto
  é sobre os produtos, nunca sobre o frete, e nunca passa do subtotal.
- **Também zera o frete** — o cupom dá frete grátis (pode ser só isso, com
  valor 0).
- **Pedido mínimo** — sobre o subtotal dos produtos. Se o cliente diminuir
  a sacola para baixo do mínimo, o cupom sai sozinho com um aviso.
- **Limite de usos** — em branco, sem limite. Cada pedido criado com o
  cupom conta um uso; pedido **cancelado ou expirado devolve** o uso. O
  banco não deixa passar do limite, nem com dois pedidos ao mesmo tempo.
- **Começa em / Vale até** — dias inteiros no horário de Brasília (do
  início do primeiro dia até 23:59 do último). Em branco, sem limite.
- **Ativo** — dá para ligar e desligar direto na lista. Desativar é melhor
  que excluir: a lista continua mostrando quantas vezes ele foi usado.

O cliente aplica o cupom na **sacola**, logo abaixo do CEP (ou no resumo
do checkout). O cupom segue com a sacola até o checkout e até o
"Comprar pelo WhatsApp", e a mensagem do WhatsApp sai com o código e o
valor do desconto. O desconto é sempre calculado no servidor, com os
preços do banco, e conferido de novo quando o pedido é criado — se o cupom
deixou de valer no meio do caminho, o pedido não é criado e o cliente vê o
motivo. A lista de cupons nunca aparece na loja.

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

Cada vitrine mostra **só os produtos marcados para ela** no cadastro do
produto → Exibição → **Onde exibir no site**: Lançamentos, Novidades,
Ofertas e Mais vendidos. O produto pode estar em nenhuma, uma ou várias.

- **Ordem**: ao marcar uma vitrine, aparece um campo de ordem. 1 vem
  primeiro; em branco, depois dos numerados, os mais novos primeiro.
- **Produto novo** já vem com **Novidades** marcada (dá para desmarcar).
- **Mais vendidos**: os marcados aparecem primeiro, na ordem escolhida, e
  o resto da vitrine é completado pelos que mais venderam de verdade
  (pedidos confirmados).
- **Ofertas** sem preço promocional: o painel avisa, mas salva — o
  produto aparece com o preço normal.
- Produto **esgotado** sai da vitrine até voltar o estoque (continua
  marcado e no catálogo). Rascunho e arquivado nunca aparecem.
- O **"Ver tudo"** de cada vitrine abre o catálogo só com os produtos
  dela, na mesma ordem.

Na lista de produtos do painel, cada produto mostra suas vitrines (com o
número da ordem) e dá para filtrar por vitrine ou ver os "Sem seção". A
**Etiqueta no card** (Lançamento, Mais vendido, Oferta) é só o selo do
card: não coloca o produto em vitrine nenhuma. **Aparecer primeiro no
catálogo** muda só a ordem "Relevância" de /colecao.

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
