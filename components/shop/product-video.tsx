function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") || u.hostname === "youtu.be") {
      const id = u.hostname === "youtu.be" ? u.pathname.slice(1) : u.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    return null;
  } catch {
    return null;
  }
}

export function ProductVideo({ url }: { url: string }) {
  const embedUrl = toEmbedUrl(url);

  return (
    <div className="relative mt-4 aspect-video w-full overflow-hidden rounded-lg bg-surface">
      {embedUrl ? (
        <iframe
          src={embedUrl}
          title="Vídeo do produto"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="size-full"
        />
      ) : (
        <video src={url} controls className="size-full object-contain" />
      )}
    </div>
  );
}
