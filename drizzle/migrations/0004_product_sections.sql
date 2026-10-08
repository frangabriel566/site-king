CREATE TABLE `product_sections` (
	`product_id` text NOT NULL,
	`section` text NOT NULL,
	`position` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	PRIMARY KEY(`product_id`, `section`),
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "product_sections_section_check" CHECK("product_sections"."section" in ('lancamentos', 'novidades', 'ofertas', 'mais_vendidos')),
	CONSTRAINT "product_sections_position_check" CHECK("product_sections"."position" is null or "product_sections"."position" >= 1)
);
--> statement-breakpoint
CREATE INDEX `product_sections_section_idx` ON `product_sections` (`section`,`position`);--> statement-breakpoint
-- Retrato de onde cada produto aparece hoje, para nada sumir do site
-- quando as vitrines passarem a ser escolhidas no painel. Calculado com os
-- dados do momento em que esta migration é aplicada, com as mesmas regras
-- que as vitrines usam até aqui (ativos e com estoque; 24 por vitrine).
--
-- Novidades: os 24 cadastrados por último. Sem número de ordem — a ordem
-- "sem número" já é a do mais novo primeiro, que é a de hoje.
INSERT INTO `product_sections` (`product_id`, `section`)
SELECT p.`id`, 'novidades'
FROM `products` p
WHERE p.`status` = 'active'
  AND EXISTS (SELECT 1 FROM `product_variants` v WHERE v.`product_id` = p.`id` AND v.`stock` > 0)
ORDER BY p.`created_at` DESC
LIMIT 24;
--> statement-breakpoint
-- Ofertas: os que têm preço "de" acima do preço, numerados pelo desconto
-- (maior primeiro), que é a ordem de hoje.
INSERT INTO `product_sections` (`product_id`, `section`, `position`)
SELECT p.`id`, 'ofertas',
  row_number() OVER (ORDER BY (1.0 - p.`price` / p.`compare_at_price`) DESC, p.`created_at` DESC)
FROM `products` p
WHERE p.`status` = 'active'
  AND p.`compare_at_price` > p.`price`
  AND EXISTS (SELECT 1 FROM `product_variants` v WHERE v.`product_id` = p.`id` AND v.`stock` > 0)
ORDER BY (1.0 - p.`price` / p.`compare_at_price`) DESC, p.`created_at` DESC
LIMIT 24;
--> statement-breakpoint
-- Lançamentos (vitrine nova): os produtos com a etiqueta "Lançamento".
INSERT INTO `product_sections` (`product_id`, `section`)
SELECT p.`id`, 'lancamentos'
FROM `products` p
WHERE p.`badge` = 'lancamento';
-- Mais vendidos não recebe ninguém aqui: a vitrine continua completada
-- pelas vendas reais, e as escolhas manuais (que vêm primeiro) começam
-- vazias.
