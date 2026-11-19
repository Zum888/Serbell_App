import { FixedChecklist } from "@/components/fixed-checklist";
import { InvoiceBoard, type DeskRow } from "@/components/invoice-board";
import { InvoiceList, InvoicePanel, PartyReport } from "@/components/invoice-desk";
import { monthName } from "@/lib/fixed";
import { formatUsd } from "@/lib/money";
import { fixedChecklist } from "@/server/planning";
import { StateView } from "@/components/state-view";
import { todayKey } from "@/lib/aging";
import { isAppError } from "@/lib/errors";
import { db } from "@/server/db";
import { pageContext } from "@/server/context";
import { invoiceDesk, invoicePanel } from "@/server/invoices";
import Link from "next/link";

export default async function PayablesPage({
  searchParams,
}: {
  searchParams: Promise<{ parte?: string; factura?: string; error?: string; vista?: string }>;
}) {
  const session = await pageContext();
  const params = await searchParams;
  if (!session.companyId) return <StateView variant="empty" title="Selecciona una empresa para ver sus facturas." />;
  const database = await db();
  const [{ folders }, fixed] = await Promise.all([
    invoiceDesk(database, session.actor, session.companyId, "payable"),
    fixedChecklist(database, session.actor, session.companyId),
  ]);
  const fixedSelected = params.parte === "gastos-fijos";
  const folder = folders.find((item) => item.partyId === params.parte) ?? null;
  let panel = null;
  let panelError = params.error;
  if (params.factura) {
    try {
      panel = await invoicePanel(database, session.actor, params.factura);
    } catch (error) {
      if (!isAppError(error)) throw error;
      panel = null;
      panelError = error.message;
    }
  }
  const nextParams = new URLSearchParams();
  if (params.parte) nextParams.set("parte", params.parte);
  if (params.factura) nextParams.set("factura", params.factura);
  const next = `/por-pagar${nextParams.size ? `?${nextParams}` : ""}`;
  const indexHref = "/por-pagar";
  const paid = fixed.rows.filter((row) => row.status === "pagado").length;
  const pin = {
    id: "gastos-fijos",
    name: "Gastos fijos",
    totalCents: fixed.summary.totalCents,
    detail: `${paid} de ${fixed.rows.length} pagados este mes`,
    href: "/por-pagar?parte=gastos-fijos",
  };
  const extra = fixed.summary.overdueCents > 0
    ? [{ title: "Gastos fijos vencidos", detail: formatUsd(fixed.summary.overdueCents), href: pin.href }]
    : [];
  return (
    <div className={panel ? "grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]" : ""}>
      <section>
        {panelError && !panel ? <p className="mb-3 text-sm text-red-700" data-testid="server-error">{panelError}</p> : null}
        {fixedSelected ? (
          <div className="space-y-3">
            <Link href={indexHref} className="text-sm text-primary">Todas las facturas</Link>
            <h2 className="text-lg font-semibold">Gastos fijos · {monthName(fixed.period)}</h2>
            <FixedChecklist
              monthLabel={monthName(fixed.period)}
              referenceDay={fixed.referenceDay}
              rows={fixed.rows}
              accounts={fixed.accounts}
              categories={fixed.categories}
            />
          </div>
        ) : folder ? (
          <div className="space-y-4">
            <Link href={indexHref} className="text-sm text-primary">Todas las facturas</Link>
            <PartyReport
              title="Proveedor"
              name={folder.name}
              totalCents={folder.totalCents}
              openCents={folder.openCents}
              matchedCount={folder.matchedCount}
              invoiceCount={folder.invoiceCount}
              movements={folder.invoices.flatMap((invoice) => (invoice.movement ? [invoice.movement] : []))}
            />
            <InvoiceList invoices={folder.invoices} base="/por-pagar" partyId={folder.partyId} activeId={params.factura} />
          </div>
        ) : (
          <InvoiceBoard
            title="Cuentas por pagar"
            subtitle="Facturas pendientes de pago y seguimiento de tus proveedores."
            partyNoun="Proveedor"
            partiesLabel="Proveedores"
            chartTitle="Facturado"
            today={todayKey()}
            base="/por-pagar"
            rows={folders.flatMap((item) =>
              item.invoices.map((invoice) => ({
                id: invoice.id,
                number: invoice.number,
                partyId: item.partyId,
                partyName: item.name,
                issuedOn: invoice.issuedOn,
                dueOn: invoice.dueOn,
                amountCents: invoice.amountCents,
                matched: invoice.status === "matched",
                approval: invoice.approval,
                followUpAt: invoice.followUpAt,
              } satisfies DeskRow)),
            )}
            folders={folders}
            pins={[pin]}
            activeId={params.factura}
            extraSuggestions={extra}
          />
        )}
      </section>
      {panel && panel.direction === "payable" && panel.companyId === session.companyId ? (
        <InvoicePanel panel={panel} closeHref={folder ? `/por-pagar?parte=${folder.partyId}` : indexHref} next={next} error={panelError} />
      ) : null}
    </div>
  );
}
