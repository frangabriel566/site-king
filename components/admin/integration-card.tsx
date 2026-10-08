"use client";

import { startTransition, useActionState, useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, Loader2, PlugZap, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  setIntegrationActiveAction,
  testIntegrationAction,
  type IntegrationFormResult,
} from "@/lib/actions/integrations";
import type { IntegrationView } from "@/lib/data/integrations";
import { formatDateTime } from "@/lib/format";

export type SecretField = { name: string; label: string; help?: string };

const initialState: IntegrationFormResult = { status: "idle" };

/** A saved token as the panel shows it: "••••3f9a", and "Substituir"
 * opens an empty field. The value itself never comes to the browser. */
function SecretInput({ field, hint, id }: { field: SecretField; hint?: string; id: string }) {
  const [replacing, setReplacing] = useState(!hint);
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{field.label}</Label>
      {replacing ? (
        <Input
          id={id}
          name={field.name}
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={hint ? "Cole o novo valor" : "Cole aqui"}
        />
      ) : (
        <div className="flex items-center gap-3">
          <code className="rounded-md border border-line bg-field px-3 py-2 text-sm tracking-widest">
            ••••{hint}
          </code>
          <Button type="button" variant="outline" size="sm" onClick={() => setReplacing(true)}>
            Substituir
          </Button>
        </div>
      )}
      {field.help && <p className="text-xs text-ink-muted">{field.help}</p>}
    </div>
  );
}

export function CopyValue({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border border-line bg-field px-3 py-2 text-xs">
          {value}
        </code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              toast.success("Copiado.");
            } catch {
              window.prompt("Copie:", value);
            }
          }}
        >
          <Copy className="size-3.5" aria-hidden="true" />
          Copiar
        </Button>
      </div>
    </div>
  );
}

/**
 * One integration on Admin → Integrações: credentials (tokens masked once
 * saved), "Testar conexão" with a real call, and "Ativo" — which only
 * switches on after a passing test of what is saved.
 */
export function IntegrationCard({
  view,
  title,
  description,
  environmentLabels,
  secretFields,
  emailField = false,
  keyConfigured,
  activationBlocked = null,
  saveAction,
  children,
}: {
  view: IntegrationView;
  title: string;
  description: string;
  environmentLabels: Record<"test" | "production", string>;
  secretFields: SecretField[];
  /** Melhor Envio's contact e-mail (not secret, shown in full). */
  emailField?: boolean;
  keyConfigured: boolean;
  /** Why "Ativo" can't be switched on yet, beyond the test. */
  activationBlocked?: string | null;
  saveAction: (prev: IntegrationFormResult, formData: FormData) => Promise<IntegrationFormResult>;
  children?: ReactNode;
}) {
  const router = useRouter();
  const [state, formAction, saving] = useActionState(saveAction, initialState);
  const [busy, startBusy] = useTransition();
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (state.status === "error" && state.message) toast.error(state.message);
    if (state.status === "success") {
      if (state.message) toast.success(state.message);
      // Fresh hints, test and switch from the server; the token fields
      // close back to "••••" with the new ending.
      setFormKey((key) => key + 1);
      router.refresh();
    }
  }, [state, router]);

  function test() {
    startBusy(async () => {
      const result = await testIntegrationAction(view.provider);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
      router.refresh();
    });
  }

  function setActive(active: boolean) {
    startBusy(async () => {
      const result = await setIntegrationActiveAction(view.provider, active);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
      router.refresh();
    });
  }

  const canActivate = view.saved && view.testOk && !activationBlocked;

  return (
    <section className="rounded-lg border border-line bg-card p-5 md:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <h2 className="text-lg font-semibold text-fg">{title}</h2>
          <p className="mt-1 text-sm text-ink-muted">{description}</p>
        </div>
        <div className="flex items-center gap-3">
          <Label htmlFor={`${view.provider}-active`} className="text-sm">
            Ativo
          </Label>
          <Switch
            id={`${view.provider}-active`}
            checked={view.active}
            disabled={busy || !view.saved || (!view.active && !canActivate)}
            onCheckedChange={setActive}
          />
        </div>
      </div>

      {view.source === "env" && (
        <p className="mb-5 rounded-md border border-line bg-field p-3 text-xs text-ink-muted">
          Hoje em uso pelas variáveis de ambiente antigas (reserva). Ao salvar
          aqui, o painel passa a valer.
        </p>
      )}
      {/* Said up front, before anything is saved: what still stands
          between this service and "Ativo". */}
      {!view.active && activationBlocked && (
        <p className="mb-5 rounded-md border border-[var(--warning)]/40 bg-[var(--warning)]/10 p-3 text-sm text-fg">
          {activationBlocked}
        </p>
      )}

      <form
        key={formKey}
        // By hand: React 19 clears a <form action> after every submit, and
        // a refused token would take the other fields with it.
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          startTransition(() => formAction(data));
        }}
        className="flex flex-col gap-5"
      >
        <div className="flex max-w-xs flex-col gap-2">
          <Label htmlFor={`${view.provider}-environment`}>Ambiente</Label>
          <Select name="environment" defaultValue={view.environment}>
            <SelectTrigger id={`${view.provider}-environment`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="test">{environmentLabels.test}</SelectItem>
              <SelectItem value="production">{environmentLabels.production}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {secretFields.map((field) => (
          <SecretInput
            key={field.name}
            field={field}
            hint={view.hints[field.name]}
            id={`${view.provider}-${field.name}`}
          />
        ))}

        {emailField && (
          <div className="flex max-w-md flex-col gap-2">
            <Label htmlFor={`${view.provider}-email`}>E-mail de contato da conta</Label>
            <Input
              id={`${view.provider}-email`}
              name="email"
              type="email"
              defaultValue={view.email ?? ""}
              placeholder="contato@sitekingstore.com.br"
            />
            <p className="text-xs text-ink-muted">
              Vai junto de cada chamada; o Melhor Envio exige.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={saving || !keyConfigured}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
          <Button type="button" variant="outline" onClick={test} disabled={busy || !view.saved}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <PlugZap className="size-4" aria-hidden="true" />
            )}
            Testar conexão
          </Button>
        </div>
      </form>

      {view.testedAt && (
        <p
          className={`mt-4 flex items-start gap-2 text-sm ${view.testOk ? "text-[var(--success)]" : "text-[var(--danger)]"}`}
        >
          {view.testOk ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          ) : (
            <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          )}
          <span>
            {view.testMessage}
            <span className="block text-xs text-ink-muted">
              Último teste em {formatDateTime(view.testedAt)}
            </span>
          </span>
        </p>
      )}

      {children && <div className="mt-6 flex flex-col gap-5 border-t border-line pt-5">{children}</div>}

      {view.updatedAt && (
        <p className="mt-5 text-xs text-ink-muted">
          Alterado por {view.updatedBy ?? "—"} em {formatDateTime(view.updatedAt)}.
        </p>
      )}
    </section>
  );
}
