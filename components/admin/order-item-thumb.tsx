import Image from "next/image";

/**
 * A foto pequena de uma peça do pedido (lista, detalhe e impressão).
 * Sem foto, um quadrado vazio do mesmo tamanho — as linhas não "pulam".
 */
export function OrderItemThumb({
  url,
  alt,
  size = 56,
}: {
  url: string | undefined;
  alt: string;
  size?: number;
}) {
  const height = Math.round(size * 1.25);
  if (!url) {
    return (
      <div
        aria-hidden
        className="shrink-0 rounded-md border border-line bg-[var(--surface-2)]"
        style={{ width: size, height }}
      />
    );
  }
  return (
    <Image
      src={url}
      alt={alt}
      width={size}
      height={height}
      sizes={`${size}px`}
      className="shrink-0 rounded-md border border-line object-cover"
      style={{ width: size, height }}
    />
  );
}
