"use client";

import { Lock, LockOpen, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
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
  const [reviews, setReviews] = useState<Record<string, string>>({});
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
        <table className="w-full min-w-[1040px] text-left text-sm">
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
              <th className="px-3 py-2 font-medium">Categoría y subcategoría</th>
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
              const label = labels[row.id] ?? (row.category ? `${row.category} / ${row.subcategory ?? "—"}` : "Sin categoría");
              const reviewLabel = reviews[row.id] ?? (REVIEW_LABEL[row.reviewState] ?? row.reviewState);
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
                  <td className="px-3 py-3">
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
                  <td className="px-3 py-3 whitespace-nowrap">{formatDay(row.postedOn)}</td>
                  <td className="px-3 py-3">
                    <p className="font-medium">{row.merchant}</p>
                    <p className="text-xs text-slate-500">{row.description}</p>
                  </td>
                  <td className="px-3 py-3 min-w-[260px]">
                    <p data-testid={`category-label-${row.id}`} className="mb-1 text-xs text-slate-500">{label}</p>
                    <ClassifyInline
                      id={row.id}
                      companyId={companyId}
                      subcategoryId={row.subcategoryId}
                      sealed={row.sealed}
                      canReview={canReview}
                      next={next}
                      tree={tree}
                      onTree={setTree}
                      onSaved={(categoryLabel, reviewText) => {
                        setLabels((current) => ({ ...current, [row.id]: categoryLabel }));
                        if (reviewText) setReviews((current) => ({ ...current, [row.id]: reviewText }));
                      }}
                    />
                  </td>
                  <td className="px-3 py-3">{row.amountCents > 0 ? formatCentsPlain(row.amountCents) : ""}</td>
                  <td className="px-3 py-3">{row.amountCents < 0 ? formatCentsPlain(row.amountCents) : ""}</td>
                  <td className="px-3 py-3" data-testid="doc-state">
                    <Link href={receiptHref(row)} data-testid={`receipt-${row.id}`} className="font-medium text-primary">
                      {row.documentName ?? "Sin comprobante"}
                    </Link>
                    <p className="text-xs text-slate-500">{DOCUMENT_LABEL[row.documentState] ?? row.documentState}</p>
                  </td>
                  <td className="px-3 py-3" data-testid="review-state">{reviewLabel}</td>
                  <td className="px-3 py-3" data-testid="bank-recon">
                    <p className="text-xs text-slate-500">{row.institution} ····{row.mask}</p>
                    {isReconciled ? (
                      <p className="mt-0.5">Conciliado</p>
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
                  <td className="px-3 py-3">
                    <span data-testid="seal-lock" data-locked={row.sealed ? "true" : "false"} className="inline-flex items-center gap-1 text-xs">
                      {row.sealed ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5 text-slate-400" />}
                      {row.sealed ? <span data-testid="sealed-label">Autorizado y bloqueado</span> : "Abierto"}
                    </span>
                  </td>
                  <td className="px-3 py-3">
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

function ClassifyInline({
  id,
  companyId,
  subcategoryId,
  sealed,
  canReview,
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
  next: string;
  tree: Group[];
  onTree: (updater: (current: Group[]) => Group[]) => void;
  onSaved: (categoryLabel: string, reviewLabel: string) => void;
}) {
  const initialCategory = useMemo(
    () => tree.find((group) => group.children.some((child) => child.id === subcategoryId))?.id ?? "",
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [categoryId, setCategoryId] = useState(initialCategory);
  const [subId, setSubId] = useState(subcategoryId);
  const [justification, setJustification] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<null | "category" | "subcategory">(null);
  const [newName, setNewName] = useState("");

  const group = tree.find((item) => item.id === categoryId) ?? null;

  if (sealed) {
    return <p className="text-xs text-slate-500">Sellado. El servidor rechaza el cambio.</p>;
  }

  async function addCategory(parentId: string | null) {
    const name = newName.trim();
    if (name.length < 2) {
      setError("El nombre es demasiado corto.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("companyId", companyId);
      if (parentId) form.set("parentId", parentId);
      form.set("name", name);
      const response = await fetch("/api/categories", { method: "POST", headers: { accept: "application/json" }, body: form });
      const body = (await response.json()) as { id?: string; name?: string; parentId?: string | null; error?: string };
      if (!response.ok || !body.id) throw new Error(body.error || "No se pudo agregar.");
      if (parentId) {
        onTree((current) => current.map((item) => (item.id === parentId ? { ...item, children: [...item.children, { id: body.id!, name: body.name! }] } : item)));
        setSubId(body.id);
      } else {
        onTree((current) => [...current, { id: body.id!, name: body.name!, children: [] }]);
        setCategoryId(body.id);
        setSubId("");
      }
      setNewName("");
      setAdding(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo agregar.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!subId) {
      setError("Elige una subcategoría.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("subcategoryId", subId);
      form.set("next", next);
      if (canReview) form.set("justification", justification);
      const response = await fetch(`/api/transactions/${id}/classification`, {
        method: "POST",
        headers: { accept: "application/json" },
        body: form,
      });
      const body = (await response.json()) as { categoryLabel?: string; reviewLabel?: string; error?: string };
      if (!response.ok) throw new Error(body.error || "No se pudo guardar.");
      onSaved(body.categoryLabel ?? "", body.reviewLabel ?? "");
      setJustification("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        <select
          value={categoryId}
          data-testid={`category-select-${id}`}
          onChange={(event) => {
            if (event.target.value === "__new__") {
              setAdding("category");
              return;
            }
            setCategoryId(event.target.value);
            setSubId("");
          }}
          className="h-8 min-w-[120px] rounded-lg border border-border bg-white px-2 text-xs"
          aria-label={`Categoría de ${id}`}
        >
          <option value="">Categoría</option>
          {tree.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
          <option value="__new__">+ Nueva categoría…</option>
        </select>
        <select
          value={subId}
          data-testid={`subcategory-select-${id}`}
          disabled={!group}
          onChange={(event) => {
            if (event.target.value === "__new__") {
              setAdding("subcategory");
              return;
            }
            setSubId(event.target.value);
          }}
          className="h-8 min-w-[120px] rounded-lg border border-border bg-white px-2 text-xs disabled:bg-slate-50"
          aria-label={`Subcategoría de ${id}`}
        >
          <option value="">Subcategoría</option>
          {group?.children.map((child) => (
            <option key={child.id} value={child.id}>{child.name}</option>
          ))}
          {group ? <option value="__new__">+ Nueva subcategoría…</option> : null}
        </select>
      </div>
      {adding ? (
        <div className="flex items-center gap-1.5">
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder={adding === "category" ? "Nueva categoría" : "Nueva subcategoría"}
            className="h-8 min-w-[140px] rounded-lg border border-border px-2 text-xs"
            aria-label="Nombre de la nueva categoría"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void addCategory(adding === "subcategory" ? categoryId : null)}
            className="inline-flex h-8 items-center gap-1 rounded-lg bg-slate-900 px-2 text-xs font-medium text-white disabled:opacity-50"
          >
            <Plus className="size-3" /> Crear
          </button>
          <button type="button" onClick={() => { setAdding(null); setNewName(""); }} className="text-xs text-slate-500">Cancelar</button>
        </div>
      ) : null}
      {canReview ? (
        <input
          value={justification}
          onChange={(event) => setJustification(event.target.value)}
          minLength={8}
          placeholder="Justificación del contador"
          className="h-8 w-full rounded-lg border border-border px-2 text-xs"
          aria-label="Justificación"
        />
      ) : null}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          data-testid={`save-category-${id}`}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {busy ? "Guardando…" : "Guardar"}
        </button>
        {!canReview ? <span className="text-xs text-slate-400">Queda como propuesta</span> : null}
      </div>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
