import { ReportScreen } from "@/components/report-screen";
import { StateView } from "@/components/state-view";
import { db } from "@/server/db";
import { pageContext } from "@/server/context";
import { invoiceDesk } from "@/server/invoices";
import { fixedChecklist, monthHistory } from "@/server/planning";
import { companyReport } from "@/server/queries";

export default async function ReportsPage() {
  const session = await pageContext();
  if (!session.companyId) return <StateView variant="empty" title="Selecciona una empresa para ver el reporte." />;
  const database = await db();
  const [report, history, fixed, receivable, payable] = await Promise.all([
    companyReport(database, session.actor, session.companyId),
    monthHistory(database, session.actor, session.companyId),
    fixedChecklist(database, session.actor, session.companyId),
    invoiceDesk(database, session.actor, session.companyId, "receivable"),
    invoiceDesk(database, session.actor, session.companyId, "payable"),
  ]);
  const company = session.companies.find((item) => item.id === session.companyId);
  return (
    <ReportScreen
      companyName={company?.name ?? "Empresa"}
      report={report}
      history={history}
      fixed={{
        pendingCents: fixed.summary.pendingCents,
        overdueCents: fixed.summary.overdueCents,
        overdueCount: fixed.rows.filter((row) => row.status === "vencido").length,
      }}
      receivable={deskTotals(receivable.summary)}
      payable={deskTotals(payable.summary)}
    />
  );
}

function deskTotals(summary: { totalCents: number; openCents: number; matchedCents: number; invoiceCount: number }) {
  return {
    totalCents: summary.totalCents,
    openCents: summary.openCents,
    matchedCents: summary.matchedCents,
    invoiceCount: summary.invoiceCount,
  };
}
