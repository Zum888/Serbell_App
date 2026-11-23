import Link from "next/link";
import { BankLedger } from "@/components/bank-ledger";
import { CategoryForm, pairsToGroups } from "@/components/category-form";
import { MovementMatch } from "@/components/movement-match";
import { ReceiptPanel } from "@/components/receipt-panel";
import { ACCOUNTING_LABEL, RECONCILIATION_LABEL } from "@/lib/labels";
import { formatUsd } from "@/lib/money";
import { StateView } from "@/components/state-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Row = {
  id: string;
  accountId: string;
  accountingState: string;
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

export function MovementsScreen({
  companyName,
  companyId,
  rows,
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
  priorMonth = null,
}: {
  companyName: string;
  companyId: string;
  rows: Row[];
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
  priorMonth?: { inflows: number; outflows: number } | null;
}) {
  const side = receipt || detail;
  const wide = Boolean(detail?.match);
  return (
    <div className={!side ? "" : wide ? "grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_480px]" : "grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]"}>
      <BankLedger
        companyName={companyName}
        companyId={companyId}
        accounts={accounts}
        accountId={accountId}
        rows={rows}
        categories={categories}
        canReview={canReview}
        filter={filter}
        q={q}
        found={found}
        notice={notice}
        duplicate={duplicate}
        decision={decision}
        missing={missing}
        error={error && !detail && !receipt ? error : undefined}
        withChat={withChat}
        flujo={flujo}
        priorMonth={accountId ? null : priorMonth}
      />
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

