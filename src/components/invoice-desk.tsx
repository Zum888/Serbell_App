import { Folder } from "lucide-react";
import Link from "next/link";
import { AGING_LABEL, type AgingKey } from "@/lib/aging";
import { ADVANCE_LABEL, APPROVAL_LABEL, APPROVAL_TONE, type Approval, nextApproval } from "@/lib/approval";
import { formatDay } from "@/lib/dates";
import { formatUsd } from "@/lib/money";
import type { DeskSummary, InvoiceCard, InvoiceFolder } from "@/server/invoices";
import { Button } from "@/components/ui/button";

const APPROVAL_ORDER: Approval[] = ["por_autorizar", "autorizada", "en_proceso", "conciliada"];

export function ApprovalChip({ approval }: { approval: Approval }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${APPROVAL_TONE[approval]}`}>
      {APPROVAL_LABEL[approval]}
    </span>
  );
}

export function DeskTotals({ summary, label }: { summary: DeskSummary; label: string }) {
  return (
    <section className="rounded-2xl border border-border bg-white p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{formatUsd(summary.totalCents)}</p>
          <p className="text-sm text-slate-500">
            {summary.invoiceCount} facturas · Abierto {formatUsd(summary.openCents)} · Conciliado {formatUsd(summary.matchedCents)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {APPROVAL_ORDER.map((approval) => (
            <span key={approval} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${APPROVAL_TONE[approval]}`}>
              {APPROVAL_LABEL[approval]}
              <span className="tabular-nums">{summary.counts[approval]}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

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
  pins = [],
}: {
  folders: InvoiceFolder[];
  base: string;
  pins?: { id: string; name: string; totalCents: number; detail: string; href: string }[];
}) {
  const cards = [
    ...pins.map((pin) => ({ kind: "pin" as const, ...pin })),
    ...folders.map((folder) => ({ kind: "folder" as const, folder })),
  ].sort((a, b) => (a.kind === "pin" ? a.name : a.folder.name).localeCompare(b.kind === "pin" ? b.name : b.folder.name, "es"));
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) =>
        card.kind === "pin" ? (
          <Link key={card.id} href={card.href} data-testid="invoice-folder" className="rounded-2xl border border-border bg-white p-4 hover:border-slate-300">
            <div className="flex items-center gap-2">
              <Folder className="size-4 text-primary" />
              <h2 className="font-semibold" data-testid="folder-name">{card.name}</h2>
            </div>
            <p className="mt-3 text-xs text-slate-500">Total del mes</p>
            <p className="text-xl font-semibold tracking-tight" data-testid="folder-total">{formatUsd(card.totalCents)}</p>
            <p className="mt-2 text-sm text-slate-600">{card.detail}</p>
          </Link>
        ) : (
          <FolderCard key={card.folder.partyId} folder={card.folder} base={base} />
        ),
      )}
    </div>
  );
}

function FolderCard({ folder, base }: { folder: InvoiceFolder; base: string }) {
  return (
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
            <div className="flex flex-col items-end gap-1">
              <p className="font-semibold tabular-nums">{formatUsd(invoice.amountCents)}</p>
              <ApprovalChip approval={invoice.approval} />
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-600">
            {agingCaption(invoice.aging)}
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

export function PartyReport({
  title,
  name,
  totalCents,
  openCents,
  matchedCount,
  invoiceCount,
  movements,
}: {
  title: string;
  name: string;
  totalCents: number;
  openCents: number;
  matchedCount: number;
  invoiceCount: number;
  movements: { id: string; merchant: string; postedOn: string; amountCents: number }[];
}) {
  const seen = new Set<string>();
  const unique = movements.filter((movement) => {
    if (seen.has(movement.id)) return false;
    seen.add(movement.id);
    return true;
  });
  return (
    <section data-testid="party-report" className="rounded-2xl border border-border bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{title}</p>
      <h2 className="mt-1 text-xl font-semibold tracking-tight">{name}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-xs text-slate-500">Facturado</p>
          <p className="text-lg font-semibold tabular-nums">{formatUsd(totalCents)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Abierto</p>
          <p className="text-lg font-semibold tabular-nums">{formatUsd(openCents)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Con el banco</p>
          <p className="text-lg font-semibold tabular-nums">{matchedCount} de {invoiceCount}</p>
        </div>
      </div>
      <div className="mt-4">
        <p className="text-xs font-medium text-slate-500">Movimientos ligados</p>
        {unique.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Todavía no hay un movimiento del banco ligado a estas facturas.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {unique.map((movement) => (
              <li key={movement.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  <span className="font-medium">{movement.merchant}</span>
                  <span className="ml-2 text-xs text-slate-500">{formatDay(movement.postedOn)}</span>
                </span>
                <span className="tabular-nums">{formatUsd(movement.amountCents)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function InvoiceTable({
  rows,
  base,
  pin,
}: {
  rows: (InvoiceCard & { partyId: string; partyName: string })[];
  base: string;
  pin?: { name: string; href: string; detail: string; amountCents: number };
}) {
  const lines = [
    ...(pin ? [{ key: "pin", name: pin.name, href: pin.href, detail: pin.detail, amount: formatUsd(pin.amountCents), status: "Carpeta" }] : []),
    ...rows.map((row) => ({
      key: row.id,
      name: row.partyName,
      href: `${base}?parte=${row.partyId}&factura=${row.id}&vista=lista`,
      detail: `${row.number} · vence ${formatDay(row.dueOn)}`,
      amount: formatUsd(row.amountCents),
      status: row.status === "matched" ? "Conciliada" : APPROVAL_LABEL[row.approval],
    })),
  ].sort((a, b) => a.name.localeCompare(b.name, "es") || a.detail.localeCompare(b.detail, "es"));
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2 font-medium">Quién</th>
            <th className="px-4 py-2 font-medium">Detalle</th>
            <th className="px-4 py-2 font-medium">Estado</th>
            <th className="px-4 py-2 text-right font-medium">Importe</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.key} className="border-t border-slate-100">
              <td className="px-4 py-3 font-medium">
                <Link href={line.href} className="hover:text-primary">{line.name}</Link>
              </td>
              <td className="px-4 py-3 text-slate-600">{line.detail}</td>
              <td className="px-4 py-3 text-slate-600">{line.status}</td>
              <td className="px-4 py-3 text-right tabular-nums">{line.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
    approval: Approval;
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
      <div className="mt-2"><ApprovalChip approval={panel.approval} /></div>
      <p className="mt-2 text-sm text-slate-600">{panel.status === "matched" ? "Conciliada con el banco" : agingCaption(panel.aging)}</p>
      {panel.status !== "matched" && nextApproval(panel.approval) ? (
        <form action={`/api/invoices/${panel.id}/approval`} method="post" className="mt-3">
          <input type="hidden" name="next" value={next} />
          <Button type="submit" variant="outline" data-testid="advance-approval">
            {ADVANCE_LABEL[nextApproval(panel.approval) as string]}
          </Button>
        </form>
      ) : null}
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
