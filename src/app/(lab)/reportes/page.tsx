import { ReportScreen } from "@/components/report-screen";
import { StateView } from "@/components/state-view";
import { db } from "@/server/db";
import { pageContext } from "@/server/context";
import { fixedChecklist, monthHistory } from "@/server/planning";
import { companyReport } from "@/server/queries";

export default async function ReportsPage() {
  const session = await pageContext();
  if (!session.companyId) return <StateView variant="empty" title="Selecciona una empresa para ver el reporte." />;
  const [report, history, fixed] = await Promise.all([
    companyReport((await db()), session.actor, session.companyId),
    monthHistory((await db()), session.actor, session.companyId),
    fixedChecklist((await db()), session.actor, session.companyId),
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
    />
  );
}
