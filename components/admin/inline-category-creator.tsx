"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { quickCreateCategoryAction } from "@/lib/actions/categories";

export function InlineCategoryCreator({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (category: { id: string; name: string; slug: string }) => void;
}) {
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setPending(true);
    const result = await quickCreateCategoryAction(name.trim());
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("Categoria criada.");
    onCreated(result.category);
    setName("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-none border-line bg-[#111111] text-fg">
        <DialogTitle className="text-heading text-lg">Nova categoria</DialogTitle>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-category-name">Nome</Label>
            <Input
              id="new-category-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Calçados"
              className="rounded-none"
            />
          </div>
          <Button type="submit" disabled={pending || !name.trim()} className="w-fit">
            {pending ? "Criando…" : "Criar categoria"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
