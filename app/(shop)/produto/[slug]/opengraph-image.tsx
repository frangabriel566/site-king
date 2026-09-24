import { ImageResponse } from "next/og";
import { getProductBySlug } from "@/lib/data/products";
import { getSiteSettings } from "@/lib/data/settings";
import { formatCurrency } from "@/lib/format";

/**
 * A rede de segurança do og:image.
 *
 * generateMetadata() usa a foto do produto sempre que existe uma — foto
 * real ganha de qualquer cartão gerado. Este arquivo cobre o caso que
 * sobra: produto ainda sem foto de galeria nem foto de variação, que sem
 * ele era compartilhado no WhatsApp como um retângulo cinza sem nada.
 *
 * O convention de arquivo só entra em cena quando a metadata não declara
 * `openGraph.images` — é por isso que lá a chave é omitida em vez de vir
 * como `undefined`.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Produto — King Store";

// `params` aqui é objeto, não Promise: a rota de metadata image já
// resolve os params antes de chamar este handler (ao contrário de
// page.tsx e generateMetadata, que em Next 15 recebem a Promise).
export default async function ProductOgImage({
  params,
}: {
  params: { slug: string };
}) {
  const [product, settings] = await Promise.all([
    getProductBySlug(params.slug),
    getSiteSettings(),
  ]);

  const storeName = settings.store_name || "King Store";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#080d16",
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 30,
            letterSpacing: 8,
            textTransform: "uppercase",
            color: "#c9a227",
            fontWeight: 700,
          }}
        >
          {storeName}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 68,
              lineHeight: 1.1,
              color: "#f8fafc",
              fontWeight: 700,
            }}
          >
            {/* Um nome muito longo estoura os 630px de altura; o corte é
                no texto porque o satori não faz line-clamp. */}
            {(product?.name ?? "Produto").slice(0, 80)}
          </div>

          {product && (
            <div
              style={{
                display: "flex",
                marginTop: 28,
                fontSize: 46,
                color: "#f0dfa0",
                fontWeight: 700,
              }}
            >
              {formatCurrency(product.price)}
            </div>
          )}
        </div>

        <div style={{ display: "flex", fontSize: 26, color: "#94a3b8" }}>
          {product?.brand?.name ?? "Vista-se como um rei"}
        </div>
      </div>
    ),
    size,
  );
}
