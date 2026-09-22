"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ShopErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="storefront-theme flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg px-8 text-center text-fg">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Algo deu errado</p>
      <h1 className="text-2xl font-bold text-fg md:text-3xl">Erro inesperado</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Não foi possível carregar esta página. Tente novamente em instantes.
      </p>
      <Button size="lg" className="mt-4" onClick={reset}>
        <RefreshCw className="size-4" /> Tentar novamente
      </Button>
    </div>
  );
}
