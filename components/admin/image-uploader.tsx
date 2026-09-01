"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { uploadMediaAction } from "@/lib/actions/media";

export function ImageUploader({
  label,
  value,
  onChange,
  folder,
  aspect = "aspect-video",
}: {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  folder: "banners" | "products" | "brand";
  aspect?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    const formData = new FormData();
    formData.set("file", file);
    const result = await uploadMediaAction(folder, formData);
    setUploading(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    onChange(result.url);
  }

  return (
    <div>
      <p className="text-label mb-3">{label}</p>
      <div
        className={`relative ${aspect} w-full overflow-hidden border border-dashed border-line bg-[#111111]`}
      >
        {value ? (
          <>
            <Image src={value} alt="" fill sizes="400px" className="object-cover" />
            <button
              type="button"
              onClick={() => onChange(null)}
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
            disabled={uploading}
            className="flex size-full flex-col items-center justify-center gap-2 text-ink-muted hover:text-fg"
          >
            {uploading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Upload className="size-5" />
            )}
            <span className="text-xs">
              {uploading ? "Enviando…" : "Enviar imagem"}
            </span>
          </button>
        )}
      </div>
      {value && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="mt-2 text-xs text-ink-muted underline underline-offset-4 hover:text-fg"
        >
          {uploading ? "Enviando…" : "Trocar imagem"}
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
