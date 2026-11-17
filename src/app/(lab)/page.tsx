import { redirect } from "next/navigation";
import { HomeScreen } from "@/components/home-screen";
import { StateView } from "@/components/state-view";
import { formatUsd } from "@/lib/money";
import { db } from "@/server/db";
import { pageContext } from "@/server/context";
import { reportReading } from "@/lib/reading";
import { companyReport, detectedDuplicates, getHome } from "@/server/queries";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await pageContext();
  if (session.actor.firmRole) redirect("/firma");
  if (!session.companyId) {
    return <StateView variant="empty" title="Selecciona una empresa en la barra superior." />;
  }
  const { error } = await searchParams;
  const [home, duplicates, report] = await Promise.all([
    getHome(db(), session.actor, session.companyId),
    detectedDuplicates(db(), session.actor, session.companyId),
    companyReport(db(), session.actor, session.companyId),
  ]);
  const reading = reportReading({ ...report, accountCount: report.accounts.length }).slice(0, 3);
  const periodLabel = report.firstDay && report.lastDay ? `${report.firstDay} a ${report.lastDay}` : null;
  return (
    <div className="space-y-3">
      {error ? <StateView variant="error" title={error} testId="server-error" /> : null}
      <HomeScreen
        name={session.actor.name}
        companyId={home.company.id}
        balanceCents={home.balanceCents}
        accountCount={home.accountCount}
        accounts={home.accounts.map((account) => ({ institution: account.institution, mask: account.mask }))}
        duplicates={duplicates}
        reading={reading}
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
