"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, MousePointerClick, RefreshCw, Shirt, Users } from "lucide-react";
import type { Ga4Status } from "@/lib/analytics/ga4-client";
import type { GaRealtime } from "@/lib/analytics/ga4-data";
import { MinutesChartLazy } from "./analytics-charts-lazy";
import { SourceTag } from "./kpi";
import { cn } from "@/lib/utils";

/** Every minute: GA4 realtime itself moves at about that pace, and it
 * keeps the property well inside its realtime quota. */
const REFRESH_MS = 60_000;

export const EVENT_LABEL: Record<string, string> = {
  page_view: "Página vista",
  view_item: "Produto visto",
  add_to_cart: "Adicionou à sacola",
  begin_checkout: "Iniciou checkout",
  purchase: "Compra confirmada",
  click_whatsapp: "Clique no WhatsApp",
  session_start: "Início de sessão",
  first_visit: "Primeira visita",
  user_engagement: "Engajamento",
  scroll: "Rolou a página",
  click: "Clique em link externo",
  view_search_results: "Busca no site",
  form_start: "Começou formulário",
  form_submit: "Enviou formulário",
  cookie_consent_granted: "Aceitou cookies",
};

const DEVICE_LABEL: Record<string, string> = {
  mobile: "Celular",
  desktop: "Computador",
  tablet: "Tablet",
};

type Payload = { status: Ga4Status; data: GaRealtime | null };

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Users }) {
  return (
    <div className="rounded-lg border border-line bg-bg p-3 md:p-4">
      <div className="mb-1 flex items-center gap-1.5 text-ink-muted">
        <Icon className="size-3.5" aria-hidden="true" />
        <p className="text-xs">{label}</p>
      </div>
      <p className="text-2xl font-semibold tabular-nums">{value.toLocaleString("pt-BR")}</p>
    </div>
  );
}

function List({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: { key: string; label: string; value: number }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="min-w-0">
      <p className="text-label mb-3">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.key} className="text-sm">
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className="truncate">{row.label}</span>
                <span className="shrink-0 tabular-nums text-ink-muted">{row.value.toLocaleString("pt-BR")}</span>
              </div>
              <div className="h-1 rounded-full bg-surface-2">
                <div className="h-1 rounded-full bg-gold" style={{ width: `${(row.value / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RealtimePanel({ initial }: { initial: Payload }) {
  const [payload, setPayload] = useState<Payload>(initial);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const response = await fetch("/admin/analytics/tempo-real", { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      setPayload((await response.json()) as Payload);
      setFailed(false);
    } catch {
      // Keep the last numbers on screen; say they are stale.
      setFailed(true);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Only while the tab is in view: a panel left open in a background tab
    // shouldn't spend the property's realtime quota.
    let timer: ReturnType<typeof setInterval> | null = null;
    function start() {
      if (timer) return;
      timer = setInterval(() => void refresh(), REFRESH_MS);
    }
    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
    }
    function onVisibility() {
      if (document.visibilityState === "visible") {
        void refresh();
        start();
      } else {
        stop();
      }
    }
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  const { status, data } = payload;
  const updated = data
    ? new Date(data.fetchedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  return (
    <section className="mb-8 rounded-lg border border-line bg-card p-4 md:p-6" aria-labelledby="realtime-title">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex size-2.5" aria-hidden="true">
              {status.ok && (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--success)] opacity-60" />
              )}
              <span
                className={cn(
                  "relative inline-flex size-2.5 rounded-full",
                  status.ok ? "bg-[var(--success)]" : "bg-ink-muted",
                )}
              />
            </span>
            <h2 id="realtime-title" className="text-lg font-semibold">
              Tempo real
            </h2>
            <SourceTag source="ga4" />
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            Últimos 30 minutos. Atualiza sozinho a cada minuto
            {updated ? ` · última leitura às ${updated}` : ""}
            {failed ? " · sem conexão agora, mostrando a leitura anterior" : ""}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm text-ink-muted transition-colors hover:border-line-strong hover:text-fg disabled:opacity-60"
        >
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} aria-hidden="true" />
          Atualizar
        </button>
      </div>

      {!status.ok || !data ? (
        <p className="text-sm text-ink-muted">
          {status.ok
            ? "Sem dados."
            : status.reason === "not_configured"
              ? "O tempo real aparece aqui assim que a conexão com o Google Analytics for configurada (veja o aviso acima)."
              : status.message}
        </p>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Ativos agora (5 min)" value={data.active5} icon={Users} />
            <Stat label="Ativos (30 min)" value={data.active30} icon={Users} />
            <Stat label="Páginas vistas (30 min)" value={data.pageViews30} icon={Eye} />
            <Stat label="Produtos vistos (30 min)" value={data.productViews30} icon={Shirt} />
          </div>

          <div className="mb-6">
            <p className="text-label mb-2">Visitantes ativos por minuto</p>
            <MinutesChartLazy data={data.perMinute} />
            <div className="mt-1 flex justify-between text-[11px] text-ink-muted">
              <span>há 30 min</span>
              <span>agora</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            <List
              title="Eventos recentes"
              empty="Nenhum evento nos últimos 30 minutos."
              rows={data.events.map((e) => ({
                key: e.name,
                label: EVENT_LABEL[e.name] ?? e.name,
                value: e.count,
              }))}
            />
            <List
              title="Páginas agora"
              empty="Ninguém navegando agora."
              rows={data.pages.map((p) => ({ key: p.title, label: p.title || "(sem título)", value: p.views }))}
            />
            <div className="flex flex-col gap-6">
              <List
                title="Localização aproximada"
                empty="Sem localização disponível."
                rows={data.locations.map((l) => ({
                  key: `${l.country}|${l.city}`,
                  label: l.city ? `${l.city}, ${l.country}` : l.country,
                  value: l.users,
                }))}
              />
              {data.devices.length > 0 && (
                <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-muted">
                  {data.devices.map((d) => (
                    <span key={d.device}>
                      {DEVICE_LABEL[d.device] ?? d.device}: {d.users}
                    </span>
                  ))}
                </p>
              )}
            </div>
            <div>
              <List
                title="Origem (hoje)"
                empty="Sem origem registrada hoje ainda."
                rows={data.sourcesToday.map((s) => ({ key: s.key, label: s.label, value: s.sessions }))}
              />
              <p className="mt-2 flex items-center gap-1 text-[11px] text-ink-muted">
                <MousePointerClick className="size-3" aria-hidden="true" />
                Sessões do dia, relatório consolidado (pode atrasar).
              </p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
