# Guia de operação da loja

Guia curto para quem toca a loja no dia a dia pelo painel
(`/admin`), sem precisar mexer em código.

## Entrar no painel

Acesse `/admin/login` com o e-mail e senha de administrador. Se você
esqueceu a senha do admin seedado, troque-a direto pelo painel do
Supabase (Authentication → Users → selecione o usuário → Reset password)
até termos um fluxo de "esqueci minha senha" no próprio painel.

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
grátis que aparecem no rodapé do hero, e a faixa de anúncio no topo do
site (com um interruptor para ligar/desligar sem apagar o texto).
