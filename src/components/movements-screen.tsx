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
  subcategoryId: string;
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
  catalog: string[];
  journal: { lines: { id: string; accountName: string; debitCents: number; creditCents: number }[] } | null;
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
  canReview,
  categories,
}: {
  companyName: string;
  balanceLabel: string;
  rows: Row[];
  counts: { todos: number; sinCategoria: number; sinComprobante: number; porRevisar: number; aprobados: number };
  filter: string;
  q: string;
  error?: string;
  detail: Detail | null;
  canReview: boolean;
  categories: { name: string; children: { id: string; name: string }[] }[];
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
          <p className="mt-1 text-sm text-slate-500">En una fila abierta, elige la categoría y la subcategoría y guarda. Una fila sellada no se cambia.</p>
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
                {rows.map((row) => (
                  <tr key={row.id} data-testid={`movement-row-${row.id}`} className="border-b border-border align-top">
                    <td className="px-3 py-2 whitespace-nowrap">{formatDay(row.postedOn)}</td>
                    <td className="px-3 py-2">
                      <p className="font-medium">{row.merchant}</p>
                      <p className="text-xs text-slate-500">{row.description}</p>
                    </td>
                    <td className="px-3 py-2" colSpan={2}>
                      <CategoryEditor
                        row={row}
                        categories={categories}
                        canReview={canReview}
                        next={`/movimientos?filtro=${filter}&q=${encodeURIComponent(q)}`}
                      />
                    </td>
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
      <CategoryForm
        id={detail.id}
        subcategoryId={detail.subcategoryId}
        categories={pairsToGroups(detail.pairs)}
        canReview={detail.canReview}
        sealed={detail.sealed}
        next={`/movimientos?filtro=${filter}&q=${encodeURIComponent(q)}&movimiento=${detail.id}`}
        testId="save-classification"
      />
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
      <JournalBlock detail={detail} filter={filter} q={q} />
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

function JournalBlock({ detail, filter, q }: { detail: Detail; filter: string; q: string }) {
  const debit = detail.journal?.lines.reduce((sum, line) => sum + line.debitCents, 0) ?? 0;
  const credit = detail.journal?.lines.reduce((sum, line) => sum + line.creditCents, 0) ?? 0;
  return (
    <section data-testid="drawer-asiento" className="mt-4 rounded-xl border border-border p-3">
      <h3 className="text-sm font-medium">Asiento</h3>
      {detail.journal ? (
        <table className="mt-2 w-full text-left text-sm">
          <thead className="text-xs text-slate-500">
            <tr>
              <th className="py-1 font-medium">Cuenta</th>
              <th className="py-1 text-right font-medium">Débito</th>
              <th className="py-1 text-right font-medium">Crédito</th>
            </tr>
          </thead>
          <tbody>
            {detail.journal.lines.map((line) => (
              <tr key={line.id} data-testid="journal-line">
                <td className="py-1">{line.accountName}</td>
                <td className="py-1 text-right">{line.debitCents ? formatUsd(line.debitCents) : ""}</td>
                <td className="py-1 text-right">{line.creditCents ? formatUsd(line.creditCents) : ""}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border text-xs text-slate-500">
              <td className="py-1">Cuadra</td>
              <td className="py-1 text-right">{formatUsd(debit)}</td>
              <td className="py-1 text-right">{formatUsd(credit)}</td>
            </tr>
          </tfoot>
        </table>
      ) : (
        <p className="mt-1 text-sm text-slate-500">Este movimiento todavía no tiene asiento.</p>
      )}
      {detail.sealed ? (
        <p className="mt-2 text-xs text-slate-500">Está sellado. Ana tiene que reabrirlo con una justificación antes de editarlo.</p>
      ) : null}
      {detail.canReview && !detail.sealed ? (
        <form action={`/api/transactions/${detail.id}/asiento`} method="post" className="mt-3 space-y-2">
          <input type="hidden" name="next" value={`/movimientos?filtro=${filter}&q=${encodeURIComponent(q)}&movimiento=${detail.id}`} />
          <label className="block text-xs text-slate-500">
            Categoría y subcategoría
            <select name="subcategoryId" defaultValue={detail.subcategoryId} required className="mt-1 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm">
              <option value="">Elegir</option>
              {detail.pairs.map((pair) => (
                <option key={pair.subcategoryId} value={pair.subcategoryId}>{pair.label}</option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-[minmax(0,1fr)_88px_88px] gap-2 text-xs text-slate-500">
            <span>Cuenta del catálogo</span>
            <span>Débito, centavos</span>
            <span>Crédito, centavos</span>
          </div>
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="grid grid-cols-[minmax(0,1fr)_88px_88px] gap-2">
              <select name="accountName" defaultValue={index === 0 ? "Combustible" : index === 1 ? "Servicios" : ""} className="h-10 rounded-xl border border-border bg-white px-2 text-sm">
                <option value="">—</option>
                {detail.catalog.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <Input name="debitCents" inputMode="numeric" placeholder="0" defaultValue={index === 0 ? String(Math.abs(detail.amountCents)) : ""} aria-label={`Débito ${index + 1}`} />
              <Input name="creditCents" inputMode="numeric" placeholder="0" defaultValue={index === 1 ? String(Math.abs(detail.amountCents)) : ""} aria-label={`Crédito ${index + 1}`} />
            </div>
          ))}
          <Input name="justification" placeholder="Justificación del asiento" required />
          <Button type="submit" data-testid="save-asiento">Guardar asiento</Button>
        </form>
      ) : null}
    </section>
  );
}

function CategoryEditor({
  row,
  categories,
  canReview,
  next,
}: {
  row: Row;
  categories: { name: string; children: { id: string; name: string }[] }[];
  canReview: boolean;
  next: string;
}) {
  return (
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
  );
}

function CategoryForm({
  id,
  subcategoryId,
  categories,
  canReview,
  sealed,
  next,
  testId,
  compact = false,
}: {
  id: string;
  subcategoryId: string;
  categories: { name: string; children: { id: string; name: string }[] }[];
  canReview: boolean;
  sealed: boolean;
  next: string;
  testId: string;
  compact?: boolean;
}) {
  if (sealed) {
    return <p className="mt-1 text-xs text-slate-500">Sellado. El servidor rechaza el cambio.</p>;
  }
  return (
    <form action={`/api/transactions/${id}/classification`} method="post" className={compact ? "mt-1 space-y-1" : "mt-3 space-y-2 rounded-xl border border-border p-3"}>
      <input type="hidden" name="next" value={next} />
      {compact ? null : <h3 className="text-sm font-medium">Cambiar categoría y subcategoría</h3>}
      <label className="block text-xs text-slate-500">
        {compact ? null : "Categoría y subcategoría"}
        <select
          name="subcategoryId"
          defaultValue={subcategoryId}
          required
          data-testid={compact ? `category-select-${id}` : `detail-category-select-${id}`}
          aria-label={`Categoría y subcategoría de ${id}`}
          className="mt-1 h-9 w-full min-w-[180px] rounded-xl border border-border bg-white px-2 text-sm"
        >
          <option value="">Elegir</option>
          {categories.map((group) => (
            <optgroup key={group.name} label={group.name}>
              {group.children.map((child) => (
                <option key={child.id} value={child.id}>{child.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      {canReview ? (
        <Input name="justification" required minLength={8} placeholder="Justificación del contador" aria-label="Justificación" />
      ) : (
        <p className="text-xs text-slate-500">{compact ? "Propuesta" : "Queda como propuesta. No sella ni crea el asiento."}</p>
      )}
      <button type="submit" data-testid={testId} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white">
        Guardar categoría
      </button>
    </form>
  );
}

function pairsToGroups(pairs: { subcategoryId: string; label: string }[]) {
  const groups = new Map<string, { id: string; name: string }[]>();
  for (const pair of pairs) {
    const [category, ...rest] = pair.label.split(" / ");
    const name = rest.join(" / ") || pair.label;
    const list = groups.get(category) ?? [];
    list.push({ id: pair.subcategoryId, name });
    groups.set(category, list);
  }
  return [...groups.entries()].map(([name, children]) => ({ name, children }));
}
