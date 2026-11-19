import { LayoutGrid, Plus } from "lucide-react";
import Link from "next/link";
import { CategoryForm, pairsToGroups } from "@/components/category-form";
import { DuplicatePanel } from "@/components/duplicate-panel";
import { MissingPanel } from "@/components/missing-panel";
import { MovementMatch } from "@/components/movement-match";
import { MovementsTable } from "@/components/movements-table";
import { ReceiptPanel } from "@/components/receipt-panel";
import { accountInitials } from "@/lib/accounts";
import { DUPLICATE_IDS } from "@/lib/duplicates";
import { MISSING_IDS } from "@/lib/missing-receipts";
import { ACCOUNTING_LABEL, RECONCILIATION_LABEL } from "@/lib/labels";
import { formatUsd } from "@/lib/money";
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
  documentId: string | null;
  documentName: string | null;
  invoiceNumber: string | null;
  comment: string | null;
  suggested: boolean;
};

type Receipt = {
  transactionId: string;
  merchant: string;
  amountCents: number;
  sealed: boolean;
  document: { id: string; fileName: string; mimeType: string } | null;
  choices: { id: string; fileName: string; merchant: string | null; amountCents: number | null }[];
  auditNote: string | null;
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
  categoryId: string;
  subcategoryId: string;
  categoryLabel: string;
  match: {
    linked: boolean;
    documentId: string;
    fileName: string;
    postedDay: string;
    checks: { id: string; label: string }[];
    suggested: boolean;
  } | null;
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
  history: { id: string; action: string; actor: string; at: string; justification: string | null; note: string | null }[];
};

function bankAccent(institution: string) {
  const name = institution.toLowerCase();
  if (name.includes("amex") || name.includes("american express")) return "#016FD0";
  if (name.includes("america")) return "#C41230";
  if (name.includes("chase")) return "#0B5CAB";
  if (name.includes("wells")) return "#D71E28";
  return "#5B21B6";
}

const filters = [
  ["todos", "Todos"],
  ["sin-categoria", "Sin categorizar"],
  ["sin-comprobante", "Sin comprobantes"],
  ["por-conciliar", "Por conciliar"],
  ["por-revisar", "Por revisar"],
  ["aprobados", "Aprobados"],
] as const;

export function MovementsScreen({
  companyName,
  companyId,
  balanceLabel,
  rows,
  counts,
  filter,
  q,
  error,
  detail,
  receipt,
  canReview,
  categories,
  duplicate = false,
  decision,
  missing = false,
  accounts = [],
  accountId,
  found = [],
  notice,
  withChat = false,
  flujo,
}: {
  companyName: string;
  companyId: string;
  balanceLabel: string;
  rows: Row[];
  counts: { todos: number; sinCategoria: number; sinComprobante: number; porConciliar: number; porRevisar: number; aprobados: number; inflows: number; outflows: number };
  filter: string;
  q: string;
  error?: string;
  detail: Detail | null;
  receipt: Receipt | null;
  canReview: boolean;
  categories: { id: string; name: string; children?: { id: string; name: string; children?: { id: string; name: string }[] }[] }[];
  duplicate?: boolean;
  decision?: string;
  missing?: boolean;
  accounts?: { id: string; institution: string; mask: string; availableBalanceCents: number }[];
  accountId?: string;
  found?: string[];
  notice?: "factura" | "lote";
  withChat?: boolean;
  flujo?: string;
}) {
  const countFor: Record<string, number> = {
    todos: counts.todos,
    "sin-categoria": counts.sinCategoria,
    "sin-comprobante": counts.sinComprobante,
    "por-conciliar": counts.porConciliar,
    "por-revisar": counts.porRevisar,
    aprobados: counts.aprobados,
  };
  const side = receipt || detail;
  const wide = Boolean(detail?.match);
  const spotlight = duplicate ? (DUPLICATE_IDS as readonly string[]) : missing ? MISSING_IDS : found;
  const selectedAccount = accounts.find((account) => account.id === accountId) ?? null;
  const allAvailable = accounts.reduce((sum, account) => sum + account.availableBalanceCents, 0);
  const availableCents = selectedAccount ? selectedAccount.availableBalanceCents : allAvailable;
  function listHref(overrides: { filtro?: string; cuenta?: string | null } = {}) {
    const params = new URLSearchParams();
    const filtro = overrides.filtro ?? filter;
    const cuenta = overrides.cuenta === undefined ? accountId : overrides.cuenta;
    if (filtro) params.set("filtro", filtro);
    if (q) params.set("q", q);
    if (cuenta) params.set("cuenta", cuenta);
    if (withChat) {
      params.set("con", "chat");
      if (flujo) params.set("flujo", flujo);
    }
    const text = params.toString();
    return text ? `/movimientos?${text}` : "/movimientos";
  }
  const ordered = spotlight.length
    ? [...rows.filter((row) => spotlight.includes(row.id)), ...rows.filter((row) => !spotlight.includes(row.id))]
    : rows;
  const ready = rows.filter((row) => MISSING_IDS.includes(row.id) && row.documentState === "Linked").length;
  return (
    <div className={!side ? "" : wide ? "grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_480px]" : "grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]"}>
      <section className="min-w-0 rounded-2xl border border-border bg-white">
        <div className="border-b border-border px-4 py-4">
          <p className="text-xs text-slate-500">{companyName}</p>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">Bancos</h1>
              <p className="text-sm text-slate-500">{selectedAccount ? `${selectedAccount.institution} ····${selectedAccount.mask}` : periodOf(rows) || "Todos los bancos, por fecha"}</p>
            </div>
            {selectedAccount && rows.some((row) => row.reconciliationState !== "Reconciled") ? (
              <Link href={`/cuentas?${new URLSearchParams({ cuenta: selectedAccount.id, paso: "conciliar", ...(withChat ? { con: "chat", ...(flujo ? { flujo } : {}) } : {}) }).toString()}`} className="text-sm font-medium text-primary">Conciliar con el banco</Link>
            ) : null}
          </div>
          <div className="mt-4 rounded-2xl bg-slate-50 p-3">
            <div data-testid="bank-totals" className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-white px-3 py-3 shadow-sm ring-1 ring-slate-200">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Ingresos</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-600">{formatUsd(counts.inflows)}</p>
              </div>
              <div className="rounded-xl bg-white px-3 py-3 shadow-sm ring-1 ring-slate-200">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Gastos</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-rose-600">{formatUsd(counts.outflows)}</p>
              </div>
              <div className="rounded-xl bg-white px-3 py-3 shadow-sm ring-1 ring-slate-200" title={balanceLabel}>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Disponible</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{formatUsd(availableCents)}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{selectedAccount ? "Esta cuenta" : `Las ${accounts.length} cuentas`}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <nav aria-label="Cambiar de cuenta" data-testid="account-switcher" className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
                <Link href={listHref({ cuenta: null })} aria-current={selectedAccount ? undefined : "page"} className={`flex h-12 shrink-0 items-center gap-2 rounded-xl border bg-white px-2.5 ${selectedAccount ? "border-slate-200 hover:border-slate-300" : "border-slate-300 bg-slate-50"}`}>
                  <span className="flex size-7 items-center justify-center rounded-lg bg-slate-100 text-slate-700"><LayoutGrid className="size-3.5" /></span>
                  <span>
                    <span className="block text-sm font-medium leading-tight">Todas</span>
                    <span className="block text-[11px] tabular-nums leading-tight text-slate-500">{formatUsd(allAvailable)}</span>
                  </span>
                </Link>
                {accounts.map((account) => {
                  const active = account.id === accountId;
                  const accent = bankAccent(account.institution);
                  return (
                    <Link
                      key={account.id}
                      href={listHref({ cuenta: account.id })}
                      aria-current={active ? "page" : undefined}
                      className={`flex h-12 w-[188px] shrink-0 items-center gap-2 rounded-xl border bg-white px-2.5 ${active ? "border-slate-300 bg-slate-50" : "border-slate-200 hover:border-slate-300"}`}
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-semibold text-white" style={{ backgroundColor: accent }}>{accountInitials(account.institution)}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium leading-tight">{account.institution}</span>
                        <span className="block truncate text-[11px] leading-tight text-slate-500">····{account.mask} · {formatUsd(account.availableBalanceCents)}</span>
                      </span>
                    </Link>
                  );
                })}
              </nav>
              <Link href="/cuentas/conectar" data-testid="add-account" className="shrink-0 rounded-lg px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100">
                <Plus className="mr-1 inline size-3.5" /> Agregar
              </Link>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Link href="/movimientos?vista=enfoque" className="rounded-full border border-border px-3 py-1.5 text-xs text-slate-600">Modo enfoque</Link>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-800">Vista detallada</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 px-4 py-3">
          {filters.map(([key, label]) => (
            <Link
              key={key}
              href={listHref({ filtro: key })}
              className={filter === key ? "rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-900" : "rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50"}
            >
              {label}
              <span className="ml-1 text-slate-400">{countFor[key]}</span>
            </Link>
          ))}
        </div>
        <form className="px-4 pb-3" action="/movimientos">
          <input type="hidden" name="filtro" value={filter} />
          {accountId ? <input type="hidden" name="cuenta" value={accountId} /> : null}
          {withChat ? <input type="hidden" name="con" value="chat" /> : null}
          {withChat && flujo ? <input type="hidden" name="flujo" value={flujo} /> : null}
          <Input name="q" defaultValue={q} placeholder="Buscar movimiento..." />
        </form>
        {notice === "factura" ? <p data-testid="invoice-reconciled" className="px-4 pb-3 text-sm text-emerald-800">La factura quedó conciliada con el movimiento del banco.</p> : null}
        {notice === "lote" ? <p data-testid="batch-reconciled" className="px-4 pb-3 text-sm text-emerald-800">El lote quedó conciliado con los movimientos del banco.</p> : null}
        {duplicate ? <DuplicatePanel decision={decision} /> : null}
        {missing ? <MissingPanel ready={ready} /> : null}
        {error && !detail && !receipt ? <div className="px-4 pb-3"><StateView variant="error" title={error} testId="server-error" /></div> : null}
        {ordered.length === 0 ? (
          <div className="px-4 pb-4">
            <StateView variant="empty" title="No hay movimientos con este filtro." />
          </div>
        ) : (
          <MovementsTable rows={ordered} categories={categories} canReview={canReview} filter={filter} q={q} companyId={companyId} accountId={accountId} showBank={!selectedAccount} marked={[...spotlight]} />
        )}
      </section>
      {receipt ? <ReceiptPanel receipt={receipt} filter={filter} q={q} error={error} /> : detail?.match ? (
        <MovementMatch
          detail={{ ...detail, match: detail.match }}
          categories={categories}
          closeHref={stay(filter, q, accountId)}
          next={stay(filter, q, accountId, `movimiento=${detail.id}`)}
        />
      ) : detail ? <Drawer detail={detail} error={error} filter={filter} q={q} accountId={accountId} /> : null}
    </div>
  );
}

function periodOf(rows: { postedOn: string }[]) {
  const day = rows.find((row) => row.postedOn)?.postedOn;
  if (!day) return "";
  const [year, month] = day.split("-").map(Number);
  if (!year || !month) return "";
  const label = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1, 12))).replace(" de ", " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function stay(filter: string, q: string, accountId: string | undefined, extra = "") {
  const params = new URLSearchParams();
  if (filter) params.set("filtro", filter);
  if (q) params.set("q", q);
  if (accountId) params.set("cuenta", accountId);
  const text = params.toString();
  return `/movimientos${text ? `?${text}` : ""}${extra ? `${text ? "&" : "?"}${extra}` : ""}`;
}

function Drawer({ detail, error, filter, q, accountId }: { detail: Detail; error?: string; filter: string; q: string; accountId?: string }) {
  return (
    <aside data-testid="drawer" className="rounded-2xl border border-border bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">{detail.postedOn} · {detail.bankState === "Posted" ? "Publicado" : detail.bankState}</p>
          <h2 className="text-lg font-semibold">{detail.merchant}</h2>
          <p className="text-sm">{formatUsd(detail.amountCents)}</p>
        </div>
        <Link href={stay(filter, q, accountId)} className="text-sm text-slate-500">Cerrar</Link>
      </div>
      <p data-testid="drawer-classification" className="mt-3 text-sm text-slate-700">{detail.categoryLabel || "Sin categoría"}</p>
      <CategoryForm
        id={detail.id}
        subcategoryId={detail.subcategoryId}
        categories={pairsToGroups(detail.pairs)}
        canReview={detail.canReview}
        sealed={detail.sealed}
        next={stay(filter, q, accountId, `movimiento=${detail.id}`)}
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
              <img src="/demo/comprobante.svg" alt="" className="mt-2 max-h-36 rounded-lg border border-border" />
            ) : null}
          </>
        ) : (
          <p className="mt-1 text-slate-500">Faltante. No hay un comprobante vinculado.</p>
        )}
      </section>
      <JournalBlock detail={detail} filter={filter} q={q} accountId={accountId} />
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
                {event.note ? <p className="text-slate-600">{event.note}</p> : null}
                {event.justification ? <p className="text-slate-600">{event.justification}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="mt-4 flex flex-wrap gap-2">
        {detail.reconciliationState === "Reconciled" ? null : (
          <form action={`/api/transactions/${detail.id}/reconcile`} method="post" className="mt-4">
            <input type="hidden" name="next" value={stay(filter, q, accountId, `movimiento=${detail.id}`)} />
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

function JournalBlock({ detail, filter, q, accountId }: { detail: Detail; filter: string; q: string; accountId?: string }) {
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
          <input type="hidden" name="next" value={stay(filter, q, accountId, `movimiento=${detail.id}`)} />
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

