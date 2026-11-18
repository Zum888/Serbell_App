import { FixedChecklist } from "@/components/fixed-checklist";
import { DeskTotals, InvoiceFolders, InvoiceList, InvoicePanel } from "@/components/invoice-desk";
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
  searchParams: Promise<{ parte?: string; factura?: string; error?: string }>;
}) {
  const session = await pageContext();
  const params = await searchParams;
  if (!session.companyId) return <StateView variant="empty" title="Selecciona una empresa para ver sus facturas." />;
  const company = session.companies.find((item) => item.id === session.companyId);
  const [{ folders, summary }, fixed] = await Promise.all([
    invoiceDesk(db(), session.actor, session.companyId, "payable"),
    fixedChecklist(db(), session.actor, session.companyId),
  ]);
  const folder = folders.find((item) => item.partyId === params.parte) ?? null;
  let panel = null;
  let panelError = params.error;
  if (params.factura) {
    try {
      panel = await invoicePanel(db(), session.actor, params.factura);
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
  return (
    <div className={panel ? "grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]" : ""}>
      <section>
        <p className="text-xs text-slate-500">{company?.name}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Por pagar</h1>
        <p className="mt-1 text-sm text-slate-500">
          Tus gastos fijos del mes y las carpetas de proveedores con facturas de demostración. Vincular una factura anota el movimiento del banco; no paga.
        </p>
        {!folder ? (
          <div className="mt-4">
            <FixedChecklist
              monthLabel={monthName(fixed.period)}
              referenceDay={fixed.referenceDay}
              rows={fixed.rows}
              accounts={fixed.accounts}
              categories={fixed.categories}
            />
          </div>
        ) : null}
        <div className="mt-4"><DeskTotals summary={summary} label="Facturas por pagar" /></div>
        {panelError && !panel ? <p className="mt-3 text-sm text-red-700" data-testid="server-error">{panelError}</p> : null}
        {folder ? (
          <div className="mt-4">
            <Link href="/por-pagar" className="text-sm text-primary">Todas las carpetas</Link>
            <h2 className="mt-2 text-lg font-semibold">{folder.name}</h2>
            <div className="mt-3">
              <InvoiceList invoices={folder.invoices} base="/por-pagar" partyId={folder.partyId} activeId={params.factura} />
            </div>
          </div>
        ) : folders.length === 0 ? (
          <div className="mt-4">
            <StateView variant="empty" title="No hay facturas por pagar en esta empresa." />
          </div>
        ) : (
          <div className="mt-4">
            <InvoiceFolders folders={folders} base="/por-pagar" />
          </div>
        )}
      </section>
      {panel && panel.direction === "payable" && panel.companyId === session.companyId ? (
        <InvoicePanel panel={panel} closeHref={folder ? `/por-pagar?parte=${folder.partyId}` : "/por-pagar"} next={next} error={panelError} />
      ) : null}
    </div>
  );
}
