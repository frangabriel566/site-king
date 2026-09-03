"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import Image from "next/image";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { uploadImageToStorage } from "@/lib/client-upload";
import { deleteMediaAction } from "@/lib/actions/media";

export function ImageUploader({
  label,
  value,
  onChange,
  folder,
  aspect = "aspect-video",
  savingRef,
  checkDuplicate,
}: {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  folder: "banners" | "products" | "brand";
  aspect?: string;
  /** Set to true by the parent form right before a real submit — skips
   * the unmount cleanup so a just-saved image isn't deleted out from
   * under the product/banner that now references it. */
  savingRef?: RefObject<boolean>;
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
      if (savingRef?.current) return;
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
    const result = await uploadImageToStorage(file, folder, {
      onProgress: setProgress,
      registerCancel: (cancel) => {
        cancelRef.current = cancel;
      },
    });
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
        className={`relative ${aspect} w-full overflow-hidden border border-dashed border-line bg-[#111111]`}
      >
        {progress !== null ? (
          <div className="flex size-full flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="h-1 w-full max-w-40 bg-[#2a2a2a]">
              <div
                className="h-1 bg-gold transition-all duration-150 ease-out"
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
            <Image src={value} alt="" fill sizes="400px" className="object-cover" />
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
            <span className="text-xs">Enviar imagem</span>
          </button>
        )}
      </div>
      {value && progress === null && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-2 text-xs text-ink-muted underline underline-offset-4 hover:text-fg"
        >
          Trocar imagem
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
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
