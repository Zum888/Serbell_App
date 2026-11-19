import { FixedChecklist } from "@/components/fixed-checklist";
import { DeskTotals, InvoiceFolders, InvoiceList, InvoicePanel, InvoiceTable, PartyReport } from "@/components/invoice-desk";
import { monthName } from "@/lib/fixed";
import { fixedChecklist } from "@/server/planning";
import { StateView } from "@/components/state-view";
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
  const company = session.companies.find((item) => item.id === session.companyId);
  const database = await db();
  const [{ folders, summary }, fixed] = await Promise.all([
    invoiceDesk(database, session.actor, session.companyId, "payable"),
    fixedChecklist(database, session.actor, session.companyId),
  ]);
  const fixedSelected = params.parte === "gastos-fijos";
  const folder = folders.find((item) => item.partyId === params.parte) ?? null;
  const list = params.vista === "lista";
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
  if (list) nextParams.set("vista", "lista");
  const next = `/por-pagar${nextParams.size ? `?${nextParams}` : ""}`;
  const indexHref = list ? "/por-pagar?vista=lista" : "/por-pagar";
  const paid = fixed.rows.filter((row) => row.status === "pagado").length;
  const pin = {
    id: "gastos-fijos",
    name: "Gastos fijos",
    totalCents: fixed.summary.totalCents,
    detail: `${paid} de ${fixed.rows.length} pagados este mes`,
    href: `/por-pagar?parte=gastos-fijos${list ? "&vista=lista" : ""}`,
  };
  return (
    <div className={panel ? "grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]" : ""}>
      <section>
        <p className="text-xs text-slate-500">{company?.name}</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Por pagar</h1>
          <div className="flex rounded-full border border-border bg-white p-1 text-xs">
            <Link href="/por-pagar" className={!list ? "rounded-full bg-slate-900 px-3 py-1.5 text-white" : "rounded-full px-3 py-1.5 text-slate-600"}>Carpetas</Link>
            <Link href="/por-pagar?vista=lista" className={list ? "rounded-full bg-slate-900 px-3 py-1.5 text-white" : "rounded-full px-3 py-1.5 text-slate-600"}>Lista</Link>
          </div>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Gastos fijos es una carpeta más. Elige un proveedor para ver sus facturas y los movimientos ligados.
        </p>
        <div className="mt-4"><DeskTotals summary={summary} label="Facturas por pagar" /></div>
        {panelError && !panel ? <p className="mt-3 text-sm text-red-700" data-testid="server-error">{panelError}</p> : null}
        {fixedSelected ? (
          <div className="mt-4 space-y-3">
            <Link href={indexHref} className="text-sm text-primary">Todas las carpetas</Link>
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
          <div className="mt-4 space-y-4">
            <Link href={indexHref} className="text-sm text-primary">Todas las carpetas</Link>
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
        ) : folders.length === 0 && fixed.rows.length === 0 ? (
          <div className="mt-4">
            <StateView variant="empty" title="No hay facturas por pagar en esta empresa." />
          </div>
        ) : list ? (
          <div className="mt-4">
            <InvoiceTable
              base="/por-pagar"
              pin={{ name: pin.name, href: pin.href, detail: pin.detail, amountCents: pin.totalCents }}
              rows={folders.flatMap((item) => item.invoices.map((invoice) => ({ ...invoice, partyId: item.partyId, partyName: item.name })))}
            />
          </div>
        ) : (
          <div className="mt-4">
            <InvoiceFolders folders={folders} base="/por-pagar" pins={[pin]} />
          </div>
        )}
      </section>
      {panel && panel.direction === "payable" && panel.companyId === session.companyId ? (
        <InvoicePanel panel={panel} closeHref={folder ? `/por-pagar?parte=${folder.partyId}${list ? "&vista=lista" : ""}` : indexHref} next={next} error={panelError} />
      ) : null}
    </div>
  );
}
