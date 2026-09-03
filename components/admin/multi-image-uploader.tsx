"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Upload, X, GripVertical, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { uploadImageToStorage } from "@/lib/client-upload";
import { deleteMediaAction } from "@/lib/actions/media";

export type ProductImageDraft = {
  url: string;
  alt: string;
  width?: number;
  height?: number;
  sizeBytes?: number;
  /** Uploaded during this editing session — safe to delete from Storage
   * on removal/abandon since nothing references it yet. */
  isNew?: boolean;
};

type PendingUpload = {
  id: string;
  fileName: string;
  progress: number;
  cancel: () => void;
};

const MIN_RECOMMENDED_WIDTH = 1200;
const MIN_RECOMMENDED_PHOTOS = 3;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MultiImageUploader({
  images,
  onChange,
  checkDuplicate,
}: {
  images: ProductImageDraft[];
  onChange: (images: ProductImageDraft[]) => void;
  /** Optional cross-field duplicate check (product form only) — see
   * ImageUploader's prop of the same name. */
  checkDuplicate?: (file: File) => Promise<string | undefined>;
}) {
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef(images);
  imagesRef.current = images;

  async function handleFiles(files: FileList) {
    for (const file of Array.from(files)) {
      const duplicateOf = await checkDuplicate?.(file);
      if (duplicateOf) {
        toast.warning(`Essa foto já está em uso em "${duplicateOf}" — não precisa enviar de novo.`);
      }

      const id = crypto.randomUUID();
      setPending((prev) => [...prev, { id, fileName: file.name, progress: 0, cancel: () => {} }]);

      const result = await uploadImageToStorage(file, "products", {
        onProgress: (percent) => {
          setPending((prev) => prev.map((p) => (p.id === id ? { ...p, progress: percent } : p)));
        },
        registerCancel: (cancel) => {
          setPending((prev) => prev.map((p) => (p.id === id ? { ...p, cancel } : p)));
        },
      });

      setPending((prev) => prev.filter((p) => p.id !== id));

      if (!result.ok) {
        if (!result.cancelled) toast.error(`${file.name}: ${result.error}`);
        continue;
      }

      onChange([
        ...imagesRef.current,
        {
          url: result.url,
          alt: "",
          width: result.width,
          height: result.height,
          sizeBytes: result.sizeBytes,
          isNew: true,
        },
      ]);
    }
  }

  function updateAt(index: number, patch: Partial<ProductImageDraft>) {
    onChange(images.map((img, i) => (i === index ? { ...img, ...patch } : img)));
  }

  function removeAt(index: number) {
    const image = images[index];
    onChange(images.filter((_, i) => i !== index));
    if (image?.isNew) void deleteMediaAction(image.url);
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

      {images.length > 0 && images.length < MIN_RECOMMENDED_PHOTOS && (
        <p className="mb-3 flex items-center gap-2 text-xs text-[var(--warning)]">
          <AlertTriangle className="size-3.5 shrink-0" />
          Produtos com 3+ fotos convertem melhor.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {images.map((image, index) => {
          const lowRes = image.width !== undefined && image.width < MIN_RECOMMENDED_WIDTH;
          return (
            <div key={image.url + index} className="flex flex-col gap-2">
              <div
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null) reorder(dragIndex, index);
                  setDragIndex(null);
                }}
                className="group relative aspect-[4/5] cursor-grab overflow-hidden border border-line bg-[#111111] active:cursor-grabbing"
              >
                <Image src={image.url} alt="" fill sizes="200px" className="object-cover" />
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

              {(image.width || image.sizeBytes !== undefined) && (
                <p className="text-[10px] text-ink-muted">
                  {image.width && image.height ? `${image.width}×${image.height}px` : ""}
                  {image.sizeBytes !== undefined ? ` · ${formatFileSize(image.sizeBytes)}` : ""}
                </p>
              )}
              {lowRes && (
                <p className="flex items-center gap-1 text-[10px] text-[var(--warning)]">
                  <AlertTriangle className="size-3 shrink-0" />
                  Menos de 1200px — o zoom da página do produto vai ficar borrado.
                </p>
              )}

              <div className="flex flex-col gap-1">
                <Label htmlFor={`alt-${index}`} className="text-[10px]">
                  Texto alternativo
                </Label>
                <Input
                  id={`alt-${index}`}
                  value={image.alt}
                  onChange={(e) => updateAt(index, { alt: e.target.value })}
                  placeholder="Descreva a foto"
                  className="h-8 rounded-none text-xs"
                />
              </div>
            </div>
          );
        })}

        {pending.map((upload) => (
          <div
            key={upload.id}
            className="flex aspect-[4/5] flex-col items-center justify-center gap-2 self-start border border-line bg-[#111111] p-3 text-center"
          >
            <p className="w-full truncate text-[10px] text-ink-muted">{upload.fileName}</p>
            <div className="h-1 w-full bg-[#2a2a2a]">
              <div
                className="h-1 bg-gold transition-all duration-150 ease-out"
                style={{ width: `${upload.progress}%` }}
              />
            </div>
            <p className="text-[10px] text-ink-muted">{upload.progress}%</p>
            <Button type="button" variant="ghost" size="sm" onClick={upload.cancel}>
              Cancelar
            </Button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex aspect-[4/5] flex-col items-center justify-center gap-2 self-start border border-dashed border-line text-ink-muted hover:text-fg"
        >
          <Upload className="size-5" />
          <span className="text-xs">Adicionar</span>
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
      <p className="mt-3 text-xs text-ink-muted">
        Arraste para reordenar. A primeira imagem é a capa do produto.
      </p>
    </div>
  );
}
