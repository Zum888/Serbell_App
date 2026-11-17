import { Lock, LockOpen } from "lucide-react";
import Link from "next/link";
import { formatDay } from "@/lib/dates";
import { ACCOUNTING_LABEL, DOCUMENT_LABEL, RECONCILIATION_LABEL, REVIEW_LABEL } from "@/lib/labels";
import { formatCentsPlain, formatUsd } from "@/lib/money";
import { StateView } from "@/components/state-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Row = {
  id: string;
  postedOn: string;
  merchant: string;
  description: string;
  amountCents: number;
  category: string | null;
  subcategory: string | null;
  documentState: string;
  reviewState: string;
  reconciliationState: string;
  serbellConciled: boolean;
  sealed: boolean;
  institution: string;
  mask: string;
};

type Detail = {
  id: string;
  merchant: string;
  description: string;
  postedOn: string;
  amountCents: number;
  institution: string;
  productName: string;
  mask: string;
  documentState: string;
  reviewState: string;
  accountingState: string;
  reconciliationState: string;
  serbellConciled: boolean;
  bankState: string;
  sealed: boolean;
  sealedAt: string | null;
  subcategoryId: string;
  categoryLabel: string;
  pairs: { subcategoryId: string; label: string }[];
  canReview: boolean;
  canReopen: boolean;
  document: {
    id: string;
    fileName: string;
    mimeType: string;
    merchant: string | null;
    amountCents: number | null;
    occurredOn: string;
    notice: string | null;
    isDemonstration: boolean;
  } | null;
  messages: { id: string; role: string; body: string; author: string; at: string }[];
  history: { id: string; action: string; actor: string; at: string; justification: string | null }[];
};

const filters = [
  ["todos", "Todos"],
  ["sin-categoria", "Sin categoría"],
  ["sin-comprobante", "Sin comprobante"],
  ["por-revisar", "Por revisar"],
  ["aprobados", "Aprobados"],
] as const;

export function MovementsScreen({
  companyName,
  balanceLabel,
  rows,
  counts,
  filter,
  q,
  error,
  detail,
}: {
  companyName: string;
  balanceLabel: string;
  rows: Row[];
  counts: { todos: number; sinCategoria: number; sinComprobante: number; porRevisar: number; aprobados: number };
  filter: string;
  q: string;
  error?: string;
  detail: Detail | null;
}) {
  const countFor: Record<string, number> = {
    todos: counts.todos,
    "sin-categoria": counts.sinCategoria,
    "sin-comprobante": counts.sinComprobante,
    "por-revisar": counts.porRevisar,
    aprobados: counts.aprobados,
  };
  return (
    <div className={detail ? "grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]" : ""}>
      <section className="min-w-0 rounded-2xl border border-border bg-white">
        <div className="border-b border-border px-4 py-4">
          <p className="text-xs text-slate-500">{companyName}</p>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h1 className="text-2xl font-semibold">Movimientos</h1>
            <p className="text-sm text-slate-500">{balanceLabel}</p>
          </div>
          <p className="mt-1 text-sm text-slate-500">Clasifica y revisa las operaciones. La conciliación bancaria de este laboratorio queda sin cerrar.</p>
        </div>
        <div className="flex flex-wrap gap-2 px-4 py-3">
          {filters.map(([key, label]) => (
            <Link
              key={key}
              href={`/movimientos?filtro=${key}`}
              className={filter === key ? "rounded-full bg-slate-900 px-3 py-1.5 text-xs text-white" : "rounded-full border border-border px-3 py-1.5 text-xs text-slate-600"}
            >
              {label} ({countFor[key]})
            </Link>
          ))}
        </div>
        <form className="px-4 pb-3" action="/movimientos">
          <input type="hidden" name="filtro" value={filter} />
          <Input name="q" defaultValue={q} placeholder="Buscar movimiento, comercio o importe..." />
        </form>
        {error && !detail ? <div className="px-4 pb-3"><StateView variant="error" title={error} testId="server-error" /></div> : null}
        {rows.length === 0 ? (
          <div className="px-4 pb-4">
            <StateView variant="empty" title="No hay movimientos con este filtro." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr className="border-y border-border">
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Movimiento</th>
                  <th className="px-3 py-2 font-medium">Categoría</th>
                  <th className="px-3 py-2 font-medium">Subcategoría</th>
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
                {rows.map((row) => (
                  <tr key={row.id} data-testid={`movement-row-${row.id}`} className="border-b border-border align-top">
                    <td className="px-3 py-2 whitespace-nowrap">{formatDay(row.postedOn)}</td>
                    <td className="px-3 py-2">
                      <p className="font-medium">{row.merchant}</p>
                      <p className="text-xs text-slate-500">{row.description}</p>
                    </td>
                    <td className="px-3 py-2">{row.category ?? "Sin categoría"}</td>
                    <td className="px-3 py-2">{row.subcategory ?? "—"}</td>
                    <td className="px-3 py-2">{row.amountCents > 0 ? formatCentsPlain(row.amountCents) : ""}</td>
                    <td className="px-3 py-2">{row.amountCents < 0 ? formatCentsPlain(row.amountCents) : ""}</td>
                    <td className="px-3 py-2" data-testid="doc-state">{DOCUMENT_LABEL[row.documentState] ?? row.documentState}</td>
                    <td className="px-3 py-2" data-testid="review-state">{REVIEW_LABEL[row.reviewState] ?? row.reviewState}</td>
                    <td className="px-3 py-2" data-testid="bank-recon">
                      <p>{RECONCILIATION_LABEL[row.reconciliationState] ?? "Sin conciliar"}</p>
                      {row.serbellConciled ? <p data-testid="serbell-mark" className="text-xs font-medium text-primary">Serbell concilió</p> : null}
                    </td>
                    <td className="px-3 py-2">
                      <span data-testid="seal-lock" data-locked={row.sealed ? "true" : "false"} className="inline-flex items-center gap-1 text-xs">
                        {row.sealed ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5 text-slate-400" />}
                        {row.sealed ? <span data-testid="sealed-label">Autorizado y bloqueado</span> : "Abierto"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        <Link className="font-medium text-primary" href={`/movimientos?filtro=${filter}&q=${encodeURIComponent(q)}&movimiento=${row.id}`}>
                          Ver
                        </Link>
                        {row.reconciliationState === "Reconciled" ? null : (
                          <form action={`/api/transactions/${row.id}/reconcile`} method="post">
                            <input type="hidden" name="next" value={`/movimientos?filtro=${filter}&q=${encodeURIComponent(q)}`} />
                            <button type="submit" data-testid={`reconcile-${row.id}`} className="font-medium text-primary">
                              Conciliar
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="px-4 py-3 text-xs text-slate-500">{rows.length} movimientos en esta vista</p>
      </section>
      {detail ? <Drawer detail={detail} error={error} filter={filter} q={q} /> : null}
    </div>
  );
}

function Drawer({ detail, error, filter, q }: { detail: Detail; error?: string; filter: string; q: string }) {
  return (
    <aside data-testid="drawer" className="rounded-2xl border border-border bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">{detail.postedOn} · {detail.bankState === "Posted" ? "Publicado" : detail.bankState}</p>
          <h2 className="text-lg font-semibold">{detail.merchant}</h2>
          <p className="text-sm">{formatUsd(detail.amountCents)}</p>
        </div>
        <Link href={`/movimientos?filtro=${filter}&q=${encodeURIComponent(q)}`} className="text-sm text-slate-500">Cerrar</Link>
      </div>
      {error ? <div className="mt-3"><StateView variant="error" title={error} testId="server-error" /></div> : null}
      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div><dt className="text-xs text-slate-500">Cuenta</dt><dd>{detail.institution} ····{detail.mask}</dd></div>
        <div><dt className="text-xs text-slate-500">Producto</dt><dd>{detail.productName}</dd></div>
        <div><dt className="text-xs text-slate-500">Estado contable</dt><dd>{ACCOUNTING_LABEL[detail.accountingState] ?? detail.accountingState}</dd></div>
        <div>
          <dt className="text-xs text-slate-500">Conciliación</dt>
          <dd>
            {RECONCILIATION_LABEL[detail.reconciliationState] ?? "Sin conciliar"}
            {detail.serbellConciled ? <span data-testid="serbell-mark" className="mt-1 block text-xs font-medium text-primary">Serbell concilió</span> : null}
          </dd>
        </div>
      </dl>
      <section data-testid="drawer-document" className="mt-4 rounded-xl border border-border p-3 text-sm">
        <h3 className="font-medium">Comprobante</h3>
        {detail.document ? (
          <>
            <p className="mt-1">{detail.document.fileName}</p>
            <p>{detail.document.merchant} · {detail.document.amountCents !== null ? formatUsd(detail.document.amountCents) : "Sin importe"} · {detail.document.occurredOn}</p>
            {detail.document.isDemonstration ? <p className="mt-1 text-xs text-amber-700">Dato de demostración</p> : null}
            <p className="mt-1 text-slate-500">{detail.document.notice}</p>
            {detail.document.mimeType.startsWith("image/") ? (
              <img src={`/api/documents/${detail.document.id}/file`} alt="" className="mt-2 max-h-36 rounded-lg border border-border" />
            ) : null}
          </>
        ) : (
          <p className="mt-1 text-slate-500">Faltante. No hay un comprobante vinculado.</p>
        )}
      </section>
      <section data-testid="drawer-classification" className="mt-4">
        <h3 className="text-sm font-medium">Clasificación</h3>
        <p className="mt-1 text-sm text-slate-600">{detail.categoryLabel}</p>
        <form action={`/api/transactions/${detail.id}/classification`} method="post" className="mt-2 space-y-2">
          {detail.sealed ? <input type="hidden" name="subcategoryId" value={detail.subcategoryId} /> : null}
          <select
            name={detail.sealed ? undefined : "subcategoryId"}
            defaultValue={detail.subcategoryId}
            disabled={detail.sealed}
            className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm disabled:bg-slate-50"
          >
            <option value="">Sin categoría</option>
            {detail.pairs.map((pair) => (
              <option key={pair.subcategoryId} value={pair.subcategoryId}>{pair.label}</option>
            ))}
          </select>
          {detail.canReview ? <Input name="justification" placeholder="Justificación de la corrección" /> : null}
          <Button type="submit" variant="outline" data-testid="save-classification">Guardar categoría</Button>
        </form>
      </section>
      <section data-testid="drawer-conversation" className="mt-4">
        <h3 className="text-sm font-medium">Conversación</h3>
        {detail.messages.length === 0 ? <p className="mt-1 text-sm text-slate-500">Todavía no hay mensajes sobre este movimiento.</p> : (
          <ul className="mt-2 space-y-2">
            {detail.messages.map((message) => (
              <li key={message.id} className="rounded-lg bg-slate-50 px-2 py-1.5 text-sm">
                <span className="text-xs text-slate-500">{message.author} · {message.at}</span>
                <p>{message.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section data-testid="drawer-history" className="mt-4">
        <h3 className="text-sm font-medium">Historial</h3>
        {detail.history.length === 0 ? <p className="mt-1 text-sm text-slate-500">Sin movimientos de auditoría todavía.</p> : (
          <ul className="mt-2 space-y-2">
            {detail.history.map((event) => (
              <li key={event.id} className="text-sm">
                <p className="font-medium">{event.action}</p>
                <p className="text-xs text-slate-500">{event.actor} · {event.at}</p>
                {event.justification ? <p className="text-slate-600">{event.justification}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="mt-4 flex flex-wrap gap-2">
        {detail.reconciliationState === "Reconciled" ? null : (
          <form action={`/api/transactions/${detail.id}/reconcile`} method="post" className="mt-4">
            <input type="hidden" name="next" value={`/movimientos?filtro=${filter}&q=${encodeURIComponent(q)}&movimiento=${detail.id}`} />
            <Button type="submit" variant="outline" data-testid={`reconcile-${detail.id}`}>Conciliar</Button>
          </form>
        )}
        {detail.canReview && !detail.sealed ? (
          <form action={`/api/transactions/${detail.id}/seal`} method="post" className="mt-3">
            <Button type="submit" data-testid="approve-seal">Aprobar y sellar</Button>
          </form>
        ) : null}
        {detail.sealed ? <StateView variant="success" title={detail.sealedAt ? `Autorizado y bloqueado · ${detail.sealedAt}` : "Autorizado y bloqueado"} /> : null}
      </div>
      {detail.canReview && !detail.sealed ? (
        <form action={`/api/transactions/${detail.id}/clarification`} method="post" className="mt-3 space-y-2">
          <Input name="message" placeholder="Pedir una aclaración al cliente" />
          <Button type="submit" variant="outline">Solicitar aclaración</Button>
        </form>
      ) : null}
      {detail.canReopen && detail.sealed ? (
        <form action={`/api/transactions/${detail.id}/reopen`} method="post" className="mt-3 space-y-2">
          <Input name="justification" placeholder="Justificación para reabrir el sello" required />
          <Button type="submit" variant="outline">Reabrir sello</Button>
        </form>
      ) : null}
    </aside>
  );
}
