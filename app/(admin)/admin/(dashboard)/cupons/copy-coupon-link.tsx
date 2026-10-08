"use client";

import { Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * "Copiar link": the address that applies the coupon on any page of the
 * store (`?cupom=CODIGO`, components/shop/coupon-from-link.tsx) — ready to
 * paste in a post, a story or a WhatsApp broadcast.
 */
export function CopyCouponLink({ code, url }: { code: string; url: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(`Link do cupom ${code} copiado.`, { description: url });
    } catch {
      // Clipboard blocked (an insecure origin, an old browser): the link
      // still has to reach the store, so it is shown to copy by hand.
      window.prompt("Copie o link do cupom:", url);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={copy}
      aria-label={`Copiar o link do cupom ${code}`}
      title="Copiar link"
    >
      <Link2 className="size-4" />
    </Button>
  );
}
