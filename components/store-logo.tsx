import Image from "next/image";

/**
 * The store's logo (Configurações → Logo), or its name in text while there
 * is none — the header, the mobile menu, the footer and the panel all show
 * it this way. The name stays as the alt text, so it is still what screen
 * readers and a failed image say.
 *
 * Every place it appears has a dark background; the height comes from
 * `imageClassName` (with `w-auto`), so a wide logo and a square one both
 * fit the slot without changing its height. The width/height below only
 * reserve a 3:1 box until the file arrives.
 */
export function StoreLogo({
  logoUrl,
  name,
  imageClassName,
  textClassName,
  priority = false,
}: {
  logoUrl: string | null;
  name: string;
  imageClassName: string;
  textClassName: string;
  priority?: boolean;
}) {
  if (!logoUrl) return <span className={textClassName}>{name}</span>;
  return (
    <Image
      src={logoUrl}
      alt={name}
      width={240}
      height={80}
      priority={priority}
      className={`w-auto object-contain ${imageClassName}`}
    />
  );
}
