"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { quickCreateBrandAction } from "@/lib/actions/brands";

export function InlineBrandCreator({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (brand: { id: string; name: string; slug: string }) => void;
}) {
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setPending(true);
    const result = await quickCreateBrandAction(name.trim());
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("Marca criada.");
    onCreated(result.brand);
    setName("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border-line bg-card text-fg">
        <DialogTitle className="text-heading text-lg">Nova marca</DialogTitle>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-brand-name">Nome</Label>
            <Input
              id="new-brand-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: King Store"
            />
          </div>
          <Button type="submit" disabled={pending || !name.trim()} className="w-fit">
            {pending ? "Criando…" : "Criar marca"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
