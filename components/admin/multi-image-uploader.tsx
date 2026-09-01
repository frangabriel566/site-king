"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Upload, X, Loader2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { uploadMediaAction } from "@/lib/actions/media";

export type ProductImageDraft = { url: string; alt: string };

export function MultiImageUploader({
  images,
  onChange,
}: {
  images: ProductImageDraft[];
  onChange: (images: ProductImageDraft[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList) {
    setUploading(true);
    const uploaded: ProductImageDraft[] = [];
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.set("file", file);
      const result = await uploadMediaAction("products", formData);
      if ("error" in result) {
        toast.error(result.error);
        continue;
      }
      uploaded.push({ url: result.url, alt: "" });
    }
    setUploading(false);
    if (uploaded.length > 0) onChange([...images, ...uploaded]);
  }

  function removeAt(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  function reorder(from: number, to: number) {
    if (from === to) return;
    const next = [...images];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  return (
    <div>
      <p className="text-label mb-3">Imagens do produto</p>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
        {images.map((image, index) => (
          <div
            key={image.url + index}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex !== null) reorder(dragIndex, index);
              setDragIndex(null);
            }}
            className="group relative aspect-[4/5] cursor-grab overflow-hidden border border-line bg-[#111111] active:cursor-grabbing"
          >
            <Image src={image.url} alt="" fill sizes="150px" className="object-cover" />
            <div className="absolute left-1 top-1 flex size-6 items-center justify-center bg-black/60 text-white">
              <GripVertical className="size-3.5" />
            </div>
            {index === 0 && (
              <span className="absolute bottom-1 left-1 bg-white px-1.5 py-0.5 text-[9px] font-semibold uppercase text-black">
                Capa
              </span>
            )}
            <button
              type="button"
              onClick={() => removeAt(index)}
              aria-label="Remover imagem"
              className="absolute right-1 top-1 flex size-6 items-center justify-center bg-black/70 text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex aspect-[4/5] flex-col items-center justify-center gap-2 border border-dashed border-line text-ink-muted hover:text-fg"
        >
          {uploading ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Upload className="size-5" />
          )}
          <span className="text-xs">{uploading ? "Enviando…" : "Adicionar"}</span>
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <p className="mt-2 text-xs text-ink-muted">
        Arraste para reordenar. A primeira imagem é a capa do produto.
      </p>
    </div>
  );
}
