"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import Image from "next/image";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LOGO_ACCEPT, uploadImageToStorage, uploadLogoToStorage } from "@/lib/client-upload";
import { deleteMediaAction } from "@/lib/actions/media";
import type { UploadFolder } from "@/lib/image-url";

export function ImageUploader({
  label,
  value,
  onChange,
  folder,
  kind = "photo",
  aspect = "aspect-video",
  savingRef,
  checkDuplicate,
}: {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  folder: UploadFolder;
  /** "logo": the store logo — PNG, SVG or WebP, kept as a transparent PNG
   * with its icons (uploadLogoToStorage), previewed whole on black, the
   * background it is shown on. */
  kind?: "photo" | "logo";
  aspect?: string;
  /** Set to true by the parent form right before a real submit — skips
   * the unmount cleanup so a just-saved image isn't deleted out from
   * under the product/banner that now references it.
   *
   * Required on purpose: a form that forgets it looks fine right up to
   * the moment it saves, because the cleanup then deletes the file the
   * row it just wrote is pointing at, leaving a broken image in the shop.
   * Making it required moves that from a silent data loss to a compile
   * error. */
  savingRef: RefObject<boolean>;
  /** Optional cross-field duplicate check (product form only) — if the
   * picked file's content already lives in another field of the same
   * product, resolves to that field's label so the operator can be
   * warned instead of silently ending up with the same photo twice. */
  checkDuplicate?: (file: File) => Promise<string | undefined>;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadedThisSession = useRef<Set<string>>(new Set());
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    return () => {
      // savingRef/uploadedThisSession/valueRef are plain mutable-value
      // refs (not DOM refs) — reading `.current` here intentionally gets
      // whatever it was most recently set to, which is required for
      // this cleanup to see the final state at unmount time.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (savingRef.current) return;
      const current = valueRef.current;
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (current && uploadedThisSession.current.has(current)) {
        void deleteMediaAction(current);
      }
    };
  }, [savingRef]);

  async function handleFile(file: File) {
    const duplicateOf = await checkDuplicate?.(file);
    if (duplicateOf) {
      toast.warning(`Essa foto já está em uso em "${duplicateOf}" — não precisa enviar de novo.`);
    }

    setProgress(0);
    const previous = value;
    const options = {
      onProgress: setProgress,
      registerCancel: (cancel: () => void) => {
        cancelRef.current = cancel;
      },
    };
    const result =
      kind === "logo"
        ? await uploadLogoToStorage(file, options)
        : await uploadImageToStorage(file, folder, options);
    setProgress(null);

    if (!result.ok) {
      if (!result.cancelled) toast.error(result.error);
      return;
    }

    uploadedThisSession.current.add(result.url);
    if (previous && uploadedThisSession.current.has(previous)) {
      void deleteMediaAction(previous);
      uploadedThisSession.current.delete(previous);
    }
    onChange(result.url);
  }

  function handleRemove() {
    if (value && uploadedThisSession.current.has(value)) {
      void deleteMediaAction(value);
      uploadedThisSession.current.delete(value);
    }
    onChange(null);
  }

  return (
    <div>
      <p className="text-label mb-3">{label}</p>
      <div
        className={`relative ${aspect} w-full overflow-hidden rounded-lg border border-dashed border-line ${
          kind === "logo" ? "bg-black" : "bg-field"
        }`}
      >
        {progress !== null ? (
          <div className="flex size-full flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="h-1 w-full max-w-40 bg-line">
              <div
                className="h-1 bg-accent-solid transition-all duration-150 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-ink-muted">{progress}%</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => cancelRef.current?.()}
            >
              Cancelar
            </Button>
          </div>
        ) : value ? (
          <>
            {/* Straight from Storage: the file was just compressed to WebP
                in the browser, so the optimizer adds nothing here but a
                dependency on the Vercel image quota — when it ran out,
                every new upload showed as a broken image. */}
            <Image
              src={value}
              alt=""
              fill
              unoptimized
              className={kind === "logo" ? "object-contain p-4" : "object-cover"}
            />
            <button
              type="button"
              onClick={handleRemove}
              aria-label="Remover imagem"
              className="absolute right-2 top-2 flex size-7 items-center justify-center bg-black/70 text-white hover:bg-black"
            >
              <X className="size-4" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex size-full flex-col items-center justify-center gap-2 text-ink-muted hover:text-fg"
          >
            <Upload className="size-5" />
            <span className="text-xs">
              {kind === "logo" ? "Enviar logo (PNG transparente, SVG ou WebP)" : "Enviar imagem"}
            </span>
          </button>
        )}
      </div>
      {value && progress === null && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-xs text-ink-muted underline underline-offset-4 hover:text-fg"
          >
            {kind === "logo" ? "Trocar logo" : "Trocar imagem"}
          </button>
          {kind === "logo" && (
            <button
              type="button"
              onClick={handleRemove}
              className="text-xs text-ink-muted underline underline-offset-4 hover:text-fg"
            >
              Remover logo (volta ao nome em texto)
            </button>
          )}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={kind === "logo" ? LOGO_ACCEPT : "image/*"}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
