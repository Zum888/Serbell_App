"use client";

import { Check, Lock, LockOpen, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CategoryMenu, pathOf, type CategoryNode } from "@/components/category-menu";
import { MoneyToggle } from "@/components/money-toggle";
import { formatDay } from "@/lib/dates";
import { DOCUMENT_LABEL, RECONCILIATION_LABEL, REVIEW_LABEL } from "@/lib/labels";
import { formatCentsPlain } from "@/lib/money";

const REVIEW_TONE: Record<string, string> = {
  NeedsReview: "bg-blue-50 text-blue-700",
  NeedsClient: "bg-amber-50 text-amber-800",
  Approved: "bg-emerald-50 text-emerald-700",
  Reopened: "bg-violet-50 text-violet-700",
};

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

type Group = { id: string; name: string; children: { id: string; name: string }[] };

export function MovementsTable({
  rows,
  categories,
  canReview,
  filter,
  q,
  companyId,
}: {
  rows: Row[];
  categories: Group[];
  canReview: boolean;
  filter: string;
  q: string;
  companyId: string;
}) {
  const [done, setDone] = useState<Record<string, true>>({});
  const [selected, setSelected] = useState<Record<string, true>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tree, setTree] = useState<Group[]>(categories);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [reviews, setReviews] = useState<Record<string, { label: string; state: string }>>({});
  const next = `/movimientos?filtro=${filter}&q=${encodeURIComponent(q)}`;

  function reconciled(row: Row) {
    return row.reconciliationState === "Reconciled" || Boolean(done[row.id]);
  }

  function selectable(row: Row) {
    return !row.sealed && !reconciled(row);
  }

  function needsCategory(row: Row) {
    return !row.sealed && !labels[row.id] && !row.category;
  }

  const missing = rows.filter(needsCategory).length;
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
      {missing > 0 ? (
        <div data-testid="category-guide" className="mx-4 mb-3 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-slate-400" />
          <p>
            <span className="font-semibold text-slate-800">{missing === 1 ? "1 movimiento no tiene categoría." : `${missing} movimientos no tienen categoría.`}</span>{" "}
            Toca Elegir categoría y se guarda al seleccionar.
          </p>
        </div>
      ) : (
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-800">
          <Check className="size-4" /> Todos los movimientos de esta vista tienen categoría.
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3">
        <div className="flex items-center gap-3">
          <p className="text-xs text-slate-500">{selectedIds.length} seleccionados</p>
          <MoneyToggle />
        </div>
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
        <table className="w-full min-w-[1040px] text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr className="border-y border-slate-200">
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
              <th className="px-3 py-2 font-medium">Categoría y subcategoría</th>
              <th className="px-3 py-2 font-medium">Ingresos</th>
              <th className="px-3 py-2 font-medium">Gastos</th>
              <th className="px-3 py-2 font-medium">Comprobante</th>
              <th className="px-3 py-2 font-medium">Contador</th>
              <th className="px-3 py-2 font-medium">Conciliación bancaria</th>
              <th className="px-3 py-2 font-medium">Sello</th>
              <th className="px-3 py-2 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isReconciled = reconciled(row);
              const label = labels[row.id] ?? (row.category ? `${row.category} / ${row.subcategory ?? "—"}` : "Sin categoría");
              const reviewState = reviews[row.id]?.state || row.reviewState;
              const reviewLabel = reviews[row.id]?.label || (REVIEW_LABEL[row.reviewState] ?? row.reviewState);
              const attention = needsCategory(row);
              return (
                <tr
                  key={row.id}
                  data-testid={`movement-row-${row.id}`}
                  data-attention={attention ? "true" : "false"}
                  className="border-b border-slate-100 align-middle transition hover:bg-slate-50"
                  onClick={(event) => {
                    const target = event.target as HTMLElement;
                    if (target.closest("a, button, input, select, textarea, label, form, [role=menu], summary, details")) return;
                    if (!selectable(row)) return;
                    void reconcile([row.id]);
                  }}
                >
                  <td className="px-3 py-2.5">
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
                  <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{formatDay(row.postedOn)}</td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium">{row.merchant}</p>
                    <p className="text-xs text-slate-500">{row.description}</p>
                  </td>
                  <td className="min-w-[240px] px-3 py-2.5">
                    <p data-testid={`category-label-${row.id}`} className="sr-only">{label}</p>
                    <ClassifyInline
                      id={row.id}
                      companyId={companyId}
                      subcategoryId={row.subcategoryId}
                      sealed={row.sealed}
                      canReview={canReview}
                      attention={attention}
                      next={next}
                      tree={tree}
                      onTree={setTree}
                      onSaved={(categoryLabel, reviewText, state) => {
                        setLabels((current) => ({ ...current, [row.id]: categoryLabel }));
                        if (reviewText) setReviews((current) => ({ ...current, [row.id]: { label: reviewText, state } }));
                      }}
                    />
                  </td>
                  <td className="money-in px-3 py-2.5 whitespace-nowrap font-medium tabular-nums">{row.amountCents > 0 ? formatCentsPlain(row.amountCents) : ""}</td>
                  <td className="money-out px-3 py-2.5 whitespace-nowrap font-medium tabular-nums">{row.amountCents < 0 ? formatCentsPlain(row.amountCents) : ""}</td>
                  <td className="px-3 py-2.5">
                    <Link href={receiptHref(row)} data-testid={`receipt-${row.id}`} className="font-medium text-primary">
                      {row.documentName ?? "Sin comprobante"}
                    </Link>
                    <p data-testid="doc-state" className="text-xs text-slate-500">{DOCUMENT_LABEL[row.documentState] ?? row.documentState}</p>
                  </td>
                  <td className="px-3 py-2.5" data-testid="review-state">
                    <ReviewCell row={row} reviewState={reviewState} reviewLabel={reviewLabel} canReview={canReview} next={next} />
                  </td>
                  <td className="px-3 py-2.5" data-testid="bank-recon">
                    <p className="text-xs text-slate-500">{row.institution} ····{row.mask}</p>
                    {isReconciled ? (
                      <p className="mt-0.5 inline-flex items-center gap-1.5 font-medium text-emerald-700">
                        <span className="size-2.5 rounded-full bg-emerald-500" aria-hidden />
                        Completo
                      </p>
                    ) : row.sealed ? (
                      <p className="mt-0.5">{RECONCILIATION_LABEL[row.reconciliationState] ?? "Sin conciliar"}</p>
                    ) : (
                      <button
                        type="button"
                        data-testid={`reconcile-${row.id}`}
                        className="mt-0.5 font-medium text-primary"
                        onClick={() => void reconcile([row.id])}
                      >
                        Conciliar
                      </button>
                    )}
                    {row.serbellConciled ? <p data-testid="serbell-mark" className="text-xs font-medium text-primary">Serbell concilió</p> : null}
                  </td>
                  <td className="px-3 py-2.5">
                    <span data-testid="seal-lock" data-locked={row.sealed ? "true" : "false"} className="inline-flex items-center gap-1 text-xs">
                      {row.sealed ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5 text-slate-400" />}
                      {row.sealed ? <span data-testid="sealed-label">Autorizado y bloqueado</span> : "Abierto"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
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

function ReviewCell({
  row,
  reviewState,
  reviewLabel,
  canReview,
  next,
}: {
  row: Row;
  reviewState: string;
  reviewLabel: string;
  canReview: boolean;
  next: string;
}) {
  if (reviewState === "Approved") {
    return <span className="text-xs font-medium text-emerald-700">Aprobado</span>;
  }
  if (canReview && !row.sealed && (reviewState === "NeedsReview" || reviewState === "Reopened")) {
    return (
      <div className="space-y-1">
        <form action={`/api/transactions/${row.id}/seal`} method="post">
          <input type="hidden" name="next" value={next} />
          <button type="submit" className="rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white">
            Aprobar
          </button>
        </form>
        <details>
          <summary className="cursor-pointer text-xs text-slate-500">Pedir aclaración</summary>
          <form action={`/api/transactions/${row.id}/clarification`} method="post" className="mt-1 space-y-1">
            <input type="hidden" name="next" value={next} />
            <input
              name="message"
              required
              minLength={8}
              placeholder="Qué debe aclarar el cliente"
              aria-label="Aclaración para el cliente"
              className="h-8 w-44 rounded-md border border-border px-2 text-xs"
            />
            <button type="submit" className="block text-xs font-medium text-primary">Enviar</button>
          </form>
        </details>
      </div>
    );
  }
  if (reviewState === "NeedsClient") {
    return (
      <Link href={`${next}&movimiento=${row.id}`} className="text-xs font-medium text-slate-700">
        {canReview ? "Esperando al cliente" : "Te pidieron una aclaración"}
      </Link>
    );
  }
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${REVIEW_TONE[reviewState] ?? "bg-slate-100 text-slate-600"}`}>
      {canReview ? reviewLabel : "Con tu contador"}
    </span>
  );
}

function ClassifyInline({
  id,
  companyId,
  subcategoryId,
  sealed,
  canReview,
  attention,
  next,
  tree,
  onTree,
  onSaved,
}: {
  id: string;
  companyId: string;
  subcategoryId: string;
  sealed: boolean;
  canReview: boolean;
  attention: boolean;
  next: string;
  tree: Group[];
  onTree: (updater: (current: Group[]) => Group[]) => void;
  onSaved: (categoryLabel: string, reviewLabel: string, reviewState: string) => void;
}) {
  const [saved, setSaved] = useState(subcategoryId);
  const [pending, setPending] = useState<string | null>(null);
  const [done, setDone] = useState<{ undo: string | null } | null>(null);
  const [justification, setJustification] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => setDone(null), 12000);
    return () => window.clearTimeout(timer);
  }, [done]);

  if (sealed) {
    return <p className="text-xs text-slate-500">Sellado. El servidor rechaza el cambio.</p>;
  }

  async function addCategory(parentId: string | null, name: string): Promise<CategoryNode | null> {
    const form = new FormData();
    form.set("companyId", companyId);
    if (parentId) form.set("parentId", parentId);
    form.set("name", name);
    const response = await fetch("/api/categories", { method: "POST", headers: { accept: "application/json" }, body: form });
    const body = (await response.json()) as { id?: string; name?: string; error?: string };
    if (!response.ok || !body.id || !body.name) throw new Error(body.error || "No se pudo agregar.");
    const node = { id: body.id, name: body.name };
    if (parentId) {
      onTree((current) => current.map((item) => (item.id === parentId ? { ...item, children: [...item.children, node] } : item)));
    } else {
      onTree((current) => [...current, { ...node, children: [] }]);
    }
    return node;
  }

  async function save(target: string, note: string, previous: string | null) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("subcategoryId", target);
      form.set("next", next);
      if (canReview) form.set("justification", note);
      const response = await fetch(`/api/transactions/${id}/classification`, {
        method: "POST",
        headers: { accept: "application/json" },
        body: form,
      });
      const body = (await response.json()) as { categoryLabel?: string; reviewLabel?: string; reviewState?: string; error?: string };
      if (!response.ok) throw new Error(body.error || "No se pudo guardar.");
      setSaved(target);
      setPending(null);
      setJustification("");
      setDone({ undo: previous });
      onSaved(body.categoryLabel ?? "", body.reviewLabel ?? "", body.reviewState ?? "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  function pick(target: string) {
    if (target === saved) return;
    if (canReview) {
      setPending(target);
      return;
    }
    void save(target, "", saved || null);
  }

  const pendingLabel = pending ? pathOf(tree, pending).map((node) => node.name).join(" › ") : "";

  return (
    <div className="space-y-1.5">
      <CategoryMenu
        tree={tree}
        value={pending ?? saved}
        disabled={busy}
        attention={attention}
        testId={`category-menu-${id}`}
        onPick={pick}
        onAdd={addCategory}
      />
      {pending ? (
        <div className="space-y-1.5 rounded-lg border border-blue-200 bg-blue-50/60 p-2">
          <p className="text-[11px] text-blue-900">Cambiar a <span className="font-medium">{pendingLabel}</span>. Como contador, escribe por qué.</p>
          <input
            autoFocus
            value={justification}
            onChange={(event) => setJustification(event.target.value)}
            minLength={8}
            placeholder="Justificación (mínimo 8 letras)"
            className="h-8 w-full rounded-lg border border-border bg-white px-2 text-xs"
            aria-label="Justificación"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy || justification.trim().length < 8}
              onClick={() => void save(pending, justification, saved || null)}
              data-testid={`save-category-${id}`}
              className="rounded-lg bg-primary px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
            >
              {busy ? "Guardando…" : "Guardar"}
            </button>
            <button type="button" onClick={() => setPending(null)} className="text-xs text-slate-500">Cancelar</button>
          </div>
        </div>
      ) : null}
      {busy && !pending ? <p className="text-[11px] text-slate-500">Guardando…</p> : null}
      {done && !busy && !pending ? (
        <p className="flex items-center gap-2 text-[11px] text-emerald-700">
          <Check className="size-3" /> Guardado{!canReview ? " como propuesta" : ""}
          {done.undo && !canReview ? (
            <button type="button" onClick={() => void save(done.undo as string, "", null)} className="font-medium text-primary underline-offset-2 hover:underline">
              Deshacer
            </button>
          ) : null}
        </p>
      ) : null}
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}
