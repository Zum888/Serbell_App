"use client";

import { Check, Flag, Lock, LockOpen, MessageSquare, Paperclip, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CategoryMenu, pathOf, type CategoryNode } from "@/components/category-menu";
import { MoneyToggle } from "@/components/money-toggle";
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
  invoiceNumber: string | null;
  comment: string | null;
  suggested: boolean;
};

export function MovementsTable({
  rows,
  categories,
  canReview,
  filter,
  q,
  companyId,
}: {
  rows: Row[];
  categories: CategoryNode[];
  canReview: boolean;
  filter: string;
  q: string;
  companyId: string;
}) {
  const [done, setDone] = useState<Record<string, true>>({});
  const [selected, setSelected] = useState<Record<string, true>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tree, setTree] = useState<CategoryNode[]>(categories);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [reviews, setReviews] = useState<Record<string, { label: string; state: string }>>({});
  const [suggestions, setSuggestions] = useState<Record<string, boolean>>({});
  const [closing, setClosing] = useState(false);
  const router = useRouter();
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

  const openRows = rows.filter(selectable);
  const selectedIds = openRows.filter((row) => selected[row.id]).map((row) => row.id);
  const allSelected = openRows.length > 0 && selectedIds.length === openRows.length;
  const pendingReview = rows.filter((row) => {
    const state = reviews[row.id]?.state || row.reviewState;
    return !row.sealed && state !== "Approved";
  }).length;
  const monthOpen = rows.some((row) => !row.sealed);
  const closeIds = rows.filter((row) => !row.sealed).map((row) => row.id);

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

  function detailHref(row: Row) {
    return `${next}&movimiento=${row.id}`;
  }

  async function closeMonth() {
    if (!closeIds.length || closing) return;
    setClosing(true);
    setError(null);
    try {
      const response = await fetch("/api/transactions/seal", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ ids: closeIds }),
      });
      const body = (await response.json()) as { error?: string; skipped?: { error: string }[] };
      if (!response.ok) throw new Error(body.error || "No se pudo cerrar el mes.");
      if (body.skipped?.length) setError(body.skipped[0]?.error || "Algunos movimientos siguen abiertos.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cerrar el mes.");
    } finally {
      setClosing(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3">
        <MoneyToggle />
        {selectedIds.length > 0 ? (
          <div className="flex items-center gap-3">
            <p className="text-xs text-slate-500">{selectedIds.length} seleccionados</p>
            <button
              type="button"
              data-testid="reconcile-selection"
              disabled={busy}
              onClick={() => void reconcile(selectedIds)}
              className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              Conciliar selección
            </button>
          </div>
        ) : null}
      </div>
      {error ? <p className="px-4 pb-3 text-sm text-red-700" data-testid="reconcile-error">{error}</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-left text-sm">
          <thead className="text-xs text-slate-500">
            <tr className="border-y border-slate-200">
              <th className="w-10 px-3 py-2 font-medium">
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
              <th className="w-16 px-3 py-2 font-medium">Fecha</th>
              <th className="px-3 py-2 font-medium">Movimiento</th>
              <th className="w-[220px] px-3 py-2 font-medium">Categoría</th>
              <th className="w-10 px-2 py-2 font-medium"><span className="sr-only">Comentario</span></th>
              <th className="w-24 px-2 py-2 text-right font-medium">Ingresos USD</th>
              <th className="w-24 px-2 py-2 text-right font-medium">Gastos USD</th>
              <th className="w-36 px-2 py-2 font-medium">Comprobante</th>
              <th className="w-28 px-2 py-2 font-medium">Conciliación</th>
              <th className="w-16 px-2 py-2 text-center font-medium">Contador</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isReconciled = reconciled(row);
              const label = labels[row.id] ?? row.subcategory ?? row.category ?? "Sin categoría";
              const reviewState = reviews[row.id]?.state || row.reviewState;
              const reviewLabel = reviews[row.id]?.label || (REVIEW_LABEL[row.reviewState] ?? row.reviewState);
              const attention = needsCategory(row);
              const suggested = suggestions[row.id] ?? row.suggested;
              return (
                <tr
                  key={row.id}
                  data-testid={`movement-row-${row.id}`}
                  data-attention={attention ? "true" : "false"}
                  className="cursor-pointer border-b border-slate-100 align-middle transition hover:bg-slate-50"
                  onClick={(event) => {
                    const target = event.target as HTMLElement;
                    if (target.closest("a, button, input, select, textarea, label, form, [role=menu], summary, details")) return;
                    router.push(detailHref(row));
                  }}
                >
                  <td className="px-3 py-2.5">
                    {isReconciled ? (
                      <span aria-label="Conciliado" className="inline-flex size-7 items-center justify-center rounded-full bg-emerald-600 text-white">
                        <Check className="size-3.5" />
                      </span>
                    ) : selectable(row) ? (
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
                  <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{shortDay(row.postedOn)}</td>
                  <td className="px-3 py-2.5">
                    <Link href={detailHref(row)} className="font-medium text-slate-900 hover:underline">{row.merchant}</Link>
                    <p className="text-xs text-slate-500">{row.description}</p>
                  </td>
                  <td className="w-[220px] px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <p data-testid={`category-label-${row.id}`} className="sr-only">{label}</p>
                      <ClassifyInline
                        id={row.id}
                        companyId={companyId}
                        subcategoryId={row.subcategoryId}
                        sealed={row.sealed}
                        sealedLabel={label}
                        canReview={canReview}
                        attention={attention}
                        next={next}
                        tree={tree}
                        onTree={setTree}
                        onSaved={(categoryLabel, reviewText, state) => {
                          setLabels((current) => ({ ...current, [row.id]: categoryLabel }));
                          setSuggestions((current) => ({ ...current, [row.id]: false }));
                          if (reviewText) setReviews((current) => ({ ...current, [row.id]: { label: reviewText, state } }));
                        }}
                      />
                      {suggested && !row.sealed ? <span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">IA</span> : null}
                    </div>
                  </td>
                  <td className="px-2 py-2.5">
                    <CommentButton id={row.id} initial={row.comment} next={next} />
                  </td>
                  <td className="money-in w-[7.5rem] px-3 py-2.5 text-right whitespace-nowrap font-medium tabular-nums">{row.amountCents > 0 ? formatCentsPlain(row.amountCents) : ""}</td>
                  <td className="money-out px-3 py-2.5 text-right whitespace-nowrap font-medium tabular-nums">{row.amountCents < 0 ? formatCentsPlain(row.amountCents) : ""}</td>
                  <td className="px-3 py-2.5">
                    <ReceiptPill row={row} href={receiptHref(row)} reconciled={isReconciled} />
                  </td>
                  <td className="px-3 py-2.5" data-testid="bank-recon">
                    {isReconciled ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        <Check className="size-3" /> Conciliado
                      </span>
                    ) : row.sealed ? (
                      <span className="text-xs text-slate-500">{RECONCILIATION_LABEL[row.reconciliationState] ?? "Sin conciliar"}</span>
                    ) : (
                      <button
                        type="button"
                        data-testid={`reconcile-${row.id}`}
                        className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:border-slate-300"
                        onClick={() => void reconcile([row.id])}
                      >
                        Conciliar
                      </button>
                    )}
                    {row.serbellConciled ? <p data-testid="serbell-mark" className="mt-1 text-[11px] font-medium text-primary">Serbell concilió</p> : null}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Link
                      href={detailHref(row)}
                      data-testid="review-state"
                      aria-label={reviewLabel}
                      title={reviewLabel}
                      className="inline-flex size-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Flag className={`size-4 ${reviewState === "Approved" ? "fill-slate-700 text-slate-700" : ""}`} />
                      <span data-testid="seal-lock" data-locked={row.sealed ? "true" : "false"} className="sr-only">
                        {row.sealed ? "Autorizado y bloqueado" : "Abierto"}
                      </span>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
        <p className="text-xs text-slate-500">{rows.length} movimientos</p>
        <div className="flex flex-wrap items-center gap-4">
          <p className="inline-flex items-center gap-1.5 text-xs text-slate-600">
            {monthOpen ? <LockOpen className="size-3.5 text-slate-400" /> : <Lock className="size-3.5" />}
            {periodOf(rows)} · {monthOpen ? "Mes abierto" : "Mes cerrado"}
          </p>
          {pendingReview > 0 ? <p className="text-xs font-medium text-amber-700">{pendingReview} por revisar</p> : null}
          {canReview ? (
            <div className="text-right">
              <button
                type="button"
                data-testid="close-month"
                disabled={closing || closeIds.length === 0}
                onClick={() => void closeMonth()}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                {closing ? "Cerrando…" : "Aprobar y cerrar mes"}
              </button>
              <p className="mt-1 text-[11px] text-slate-400">Solo contador · Bloquea categorías al aprobar</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function shortDay(day: string) {
  return formatDay(day).replace(/\s+\d{4}$/, "");
}

function periodOf(rows: Row[]) {
  const day = rows.find((row) => row.postedOn)?.postedOn;
  if (!day) return "Periodo";
  const [year, month] = day.split("-").map(Number);
  if (!year || !month) return "Periodo";
  const label = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1, 12))).replace(" de ", " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function ReceiptPill({ row, href, reconciled }: { row: Row; href: string; reconciled: boolean }) {
  const stateLabel = DOCUMENT_LABEL[row.documentState] ?? row.documentState;
  const tone = reconciled ? "text-emerald-700" : "text-violet-700";
  if (row.invoiceNumber) {
    return (
      <Link href={href} data-testid={`receipt-${row.id}`} data-state={row.documentState} className={`inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium ${tone}`}>
        <Paperclip className="size-3.5" />
        Invoice {row.invoiceNumber}
        <span data-testid="doc-state" data-label={stateLabel} className="sr-only">{stateLabel}</span>
      </Link>
    );
  }
  if (row.documentState === "Linked") {
    return (
      <Link href={href} data-testid={`receipt-${row.id}`} data-state={row.documentState} className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-emerald-700">
        <Paperclip className="size-3.5" />
        Ticket
        <span data-testid="doc-state" data-label={stateLabel} className="sr-only">{stateLabel}</span>
      </Link>
    );
  }
  if (row.documentState === "Suggested" || row.documentState === "Conflict") {
    return (
      <Link href={href} data-testid={`receipt-${row.id}`} data-state={row.documentState} className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
        Revisar
        <span data-testid="doc-state" data-label={stateLabel} className="sr-only">{stateLabel}</span>
      </Link>
    );
  }
  return (
    <Link href={href} data-testid={`receipt-${row.id}`} data-state={row.documentState} className="inline-flex items-center gap-1 text-xs text-slate-500">
      <Plus className="size-3.5" />
      Adjuntar
      <span data-testid="doc-state" data-label={stateLabel} className="sr-only">{stateLabel}</span>
    </Link>
  );
}

function ClassifyInline({
  id,
  companyId,
  subcategoryId,
  sealed,
  sealedLabel,
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
  sealedLabel: string;
  canReview: boolean;
  attention: boolean;
  next: string;
  tree: CategoryNode[];
  onTree: (updater: (current: CategoryNode[]) => CategoryNode[]) => void;
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
    return <p className="text-xs font-medium text-slate-700">{sealedLabel}</p>;
  }

  async function addCategory(parentId: string | null, name: string): Promise<CategoryNode | null> {
    const form = new FormData();
    form.set("companyId", companyId);
    if (parentId) form.set("parentId", parentId);
    form.set("name", name);
    const response = await fetch("/api/categories", { method: "POST", headers: { accept: "application/json" }, body: form });
    const body = (await response.json()) as { id?: string; name?: string; error?: string };
    if (!response.ok || !body.id || !body.name) throw new Error(body.error || "No se pudo agregar.");
    const node = { id: body.id, name: body.name, children: [] };
    if (parentId) {
      onTree((current) => insertNode(current, parentId, node));
    } else {
      onTree((current) => [...current, node]);
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
        placeholder="Sin categoría"
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

function insertNode(nodes: CategoryNode[], parentId: string, node: CategoryNode): CategoryNode[] {
  return nodes.map((item) => {
    if (item.id === parentId) return { ...item, children: [...(item.children ?? []), node] };
    return { ...item, children: insertNode(item.children ?? [], parentId, node) };
  });
}

function CommentButton({ id, initial, next }: { id: string; initial: string | null; next: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(initial ?? "");
  const [saved, setSaved] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const body = text.trim();
    if (body.length < 2 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("body", body);
      form.set("next", next);
      const response = await fetch(`/api/transactions/${id}/comment`, {
        method: "POST",
        headers: { accept: "application/json" },
        body: form,
      });
      const payload = (await response.json()) as { body?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "No se pudo guardar el comentario.");
      setSaved(payload.body ?? body);
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el comentario.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={saved ? "Editar comentario" : "Dejar un comentario"}
        title={saved || "Dejar un comentario"}
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex size-7 items-center justify-center rounded-full border ${saved ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-500 hover:border-slate-400"}`}
      >
        <MessageSquare className="size-3.5" />
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-border bg-white p-2 shadow-lg">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            placeholder="Comentario"
            aria-label="Comentario del movimiento"
            className="w-full resize-none rounded-lg border border-border px-2 py-1 text-xs"
          />
          {error ? <p className="mt-1 text-[11px] text-rose-700">{error}</p> : null}
          <button
            type="button"
            disabled={busy || text.trim().length < 2}
            onClick={() => void send()}
            className="mt-2 rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-medium text-white disabled:opacity-50"
          >
            {busy ? "Guardando…" : "Guardar"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
