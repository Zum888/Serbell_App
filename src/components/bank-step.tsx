"use client";

import { Loader2, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ACCOUNTING_LABEL, DOCUMENT_LABEL, REVIEW_LABEL } from "@/lib/labels";
import { formatUsd } from "@/lib/money";

type ScanRow = {
  id: string;
  merchant: string;
  postedOn: string;
  amountCents: number;
  hit: boolean;
};

type AutoMatch = {
  file: string;
  nextHref: string;
  note: string;
  amountLabel: string;
  dateLabel: string;
  rows: ScanRow[];
};

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
  autoMatch?: AutoMatch | null;
}) {
  const scanning = Boolean(autoMatch && !data.sealed && autoMatch.rows.length > 0);
  const [look, setLook] = useState(scanning ? -1 : 99);
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
    if (!scanning || !autoMatch) return;
    const row = look >= 0 ? autoMatch.rows[look] : null;
    const delay = look < 0 ? 500 : row?.hit ? 1500 : 620;
    const timer = window.setTimeout(() => {
      if (row?.hit) {
        (document.getElementById("bank-reconcile-form") as HTMLFormElement | null)?.requestSubmit();
        return;
      }
      setLook((current) => current + 1);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [autoMatch, look, scanning]);

  return (
    <section data-testid="bank-step">
      {scanning && autoMatch ? (
        <MovementSearch
          file={autoMatch.file}
          note={autoMatch.note}
          amountLabel={autoMatch.amountLabel}
          dateLabel={autoMatch.dateLabel}
          rows={autoMatch.rows}
          look={look}
        />
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

function MovementSearch({
  file,
  note,
  amountLabel,
  dateLabel,
  rows,
  look,
}: {
  file: string;
  note: string;
  amountLabel: string;
  dateLabel: string;
  rows: ScanRow[];
  look: number;
}) {
  const found = look >= 0 && rows[look]?.hit;
  return (
    <div className="mb-4 overflow-hidden rounded-2xl bg-white shadow-sm" data-testid="movement-search">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
        <Search className="size-4 text-slate-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900">{amountLabel}</p>
          <p className="text-xs text-slate-500">
            {file} · fecha cercana a {dateLabel}
            {note ? ` · ${note}` : ""}
          </p>
        </div>
        <p className="text-sm text-slate-600" data-testid="invoice-match">
          {found ? "Encontré el movimiento." : "Busco el mismo monto y una fecha cercana."}
        </p>
      </div>
      <ul>
        {rows.map((row, index) => {
          const looking = index === look && !row.hit;
          const passed = index < look && !row.hit;
          const hit = row.hit && look >= index;
          return (
            <li
              key={row.id}
              data-testid={hit ? "movement-hit" : undefined}
              className={`flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 ${hit ? "bg-emerald-50" : looking ? "bg-slate-50" : ""}`}
            >
              <span>
                <span className={`block text-sm ${passed ? "text-slate-400" : "font-medium text-slate-900"}`}>{row.merchant}</span>
                <span className={`block text-xs ${hit ? "font-medium text-emerald-800" : "text-slate-500"}`}>{row.postedOn}</span>
              </span>
              <span className={`text-sm tabular-nums ${hit ? "font-semibold text-emerald-800" : passed ? "text-slate-400" : "text-slate-800"}`}>
                {formatUsd(row.amountCents)}
              </span>
              {hit ? (
                <span className="flex gap-2">
                  <span className="rounded-full bg-emerald-600 px-2 py-1 text-xs font-medium text-white">Mismo monto</span>
                  <span className="rounded-full bg-emerald-600 px-2 py-1 text-xs font-medium text-white">Fecha cercana</span>
                </span>
              ) : looking ? (
                <Loader2 className="size-4 animate-spin text-slate-400" />
              ) : passed ? (
                <span className="text-xs text-slate-400">Monto distinto</span>
              ) : (
                <span className="w-16" />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
