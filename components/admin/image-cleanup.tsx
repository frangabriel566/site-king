"use client";

import { useState, useTransition } from "react";
import { Loader2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { analyzeOrphanImagesAction, deleteOrphanImagesAction } from "@/lib/actions/media";
import type { OrphanReport } from "@/lib/media/cleanup";
import { formatDateTime } from "@/lib/format";

// The server takes at most this many per call (DELETE_BATCH in
// lib/media/cleanup.ts).
const BATCH = 25;

const FOLDER_LABEL: Record<string, string> = {
  products: "Produto",
  banners: "Banner",
  brand: "Logo / marca",
  categories: "Categoria",
  feedbacks: "Feedback",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/**
 * Admin → Faxina de imagens: "Analisar" lists the uploads nothing uses
 * (read-only); "Apagar" asks first, then deletes them in batches, each one
 * checked against the database again on the server.
 */
export function ImageCleanup() {
  const [report, setReport] = useState<OrphanReport | null>(null);
  const [analyzing, startAnalyze] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);

  function analyze() {
    setOutcome(null);
    startAnalyze(async () => {
      const result = await analyzeOrphanImagesAction();
      if (result.ok) setReport(result.report);
      else toast.error(result.message);
    });
  }

  async function deleteAll() {
    if (!report) return;
    setConfirming(false);
    const keys = report.orphans.map((orphan) => orphan.key);
    let deleted = 0;
    let nowInUse = 0;
    let error: string | null = null;
    setProgress({ done: 0, total: keys.length });
    for (let start = 0; start < keys.length && !error; start += BATCH) {
      const result = await deleteOrphanImagesAction(keys.slice(start, start + BATCH));
      deleted += result.deleted;
      nowInUse += result.nowInUse;
      error = result.error;
      setProgress({ done: Math.min(start + BATCH, keys.length), total: keys.length });
    }
    setProgress(null);
    setReport(null);
    const parts = [`${deleted} ${deleted === 1 ? "imagem apagada" : "imagens apagadas"}.`];
    if (nowInUse > 0) {
      parts.push(
        nowInUse === 1
          ? "1 voltou a ser usada desde a análise e ficou."
          : `${nowInUse} voltaram a ser usadas desde a análise e ficaram.`,
      );
    }
    if (error) parts.push(error);
    setOutcome(parts.join(" "));
    if (error) toast.error(error);
    else toast.success(parts[0]);
  }

  const busy = analyzing || progress !== null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={analyze} disabled={busy}>
          {analyzing ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Search className="size-4" aria-hidden="true" />
          )}
          {report ? "Analisar de novo" : "Analisar imagens"}
        </Button>
        {report && report.orphans.length > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setConfirming(true)}
            disabled={busy}
            className="border-[var(--danger)]/50 text-[var(--danger)] hover:bg-[var(--danger)]/10"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Apagar {report.orphans.length} {report.orphans.length === 1 ? "imagem" : "imagens"}
          </Button>
        )}
      </div>

      {progress && (
        <div className="rounded-lg border border-line bg-card p-4 text-sm text-fg" role="status">
          <p>
            Apagando… {progress.done} de {progress.total}
          </p>
          <div className="mt-2 h-1 w-full bg-line">
            <div
              className="h-1 bg-accent-solid transition-all"
              style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {outcome && (
        <p className="rounded-lg border border-line bg-card p-4 text-sm text-fg" role="status">
          {outcome}
        </p>
      )}

      {report && (
        <section className="rounded-lg border border-line bg-card p-5">
          <p className="text-label mb-2">Resultado da análise</p>
          {report.orphans.length === 0 ? (
            <p className="text-lg font-semibold text-fg">Nenhuma imagem sem uso. Está tudo limpo.</p>
          ) : (
            <p className="text-lg font-semibold text-fg">
              {report.orphans.length} {report.orphans.length === 1 ? "imagem sem uso" : "imagens sem uso"} ·{" "}
              {formatBytes(report.totalBytes)}
              {report.unmeasured > 0 && (
                <span className="text-sm font-normal text-ink-muted">
                  {" "}
                  (+ {report.unmeasured} sem tamanho medido nesta análise)
                </span>
              )}
            </p>
          )}
          <ul className="mt-3 flex flex-col gap-1 text-sm text-ink-muted">
            <li>{report.inUse} em uso no site (não são tocadas)</li>
            {report.recent > 0 && (
              <li>{report.recent} sem uso, mas enviadas nas últimas 24 horas (ficam de fora)</li>
            )}
            {report.foreign > 0 && <li>{report.foreign} arquivos que não são fotos do site (ignorados)</li>}
          </ul>

          {report.orphans.length > 0 && (
            <ul className="mt-5 flex flex-col divide-y divide-line border-t border-line">
              {report.orphans.map((orphan) => (
                <li key={orphan.key} className="flex items-center gap-3 py-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a plain preview of the stored thumbnail */}
                  <img
                    src={`/img/${orphan.key}?v=sm`}
                    alt=""
                    loading="lazy"
                    className="size-12 shrink-0 rounded border border-line bg-field object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-fg">{FOLDER_LABEL[orphan.folder] ?? orphan.folder}</p>
                    <p className="truncate text-xs text-ink-muted" title={orphan.key}>
                      {orphan.key}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-xs text-ink-muted">
                    <p className="text-sm text-fg">
                      {orphan.bytes === null ? "—" : formatBytes(orphan.bytes)}
                    </p>
                    <p>{orphan.uploadedAt ? formatDateTime(orphan.uploadedAt) : "envio antigo"}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent className="border-line bg-card text-fg">
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar as imagens sem uso?</AlertDialogTitle>
            <AlertDialogDescription>
              {report?.orphans.length ?? 0} {report?.orphans.length === 1 ? "imagem" : "imagens"}
              {report && report.totalBytes > 0 ? ` (${formatBytes(report.totalBytes)})` : ""} saem do
              armazenamento, com as miniaturas. Cada uma é conferida de novo antes de apagar: se
              voltou a ser usada, fica. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void deleteAll()}
              className="bg-[var(--danger)] text-white hover:bg-[var(--danger)]/80"
            >
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
