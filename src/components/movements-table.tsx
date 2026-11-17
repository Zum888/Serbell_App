"use client";

import { Lock, LockOpen } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CategoryForm } from "@/components/category-form";
import { formatDay } from "@/lib/dates";
import { DOCUMENT_LABEL, RECONCILIATION_LABEL, REVIEW_LABEL } from "@/lib/labels";
import { formatCentsPlain } from "@/lib/money";

type Row = {
  id: string;
  postedOn: string;
  merchant: string;
  description: string;
  amountCents: number;
  category: string | null;
  subcategory: string | null;
  subcategoryId: string;
  documentState: string;
  reviewState: string;
  reconciliationState: string;
  serbellConciled: boolean;
  sealed: boolean;
  institution: string;
  mask: string;
  documentId: string | null;
  documentName: string | null;
};

export function MovementsTable({
  rows,
  categories,
  canReview,
  filter,
  q,
}: {
  rows: Row[];
  categories: { name: string; children: { id: string; name: string }[] }[];
  canReview: boolean;
  filter: string;
  q: string;
}) {
  const [done, setDone] = useState<Record<string, true>>({});
  const [selected, setSelected] = useState<Record<string, true>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = `/movimientos?filtro=${filter}&q=${encodeURIComponent(q)}`;

  function reconciled(row: Row) {
    return row.reconciliationState === "Reconciled" || Boolean(done[row.id]);
  }

  function selectable(row: Row) {
    return !row.sealed && !reconciled(row);
  }

  const openRows = rows.filter(selectable);
  const selectedIds = openRows.filter((row) => selected[row.id]).map((row) => row.id);
  const allSelected = openRows.length > 0 && selectedIds.length === openRows.length;

  async function reconcile(ids: string[]) {
    if (!ids.length || busy) return;
    const previousDone = done;
    const previousSelected = selected;
    setDone({ ...done, ...Object.fromEntries(ids.map((id) => [id, true as const])) });
    setSelected((current) => {
      const nextSelected = { ...current };
      for (const id of ids) delete nextSelected[id];
      return nextSelected;
    });
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/transactions/reconcile", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ ids }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "No se pudo conciliar.");
    } catch (cause) {
      setDone(previousDone);
      setSelected(previousSelected);
      setError(cause instanceof Error ? cause.message : "No se pudo conciliar.");
    } finally {
      setBusy(false);
    }
  }

  function receiptHref(row: Row) {
    const params = new URLSearchParams();
    if (filter && filter !== "todos") params.set("filtro", filter);
    if (q) params.set("q", q);
    params.set("fila", row.id);
    if (row.documentId) params.set("recibo", row.documentId);
    return `/movimientos?${params}`;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3">
        <p className="text-xs text-slate-500">{selectedIds.length} seleccionados</p>
        <button
          type="button"
          data-testid="reconcile-selection"
          disabled={selectedIds.length === 0 || busy}
          onClick={() => void reconcile(selectedIds)}
          className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          Conciliar selección
        </button>
      </div>
      {error ? <p className="px-4 pb-3 text-sm text-red-700" data-testid="reconcile-error">{error}</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="text-xs text-slate-500">
            <tr className="border-y border-border">
              <th className="px-3 py-2 font-medium">
                <input
                  type="checkbox"
                  aria-label="Seleccionar abiertos"
                  checked={allSelected}
                  disabled={openRows.length === 0}
                  onChange={(event) => {
                    if (!event.target.checked) {
                      setSelected({});
                      return;
                    }
                    setSelected(Object.fromEntries(openRows.map((row) => [row.id, true as const])));
                  }}
                />
              </th>
              <th className="px-3 py-2 font-medium">Fecha</th>
              <th className="px-3 py-2 font-medium">Movimiento</th>
              <th className="px-3 py-2 font-medium" colSpan={2}>Categoría y subcategoría</th>
              <th className="px-3 py-2 font-medium">Ingresos</th>
              <th className="px-3 py-2 font-medium">Gastos</th>
              <th className="px-3 py-2 font-medium">Comprobante</th>
              <th className="px-3 py-2 font-medium">Revisión</th>
              <th className="px-3 py-2 font-medium">Conciliación bancaria</th>
              <th className="px-3 py-2 font-medium">Sello</th>
              <th className="px-3 py-2 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isReconciled = reconciled(row);
              return (
                <tr
                  key={row.id}
                  data-testid={`movement-row-${row.id}`}
                  className="border-b border-border align-top"
                  onClick={(event) => {
                    const target = event.target as HTMLElement;
                    if (target.closest("a, button, input, select, textarea, label, form")) return;
                    if (!selectable(row)) return;
                    void reconcile([row.id]);
                  }}
                >
                  <td className="px-3 py-2">
                    {selectable(row) ? (
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar ${row.merchant}`}
                        data-testid={`select-${row.id}`}
                        checked={Boolean(selected[row.id])}
                        onChange={(event) => {
                          setSelected((current) => {
                            const nextSelected = { ...current };
                            if (event.target.checked) nextSelected[row.id] = true;
                            else delete nextSelected[row.id];
                            return nextSelected;
                          });
                        }}
                      />
                    ) : null}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDay(row.postedOn)}</td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{row.merchant}</p>
                    <p className="text-xs text-slate-500">{row.description}</p>
                  </td>
                  <td className="px-3 py-2" colSpan={2}>
                    <div data-testid={`category-label-${row.id}`}>
                      <p className="text-sm">{row.category ?? "Sin categoría"} <span className="text-slate-400">/</span> {row.subcategory ?? "—"}</p>
                      <CategoryForm
                        id={row.id}
                        subcategoryId={row.subcategoryId}
                        categories={categories}
                        canReview={canReview}
                        sealed={row.sealed}
                        next={next}
                        testId={`save-category-${row.id}`}
                        compact
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2">{row.amountCents > 0 ? formatCentsPlain(row.amountCents) : ""}</td>
                  <td className="px-3 py-2">{row.amountCents < 0 ? formatCentsPlain(row.amountCents) : ""}</td>
                  <td className="px-3 py-2" data-testid="doc-state">
                    <Link href={receiptHref(row)} data-testid={`receipt-${row.id}`} className="font-medium text-primary">
                      {row.documentName ?? "Sin comprobante"}
                    </Link>
                    <p className="text-xs text-slate-500">{DOCUMENT_LABEL[row.documentState] ?? row.documentState}</p>
                  </td>
                  <td className="px-3 py-2" data-testid="review-state">{REVIEW_LABEL[row.reviewState] ?? row.reviewState}</td>
                  <td className="px-3 py-2" data-testid="bank-recon">
                    {isReconciled ? (
                      <p>Conciliado</p>
                    ) : row.sealed ? (
                      <p>{RECONCILIATION_LABEL[row.reconciliationState] ?? "Sin conciliar"}</p>
                    ) : (
                      <button
                        type="button"
                        data-testid={`reconcile-${row.id}`}
                        className="font-medium text-primary"
                        onClick={() => void reconcile([row.id])}
                      >
                        Conciliar
                      </button>
                    )}
                    {row.serbellConciled ? <p data-testid="serbell-mark" className="text-xs font-medium text-primary">Serbell concilió</p> : null}
                  </td>
                  <td className="px-3 py-2">
                    <span data-testid="seal-lock" data-locked={row.sealed ? "true" : "false"} className="inline-flex items-center gap-1 text-xs">
                      {row.sealed ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5 text-slate-400" />}
                      {row.sealed ? <span data-testid="sealed-label">Autorizado y bloqueado</span> : "Abierto"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <Link className="font-medium text-primary" href={`${next}&movimiento=${row.id}`}>
                      Ver
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
