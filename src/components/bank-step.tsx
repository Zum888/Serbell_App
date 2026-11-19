"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ACCOUNTING_LABEL, DOCUMENT_LABEL, REVIEW_LABEL } from "@/lib/labels";
import { formatUsd } from "@/lib/money";

export type BankStepData = {
  accountHref: string;
  progress: string;
  donePercent: number;
  hints: string;
  sealed: boolean;
  merchant: string;
  postedOn: string;
  description: string;
  amountCents: number;
  storedBalanceCents: number;
  runningCents: number;
  categoryLabel: string;
  documentName: string | null;
  documentState: string;
  reviewState: string;
  accountingState: string;
  transactionId: string;
  nextSkip: string | null;
};

export function BankStep({
  data,
  error,
  autoMatch,
}: {
  data: BankStepData;
  error?: string;
  autoMatch?: { file: string; nextHref: string; note: string } | null;
}) {
  const [phase, setPhase] = useState<"search" | "match" | "idle">(autoMatch && !data.sealed ? "search" : "idle");
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (event.key === "Escape") {
        event.preventDefault();
        window.location.assign(data.accountHref);
        return;
      }
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.key === "Enter" && !data.sealed) {
        event.preventDefault();
        (document.getElementById("bank-reconcile-form") as HTMLFormElement | null)?.requestSubmit();
      }
      if ((event.key === "s" || event.key === "S") && data.nextSkip) {
        event.preventDefault();
        window.location.assign(data.nextSkip);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [data]);

  useEffect(() => {
    if (phase === "idle") return;
    if (phase === "search") {
      const timer = window.setTimeout(() => setPhase("match"), 1100);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => {
      (document.getElementById("bank-reconcile-form") as HTMLFormElement | null)?.requestSubmit();
    }, 900);
    return () => window.clearTimeout(timer);
  }, [phase]);

  return (
    <section data-testid="bank-step">
      {phase !== "idle" ? (
        <p className="mb-4 rounded-2xl bg-white px-4 py-3 text-sm text-slate-700 shadow-sm" data-testid="invoice-match">
          {phase === "search"
            ? `Busco en la cuenta el cargo que coincide con ${autoMatch?.file}.`
            : `Coincide con ${data.merchant}, ${formatUsd(data.amountCents)}. ${autoMatch?.note ?? "Lo concilio."}`}
        </p>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href={data.accountHref} className="text-sm text-primary">Volver a la cuenta</Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Conciliar con el banco</h1>
        </div>
        <p className="text-xs text-slate-500" data-testid="bank-hints">{data.hints}</p>
      </div>
      <div className="mt-3">
        <p className="text-sm" data-testid="bank-progress">{data.progress}</p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-primary" style={{ width: `${data.donePercent}%` }} />
        </div>
      </div>
      {error ? <p className="mt-3 text-sm text-red-700" data-testid="server-error">{error}</p> : null}
      <div className="mt-4 grid items-start gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-border bg-white p-4">
          <p className="text-xs text-slate-500">{data.postedOn}</p>
          <h2 className="text-xl font-semibold" data-testid="bank-merchant">{data.merchant}</h2>
          <p className="text-2xl font-semibold tracking-tight">{formatUsd(data.amountCents)}</p>
          <p className="mt-1 text-sm text-slate-500">{data.description}</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Saldo guardado de la cuenta</dt>
              <dd className="font-medium">{formatUsd(data.storedBalanceCents)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Suma de movimientos hasta esta fecha</dt>
              <dd className="font-medium">{formatUsd(data.runningCents)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-slate-500">La suma recorre los movimientos guardados. No reemplaza el saldo de la cuenta.</p>
          {data.sealed ? (
            <p className="mt-4 text-sm text-slate-600">Sellado. El servidor rechaza el cambio.</p>
          ) : (
            <form id="bank-reconcile-form" action={`/api/transactions/${data.transactionId}/bank`} method="post" className="mt-4">
              <input type="hidden" name="action" value="reconcile" />
              <input type="hidden" name="stay" value={autoMatch ? "1" : ""} />
              <input type="hidden" name="next" value={autoMatch ? autoMatch.nextHref : data.accountHref} />
              <Button type="submit" data-testid="bank-reconcile">Conciliar con el banco</Button>
            </form>
          )}
          <form action={`/api/transactions/${data.transactionId}/bank`} method="post" className="mt-2">
            <input type="hidden" name="action" value="undo" />
            <input type="hidden" name="next" value={`${data.accountHref}&paso=conciliar&actual=${data.transactionId}`} />
            <Button type="submit" variant="outline" data-testid="bank-undo" disabled={data.sealed}>Deshacer conciliación</Button>
          </form>
          {data.nextSkip ? (
            <Link href={data.nextSkip} data-testid="bank-skip" className="mt-3 inline-flex text-sm text-slate-500">Omitir (S)</Link>
          ) : null}
        </article>
        <aside className="rounded-2xl border border-border bg-white p-4">
          <p className="text-xs text-slate-500">Lo que ya está anotado</p>
          <h2 className="text-lg font-semibold">No cambia el banco</h2>
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Comprobante</dt>
              <dd>{data.documentName ?? "Sin comprobante"} · {DOCUMENT_LABEL[data.documentState] ?? data.documentState}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Categoría</dt>
              <dd>{data.categoryLabel}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Estado contable</dt>
              <dd>{ACCOUNTING_LABEL[data.accountingState] ?? data.accountingState}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Revisión</dt>
              <dd>{REVIEW_LABEL[data.reviewState] ?? data.reviewState}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-slate-500">Conciliar con el banco solo marca la conciliación. No aprueba, no sella, no vincula el comprobante y no cambia la categoría.</p>
        </aside>
      </div>
    </section>
  );
}
