"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, Grid3x3 } from "lucide-react";

export function DensityToggle() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const density = searchParams.get("densidade") === "confortavel" ? "confortavel" : "compacto";

  function setDensity(value: "compacto" | "confortavel") {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "compacto") params.delete("densidade");
    else params.set("densidade", value);
    router.push(`/colecao?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="hidden items-center gap-1 rounded-md border border-line p-1 sm:flex">
      <button
        type="button"
        onClick={() => setDensity("compacto")}
        aria-label="Grade compacta"
        aria-pressed={density === "compacto"}
        className={`flex size-7 items-center justify-center rounded-sm ${
          density === "compacto" ? "bg-cta text-white" : "text-muted-foreground hover:text-fg"
        }`}
      >
        <Grid3x3 className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => setDensity("confortavel")}
        aria-label="Grade confortável"
        aria-pressed={density === "confortavel"}
        className={`flex size-7 items-center justify-center rounded-sm ${
          density === "confortavel" ? "bg-cta text-white" : "text-muted-foreground hover:text-fg"
        }`}
      >
        <LayoutGrid className="size-4" />
      </button>
    </div>
  );
}
