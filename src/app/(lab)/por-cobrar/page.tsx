import { DeskTotals, InvoiceFolders, InvoiceList, InvoicePanel, InvoiceTable, PartyReport } from "@/components/invoice-desk";
import { StateView } from "@/components/state-view";
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
  const company = session.companies.find((item) => item.id === session.companyId);
  const { folders, summary } = await invoiceDesk((await db()), session.actor, session.companyId, "receivable");
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
  const indexHref = list ? "/por-cobrar?vista=lista" : "/por-cobrar";
  return (
    <div className={panel ? "grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]" : ""}>
      <section>
        <p className="text-xs text-slate-500">{company?.name}</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Por cobrar</h1>
          <ViewToggle list={list} base="/por-cobrar" />
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Elige un cliente para ver sus ventas y los movimientos ligados. Vincular una factura anota el banco; no cobra.
        </p>
        <div className="mt-4"><DeskTotals summary={summary} label="Total por cobrar" /></div>
        {panelError && !panel ? <p className="mt-3 text-sm text-red-700" data-testid="server-error">{panelError}</p> : null}
        {folder ? (
          <div className="mt-4 space-y-4">
            <Link href={indexHref} className="text-sm text-primary">Todas las carpetas</Link>
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
        ) : folders.length === 0 ? (
          <div className="mt-4">
            <StateView variant="empty" title="No hay facturas por cobrar en esta empresa." />
          </div>
        ) : list ? (
          <div className="mt-4">
            <InvoiceTable
              base="/por-cobrar"
              rows={folders.flatMap((item) => item.invoices.map((invoice) => ({ ...invoice, partyId: item.partyId, partyName: item.name })))}
            />
          </div>
        ) : (
          <div className="mt-4">
            <InvoiceFolders folders={folders} base="/por-cobrar" />
          </div>
        )}
      </section>
      {panel && panel.direction === "receivable" && panel.companyId === session.companyId ? (
        <InvoicePanel panel={panel} closeHref={folder ? `/por-cobrar?parte=${folder.partyId}${list ? "&vista=lista" : ""}` : indexHref} next={next} error={panelError} />
      ) : null}
    </div>
  );
}

function ViewToggle({ list, base }: { list: boolean; base: string }) {
  return (
    <div className="flex rounded-full border border-border bg-white p-1 text-xs">
      <Link href={base} className={!list ? "rounded-full bg-slate-900 px-3 py-1.5 text-white" : "rounded-full px-3 py-1.5 text-slate-600"}>
        Carpetas
      </Link>
      <Link href={`${base}?vista=lista`} className={list ? "rounded-full bg-slate-900 px-3 py-1.5 text-white" : "rounded-full px-3 py-1.5 text-slate-600"}>
        Lista
      </Link>
    </div>
  );
}
