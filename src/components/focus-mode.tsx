"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ReceiptFrame } from "@/components/receipt-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ACCOUNTING_LABEL, DOCUMENT_LABEL, RECONCILIATION_LABEL, REVIEW_LABEL } from "@/lib/labels";
import { formatDay } from "@/lib/dates";
import { formatUsd } from "@/lib/money";

type Suggestion = { subcategoryId: string; label: string; reason: string };

export type FocusData = {
  companyName: string;
  canReview: boolean;
  total: number;
  pending: number;
  merchantPending: number;
  suggestions: Suggestion[];
  choices: { id: string; fileName: string }[];
  error?: string;
  categories: { name: string; children: { id: string; name: string }[] }[];
  current: {
    id: string;
    merchant: string;
    description: string;
    postedOn: string;
    amountCents: number;
    institution: string;
    mask: string;
    categoryLabel: string;
    accountingState: string;
    documentState: string;
    reviewState: string;
    reconciliationState: string;
  } | null;
  ticket: {
    document: { id: string; fileName: string; mimeType: string } | null;
    suggested: boolean;
    linkable: boolean;
    note: string;
  } | null;
};

export function FocusMode({ data }: { data: FocusData }) {
  const [selected, setSelected] = useState(0);
  const [parentName, setParentName] = useState("");
  const [otherId, setOtherId] = useState("");
  const [justification, setJustification] = useState("");
  const current = data.current;
  const here = current ? `/movimientos?vista=enfoque&actual=${current.id}` : "/movimientos?vista=enfoque";
  const chosen = otherId || data.suggestions[selected]?.subcategoryId || "";
  const done = data.total === 0 ? 0 : Math.round(((data.total - data.pending) / data.total) * 100);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (event.key === "Escape") {
        event.preventDefault();
        window.location.assign("/movimientos");
        return;
      }
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.key === "1" || event.key === "2" || event.key === "3") {
        const index = Number(event.key) - 1;
        if (data.suggestions[index]) {
          setSelected(index);
          setOtherId("");
          setParentName("");
        }
      }
      if (event.key === "Enter" && current) {
        event.preventDefault();
        (document.getElementById("focus-confirm") as HTMLFormElement | null)?.requestSubmit();
      }
      if ((event.key === "s" || event.key === "S") && current) {
        event.preventDefault();
        (document.getElementById("focus-skip") as HTMLFormElement | null)?.requestSubmit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, data.suggestions]);

  return (
    <section data-testid="focus-mode">
      <p className="text-xs text-slate-500">{data.companyName}</p>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold">Movimientos</h1>
        <div className="flex gap-2">
          <span className="rounded-full bg-slate-900 px-3 py-1.5 text-xs text-white">Modo enfoque</span>
          <Link href="/movimientos" className="rounded-full border border-border px-3 py-1.5 text-xs text-slate-600">Vista detallada</Link>
        </div>
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-sm">
          <p data-testid="focus-progress">{data.pending} de {data.total} pendientes</p>
          <p className="text-xs text-slate-500" data-testid="focus-hints">1 2 3 eligen categoría · Enter confirma · S omite · Esc sale</p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-primary" style={{ width: `${done}%` }} />
        </div>
      </div>
      {data.error ? <p className="mt-3 text-sm text-red-700" data-testid="server-error">{data.error}</p> : null}
      {!current || !data.ticket ? (
        <div className="mt-4 rounded-2xl border border-border bg-white p-6">
          <h2 className="text-lg font-semibold">No quedan movimientos pendientes</h2>
          <p className="mt-1 text-sm text-slate-500">Los sellados no entran en esta vista. La tabla sigue en la vista detallada.</p>
          <Link href="/movimientos" className="mt-3 inline-flex text-sm font-medium text-primary">Volver a la vista detallada</Link>
        </div>
      ) : (
        <div className="mt-4 grid items-start gap-4 xl:grid-cols-2">
          <article className="rounded-2xl border border-border bg-white p-4">
            <p className="text-xs text-slate-500">{formatDay(current.postedOn)} · {current.institution} ····{current.mask}</p>
            <h2 className="text-xl font-semibold" data-testid="focus-merchant">{current.merchant}</h2>
            <p className="text-2xl font-semibold tracking-tight">{formatUsd(current.amountCents)}</p>
            <p className="mt-1 text-sm text-slate-500">{current.description}</p>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div><dt className="text-xs text-slate-500">Categoría</dt><dd>{current.categoryLabel}</dd></div>
              <div><dt className="text-xs text-slate-500">Estado contable</dt><dd>{ACCOUNTING_LABEL[current.accountingState] ?? current.accountingState}</dd></div>
              <div><dt className="text-xs text-slate-500">Comprobante</dt><dd>{DOCUMENT_LABEL[current.documentState] ?? current.documentState}</dd></div>
              <div><dt className="text-xs text-slate-500">Revisión</dt><dd>{REVIEW_LABEL[current.reviewState] ?? current.reviewState}</dd></div>
              <div><dt className="text-xs text-slate-500">Banco</dt><dd>{RECONCILIATION_LABEL[current.reconciliationState] ?? current.reconciliationState}</dd></div>
            </dl>
            <div className="mt-4 space-y-2">
              {data.suggestions.map((suggestion, index) => {
                const active = !otherId && selected === index;
                return (
                  <button
                    key={suggestion.subcategoryId}
                    type="button"
                    data-testid={`focus-suggestion-${index + 1}`}
                    onClick={() => { setSelected(index); setOtherId(""); setParentName(""); }}
                    className={active ? "block w-full rounded-xl border border-primary bg-white px-3 py-2 text-left" : "block w-full rounded-xl border border-border bg-white px-3 py-2 text-left"}
                  >
                    <span className="text-xs text-slate-500">{index + 1}</span>
                    <span className="mt-0.5 block text-sm font-medium">{suggestion.label}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{suggestion.reason}</span>
                  </button>
                );
              })}
            </div>
            <OtherCategory
              categories={data.categories}
              parentName={parentName}
              otherId={otherId}
              onParent={setParentName}
              onChild={(value) => { setOtherId(value); if (value) setSelected(-1); }}
            />
            {data.canReview ? (
              <label className="mt-3 block text-xs text-slate-500">
                Justificación del contador
                <Input value={justification} onChange={(event) => setJustification(event.target.value)} required minLength={8} placeholder="Por qué esta categoría" aria-label="Justificación" className="mt-1" />
              </label>
            ) : (
              <p className="mt-3 text-xs text-slate-500">Queda como propuesta. No aprueba ni concilia el banco.</p>
            )}
            <form id="focus-confirm" action={`/api/transactions/${current.id}/focus`} method="post" className="mt-3">
              <input type="hidden" name="action" value="confirm" />
              <input type="hidden" name="subcategoryId" value={chosen} />
              {data.ticket.linkable && data.ticket.document ? <input type="hidden" name="documentId" value={data.ticket.document.id} /> : null}
              <input type="hidden" name="next" value={here} />
              <input type="hidden" name="justification" value={justification} />
              <Button type="submit" data-testid="focus-confirm" disabled={!chosen}>
                {data.ticket.linkable ? "Confirmar vínculo y categoría" : "Confirmar categoría"}
              </Button>
            </form>
            <form action={`/api/transactions/${current.id}/focus`} method="post" className="mt-2">
              <input type="hidden" name="action" value="apply" />
              <input type="hidden" name="subcategoryId" value={chosen} />
              <input type="hidden" name="justification" value={justification} />
              <input type="hidden" name="next" value={here} />
              <Button type="submit" variant="outline" data-testid="focus-apply" disabled={!chosen || data.merchantPending < 1}>
                Aplicar a todos los de este comercio ({data.merchantPending})
              </Button>
            </form>
            <form id="focus-skip" action={`/api/transactions/${current.id}/focus`} method="post" className="mt-2">
              <input type="hidden" name="action" value="skip" />
              <input type="hidden" name="next" value={here} />
              <button type="submit" data-testid="focus-skip" className="text-sm text-slate-500">Omitir (S)</button>
            </form>
            <p className="mt-3 text-xs text-slate-500">{data.ticket.note}</p>
          </article>
          <aside className="rounded-2xl border border-border bg-white p-4">
            <p className="text-xs text-slate-500">{data.ticket.suggested ? "Comprobante sugerido" : data.ticket.document ? "Comprobante vinculado" : "Comprobante"}</p>
            <h2 className="text-lg font-semibold">{data.ticket.document?.fileName ?? "Sin ticket"}</h2>
            {data.ticket.document ? (
              <ReceiptFrame
                src={`/api/documents/${data.ticket.document.id}/file`}
                mime={data.ticket.document.mimeType}
                fileName={data.ticket.document.fileName}
                closeHref={here}
              />
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-border bg-slate-50 p-4 text-sm text-slate-600">Este movimiento no tiene ticket sugerido.</div>
            )}
            <div className="mt-4 space-y-3">
              <p className="text-sm font-medium">Cambiar comprobante</p>
              <form action={`/api/transactions/${current.id}/document`} method="post" className="space-y-2">
                <input type="hidden" name="next" value={here} />
                <label className="block text-xs text-slate-500">
                  Otro comprobante guardado
                  <select name="documentId" data-testid="receipt-choice" className="mt-1 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm" defaultValue="">
                    <option value="">Elegir</option>
                    {data.choices.map((choice) => (
                      <option key={choice.id} value={choice.id}>{choice.fileName}</option>
                    ))}
                  </select>
                </label>
                <Button type="submit" variant="outline" data-testid="receipt-use">Usar este</Button>
              </form>
              <form action={`/api/transactions/${current.id}/document`} method="post" encType="multipart/form-data" className="space-y-2">
                <input type="hidden" name="next" value={here} />
                <label className="inline-flex cursor-pointer items-center rounded-full border border-border px-3 py-1.5 text-xs font-medium text-slate-700">
                  Elegir archivo
                  <input name="file" type="file" required accept="image/jpeg,image/png,image/webp,application/pdf" data-testid="receipt-upload" className="sr-only" />
                </label>
                <Button type="submit" data-testid="receipt-upload-submit">{data.ticket.document ? "Reemplazar" : "Subir"}</Button>
              </form>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}

function OtherCategory({
  categories,
  parentName,
  otherId,
  onParent,
  onChild,
}: {
  categories: { name: string; children: { id: string; name: string }[] }[];
  parentName: string;
  otherId: string;
  onParent: (value: string) => void;
  onChild: (value: string) => void;
}) {
  const parent = categories.find((category) => category.name === parentName);
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      <label className="text-xs text-slate-500">
        Otra categoría
        <select
          data-testid="focus-parent"
          value={parentName}
          onChange={(event) => { onParent(event.target.value); onChild(""); }}
          className="mt-1 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm"
        >
          <option value="">Categoría</option>
          {categories.map((category) => (
            <option key={category.name} value={category.name}>{category.name}</option>
          ))}
        </select>
      </label>
      <label className="text-xs text-slate-500">
        Subcategoría
        <select
          data-testid="focus-child"
          value={otherId}
          onChange={(event) => onChild(event.target.value)}
          className="mt-1 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm"
        >
          <option value="">Subcategoría</option>
          {(parent?.children ?? []).map((child) => (
            <option key={child.id} value={child.id}>{child.name}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
