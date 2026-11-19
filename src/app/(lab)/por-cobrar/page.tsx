import { InvoiceBoard, type DeskRow } from "@/components/invoice-board";
import { InvoiceList, InvoicePanel, PartyReport } from "@/components/invoice-desk";
import { StateView } from "@/components/state-view";
import { todayKey } from "@/lib/aging";
import { isAppError } from "@/lib/errors";
import { db } from "@/server/db";
import { pageContext } from "@/server/context";
import { invoiceDesk, invoicePanel } from "@/server/invoices";
import Link from "next/link";

export default async function ReceivablesPage({
  searchParams,
}: {
  searchParams: Promise<{ parte?: string; factura?: string; error?: string; vista?: string }>;
}) {
  const session = await pageContext();
  const params = await searchParams;
  if (!session.companyId) return <StateView variant="empty" title="Selecciona una empresa para ver sus facturas." />;
  const { folders } = await invoiceDesk((await db()), session.actor, session.companyId, "receivable");
  const folder = folders.find((item) => item.partyId === params.parte) ?? null;
  const list = params.vista === "lista";
  let panel = null;
  let panelError = params.error;
  if (params.factura) {
    try {
      panel = await invoicePanel((await db()), session.actor, params.factura);
    } catch (error) {
      if (!isAppError(error)) throw error;
      panel = null;
      panelError = error.message;
    }
  }
  const nextParams = new URLSearchParams();
  if (params.parte) nextParams.set("parte", params.parte);
  if (params.factura) nextParams.set("factura", params.factura);
  if (list) nextParams.set("vista", "lista");
  const next = `/por-cobrar${nextParams.size ? `?${nextParams}` : ""}`;
  const indexHref = "/por-cobrar";
  const rows = toRows(folders);
  return (
    <div className={panel ? "grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]" : ""}>
      <section>
        {panelError && !panel ? <p className="mb-3 text-sm text-red-700" data-testid="server-error">{panelError}</p> : null}
        {folder ? (
          <div className="space-y-4">
            <Link href={indexHref} className="text-sm text-primary">Todas las facturas</Link>
            <PartyReport
              title="Cliente"
              name={folder.name}
              totalCents={folder.totalCents}
              openCents={folder.openCents}
              matchedCount={folder.matchedCount}
              invoiceCount={folder.invoiceCount}
              movements={folder.invoices.flatMap((invoice) => (invoice.movement ? [invoice.movement] : []))}
            />
            <InvoiceList invoices={folder.invoices} base="/por-cobrar" partyId={folder.partyId} activeId={params.factura} />
          </div>
        ) : (
          <InvoiceBoard
            title="Cuentas por cobrar"
            subtitle="Facturas pendientes de cobro y seguimiento de tus clientes."
            partyNoun="Cliente"
            partiesLabel="Clientes"
            chartTitle="Facturado"
            today={todayKey()}
            base="/por-cobrar"
            rows={rows}
            folders={folders}
            activeId={params.factura}
          />
        )}
      </section>
      {panel && panel.direction === "receivable" && panel.companyId === session.companyId ? (
        <InvoicePanel panel={panel} closeHref={folder ? `/por-cobrar?parte=${folder.partyId}` : indexHref} next={next} error={panelError} />
      ) : null}
    </div>
  );
}

function toRows(folders: { partyId: string; name: string; invoices: { id: string; number: string; issuedOn: string; dueOn: string; amountCents: number; status: string; approval: DeskRow["approval"]; followUpAt: string | null }[] }[]): DeskRow[] {
  return folders.flatMap((folder) =>
    folder.invoices.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      partyId: folder.partyId,
      partyName: folder.name,
      issuedOn: invoice.issuedOn,
      dueOn: invoice.dueOn,
      amountCents: invoice.amountCents,
      matched: invoice.status === "matched",
      approval: invoice.approval,
      followUpAt: invoice.followUpAt,
    })),
  );
}
