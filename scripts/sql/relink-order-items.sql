-- Religa itens de pedido que perderam a variação (variant_id vazio) por causa
-- do bug corrigido na migration 0005: salvar um produto recriava as
-- variações com ids novos. Só rodar DEPOIS do deploy da correção — antes
-- dele, o próximo salvamento de produto desligaria tudo de novo.
--
-- Religa pelo que o item guardou no pedido: produto + cor + tamanho. Prefere
-- a variação ativa; se só existir a arquivada, usa ela (é a mesma peça).
-- Itens sem correspondência (cor ou tamanho mudou, produto excluído) ficam
-- como estão.
--
-- NÃO mexe em estoque: pedidos que já tiveram baixa registrada não baixam
-- de novo. Os confirmados que pularam a baixa são conferidos à mão (lista
-- em docs/OPERACAO.md → "Variações e pedidos").
--
-- Prévia (quantos serão religados), antes de rodar:
--   npx wrangler d1 execute king-store-db --remote --command "SELECT count(*) AS religaveis FROM order_items oi WHERE oi.variant_id IS NULL AND oi.product_id IS NOT NULL AND EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = oi.product_id AND v.color = oi.color AND v.size = oi.size)"
-- Rodar:
--   npx wrangler d1 execute king-store-db --remote --file=scripts/sql/relink-order-items.sql
UPDATE order_items
SET variant_id = (
  SELECT v.id
  FROM product_variants v
  WHERE v.product_id = order_items.product_id
    AND v.color = order_items.color
    AND v.size = order_items.size
  ORDER BY v.archived_at IS NOT NULL
  LIMIT 1
)
WHERE variant_id IS NULL
  AND product_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM product_variants v
    WHERE v.product_id = order_items.product_id
      AND v.color = order_items.color
      AND v.size = order_items.size
  );
