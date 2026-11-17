import { Folder } from "lucide-react";
import Link from "next/link";
import { AGING_LABEL, type AgingKey } from "@/lib/aging";
import { formatDay } from "@/lib/dates";
import { formatUsd } from "@/lib/money";
import type { InvoiceCard, InvoiceFolder } from "@/server/invoices";
import { Button } from "@/components/ui/button";

function agingCaption(key: AgingKey | null) {
  if (!key) return "Conciliada con el banco";
  return AGING_LABEL[key];
}

const AGING_KEYS: AgingKey[] = ["current", "d30", "d60", "d60plus"];

function progress(folder: InvoiceFolder) {
  if (folder.invoiceCount === 0) return 0;
  return Math.round((folder.matchedCount / folder.invoiceCount) * 100);
}

export function InvoiceFolders({
  folders,
  base,
}: {
  folders: InvoiceFolder[];
  base: string;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {folders.map((folder) => (
        <Link
          key={folder.partyId}
          href={`${base}?parte=${folder.partyId}`}
          data-testid="invoice-folder"
          className="rounded-2xl border border-border bg-white p-4 hover:border-slate-300"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Folder className="size-4 text-primary" />
              <h2 className="font-semibold" data-testid="folder-name">{folder.name}</h2>
            </div>
            <span className="text-xs text-amber-700">Demostración</span>
          </div>
          <p className="mt-3 text-xs text-slate-500">Total</p>
          <p className="text-xl font-semibold tracking-tight" data-testid="folder-total">{formatUsd(folder.totalCents)}</p>
          <p className="mt-2 text-sm text-slate-600" data-testid="folder-open">Saldo abierto {formatUsd(folder.openCents)}</p>
          <dl className="mt-3 grid grid-cols-4 gap-2 text-xs">
            {AGING_KEYS.map((key) => (
              <div key={key}>
                <dt className="text-slate-500">{AGING_LABEL[key]}</dt>
                <dd data-testid={`aging-${key}`}>{formatUsd(folder.aging[key])}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-primary" style={{ width: `${progress(folder)}%` }} />
            </div>
            <p className="mt-1 text-xs text-slate-500" data-testid="folder-progress">
              {folder.matchedCount} de {folder.invoiceCount} conciliadas con el banco
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function InvoiceList({
  invoices,
  base,
  partyId,
  activeId,
}: {
  invoices: InvoiceCard[];
  base: string;
  partyId: string;
  activeId?: string;
}) {
  return (
    <div className="space-y-2">
      {invoices.map((invoice) => (
        <Link
          key={invoice.id}
          href={`${base}?parte=${partyId}&factura=${invoice.id}`}
          data-testid="invoice-row"
          className={`block rounded-2xl border bg-white p-4 ${activeId === invoice.id ? "border-primary" : "border-border"}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{invoice.number}</p>
              <p className="text-xs text-slate-500">
                Emitida {formatDay(invoice.issuedOn)} · Vence {formatDay(invoice.dueOn)}
              </p>
            </div>
            <p className="font-semibold">{formatUsd(invoice.amountCents)}</p>
          </div>
          <p className="mt-2 text-xs text-slate-600">
            {invoice.status === "matched" ? "Conciliada con el banco" : agingCaption(invoice.aging)}
            {invoice.followUpAt ? " · En seguimiento" : ""}
          </p>
          {invoice.movement ? (
            <p className="mt-1 text-xs text-slate-500">
              Movimiento {invoice.movement.merchant} · {formatDay(invoice.movement.postedOn)}
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">Sin movimiento vinculado</p>
          )}
        </Link>
      ))}
    </div>
  );
}

export function InvoicePanel({
  panel,
  closeHref,
  next,
  error,
}: {
  panel: {
    number: string;
    partyName: string;
    amountLabel: string;
    issuedOn: string;
    dueOn: string;
    aging: AgingKey | null;
    status: string;
    isDemonstration: boolean;
    followUpAt: string | null;
    movement: { id: string; merchant: string; postedOn: string; amountLabel: string; sealed: boolean } | null;
    matchNote: string | null;
    candidates: { transactionId: string; merchant: string; postedOn: string; amountLabel: string; sealed: boolean }[];
    id: string;
  };
  closeHref: string;
  next: string;
  error?: string;
}) {
  const openCandidates = panel.candidates.filter((candidate) => !candidate.sealed);
  return (
    <aside data-testid="invoice-panel" className="rounded-2xl border border-border bg-white p-4 lg:sticky lg:top-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">Factura</p>
          <h2 className="text-lg font-semibold">{panel.number}</h2>
          <p className="text-sm text-slate-600">{panel.partyName}</p>
        </div>
        <Link href={closeHref} className="text-sm text-slate-500" data-testid="invoice-close">Cerrar</Link>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{panel.amountLabel}</p>
      <p className="text-sm text-slate-500">Emitida {formatDay(panel.issuedOn)} · Vence {formatDay(panel.dueOn)}</p>
      <p className="mt-2 text-sm text-slate-600">{panel.status === "matched" ? "Conciliada con el banco" : agingCaption(panel.aging)}</p>
      {panel.isDemonstration ? <p className="mt-2 text-xs text-amber-700">Demostración. No cobra ni paga.</p> : null}
      {error ? <p className="mt-2 text-sm text-red-700" data-testid="server-error">{error}</p> : null}
      {panel.movement ? (
        <Link href={`/movimientos?movimiento=${panel.movement.id}`} className="mt-3 block rounded-xl border border-border px-3 py-2 text-sm" data-testid="linked-movement">
          <span className="text-xs text-slate-500">Movimiento vinculado</span>
          <span className="mt-1 block font-medium">{panel.movement.merchant}</span>
          <span className="text-xs text-slate-500">{formatDay(panel.movement.postedOn)} · {panel.movement.amountLabel}</span>
        </Link>
      ) : (
        <p className="mt-3 text-sm text-slate-500">Sin movimiento vinculado.</p>
      )}
      {panel.matchNote && !panel.movement ? <p className="mt-2 text-xs text-slate-500">{panel.matchNote}</p> : null}
      {openCandidates.map((candidate) => (
        <form key={candidate.transactionId} action={`/api/invoices/${panel.id}/link`} method="post" className="mt-3 rounded-xl border border-border p-3">
          <input type="hidden" name="transactionId" value={candidate.transactionId} />
          <input type="hidden" name="next" value={next} />
          <p className="text-sm font-medium">{candidate.merchant}</p>
          <p className="text-xs text-slate-500">{formatDay(candidate.postedOn)} · {candidate.amountLabel}</p>
          <p className="mt-2 text-xs text-slate-500">El vínculo anota la coincidencia. No registra un cobro ni un pago.</p>
          <Button type="submit" className="mt-2" data-testid="link-invoice">Vincular con el movimiento</Button>
        </form>
      ))}
      {panel.candidates.some((candidate) => candidate.sealed) ? (
        <p className="mt-3 text-xs text-slate-500">El movimiento compatible está sellado. El servidor rechaza el vínculo.</p>
      ) : null}
      {panel.followUpAt ? (
        <p className="mt-4 text-sm text-slate-600" data-testid="follow-up-note">En seguimiento desde {formatDay(panel.followUpAt.slice(0, 10))}.</p>
      ) : (
        <form action={`/api/invoices/${panel.id}/follow-up`} method="post" className="mt-4">
          <input type="hidden" name="next" value={next} />
          <Button type="submit" variant="outline" data-testid="follow-up">Marcar seguimiento</Button>
        </form>
      )}
    </aside>
  );
}
