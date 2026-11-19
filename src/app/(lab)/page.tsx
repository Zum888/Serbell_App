import { redirect } from "next/navigation";
import { HomeScreen } from "@/components/home-screen";
import { StateView } from "@/components/state-view";
import { formatUsd } from "@/lib/money";
import { db } from "@/server/db";
import { pageContext } from "@/server/context";
import { companyReport, getHome } from "@/server/queries";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await pageContext();
  if (session.actor.firmRole) redirect("/firma");
  if (!session.companyId) {
    return <StateView variant="empty" title="Selecciona una empresa en la barra superior." />;
  }
  const { error } = await searchParams;
  const database = await db();
  const [home, report] = await Promise.all([
    getHome(database, session.actor, session.companyId),
    companyReport(database, session.actor, session.companyId),
  ]);
  const periodLabel = report.firstDay && report.lastDay ? `${report.firstDay} a ${report.lastDay}` : null;
  return (
    <div className="space-y-3">
      {error ? <StateView variant="error" title={error} testId="server-error" /> : null}
      <HomeScreen
        balanceCents={home.balanceCents}
        accountCount={home.accountCount}
        accounts={home.accounts.map((account) => ({ institution: account.institution, mask: account.mask }))}
        dailyNet={report.daily.map((point) => point.net)}
        netCents={report.net}
        outflowsCents={report.outflows}
        uncategorizedCount={report.uncategorizedCount}
        uncategorizedExpenseCents={report.uncategorizedExpenseCents}
        periodLabel={periodLabel}
      />
      <p className="sr-only">Saldo disponible {formatUsd(home.balanceCents)}</p>
    </div>
  );
}
