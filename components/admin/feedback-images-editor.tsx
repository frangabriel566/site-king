"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, GripVertical, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { uploadImageToStorage } from "@/lib/client-upload";
import { deleteMediaAction } from "@/lib/actions/media";
import { FEEDBACK_MAX_IMAGES } from "@/lib/validations/feedback";
import type { FeedbackImageKind } from "@/lib/database.types";

export type FeedbackImageDraft = {
  url: string;
  kind: FeedbackImageKind;
  width?: number | null;
  height?: number | null;
  /** Uploaded in this editing session — deleted from storage if it is
   * removed, or if the form is left without saving. */
  isNew?: boolean;
};

type Pending = { id: string; name: string; progress: number };

/** A screenshot is tall: a phone screen is ~9:19.5, a photo ~3:4. */
function guessKind(width: number, height: number): FeedbackImageKind {
  return height / width >= 1.75 ? "chat" : "photo";
}

/**
 * The feedback's images: several at once (compressed in the browser before
 * upload; prints keep up to 2400px so the text stays readable), a preview
 * per image, its type (Foto / Print), its place (drag on a computer, the
 * arrows anywhere — dragging doesn't exist on a touch screen) and removal.
 */
export function FeedbackImagesEditor({
  images,
  onChange,
  savingRef,
}: {
  images: FeedbackImageDraft[];
  onChange: (images: FeedbackImageDraft[]) => void;
  /** Set by the form right before a real submit, so leaving the page after
   * saving doesn't delete what was just saved (see ImageUploader). */
  savingRef: RefObject<boolean>;
}) {
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef(images);
  imagesRef.current = images;

  // Leaving without saving: this session's uploads are orphans.
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (savingRef.current) return;
      for (const image of imagesRef.current) {
        if (image.isNew) void deleteMediaAction(image.url);
      }
    };
  }, [savingRef]);

  const room = FEEDBACK_MAX_IMAGES - images.length - pending.length;

  async function handleFiles(list: FileList | null) {
    if (!list) return;
    const files = Array.from(list).filter((file) => file.type.startsWith("image/"));
    if (files.length > room) {
      toast.warning(
        room > 0
          ? `Só cabem mais ${room} ${room === 1 ? "imagem" : "imagens"} (máximo ${FEEDBACK_MAX_IMAGES}).`
          : `Este feedback já tem ${FEEDBACK_MAX_IMAGES} imagens.`,
      );
    }
    for (const file of files.slice(0, Math.max(room, 0))) {
      const id = crypto.randomUUID();
      setPending((prev) => [...prev, { id, name: file.name, progress: 0 }]);
      const result = await uploadImageToStorage(file, "feedbacks", {
        onProgress: (progress) =>
          setPending((prev) => prev.map((p) => (p.id === id ? { ...p, progress } : p))),
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
          kind: guessKind(result.width, result.height),
          width: result.width,
          height: result.height,
          isNew: true,
        },
      ]);
    }
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= images.length || from === to) return;
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  }

  function remove(index: number) {
    const image = images[index];
    onChange(images.filter((_, i) => i !== index));
    if (image?.isNew) void deleteMediaAction(image.url);
  }

  function setKind(index: number, kind: FeedbackImageKind) {
    onChange(images.map((image, i) => (i === index ? { ...image, kind } : image)));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-label">
          Imagens ({images.length}/{FEEDBACK_MAX_IMAGES})
        </p>
        <button
          type="button"
          disabled={room <= 0}
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-fg transition-colors hover:border-ink-muted disabled:opacity-50"
        >
          <ImagePlus className="size-4" aria-hidden="true" />
          Adicionar imagens
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => {
            void handleFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>
      <p className="text-xs text-ink-muted">
        Fotos do celular ou prints da conversa — várias de uma vez. Elas são reduzidas
        antes de enviar. A primeira é a imagem principal do card; arraste ou use as setas
        para mudar a ordem.
      </p>

      {(images.length > 0 || pending.length > 0) && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((image, index) => (
            <li
              key={image.url}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null) move(dragIndex, index);
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
              className={`flex flex-col overflow-hidden rounded-lg border bg-field ${
                dragIndex === index ? "border-accent-solid opacity-60" : "border-line"
              }`}
            >
              <div className="relative aspect-[3/4] bg-black/20">
                <Image
                  src={image.url}
                  alt={`Imagem ${index + 1}`}
                  fill
                  unoptimized
                  className={image.kind === "chat" ? "object-contain" : "object-cover"}
                />
                <span className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                  <GripVertical className="size-3" aria-hidden="true" />
                  {index === 0 ? "Principal" : index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label={`Remover imagem ${index + 1}`}
                  className="absolute top-1.5 right-1.5 flex size-8 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
              <div className="flex items-center justify-between gap-1 p-1.5">
                <button
                  type="button"
                  onClick={() => move(index, index - 1)}
                  disabled={index === 0}
                  aria-label={`Mover imagem ${index + 1} para a esquerda`}
                  className="flex size-8 items-center justify-center rounded text-ink-muted hover:bg-surface-2 hover:text-fg disabled:opacity-30"
                >
                  <ArrowLeft className="size-4" aria-hidden="true" />
                </button>
                <div role="group" aria-label={`Tipo da imagem ${index + 1}`} className="flex rounded-md border border-line text-xs">
                  {(["photo", "chat"] as const).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => setKind(index, kind)}
                      aria-pressed={image.kind === kind}
                      className={`px-2 py-1 ${
                        image.kind === kind ? "bg-accent-solid text-white" : "text-ink-muted hover:text-fg"
                      }`}
                    >
                      {kind === "photo" ? "Foto" : "Print"}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => move(index, index + 1)}
                  disabled={index === images.length - 1}
                  aria-label={`Mover imagem ${index + 1} para a direita`}
                  className="flex size-8 items-center justify-center rounded text-ink-muted hover:bg-surface-2 hover:text-fg disabled:opacity-30"
                >
                  <ArrowRight className="size-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
          {pending.map((item) => (
            <li
              key={item.id}
              className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line p-3 text-center"
            >
              <div className="h-1 w-full max-w-24 bg-line">
                <div className="h-1 bg-accent-solid transition-all" style={{ width: `${item.progress}%` }} />
              </div>
              <p className="w-full truncate text-xs text-ink-muted">{item.name}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
