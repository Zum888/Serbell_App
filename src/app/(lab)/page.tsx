import { redirect } from "next/navigation";
import { HomeScreen } from "@/components/home-screen";
import { StateView } from "@/components/state-view";
import { homeStarts } from "@/lib/home-starts";
import { formatUsd } from "@/lib/money";
import { db } from "@/server/db";
import { pageContext } from "@/server/context";
import { loadBriefing } from "@/server/assistant";
import { companyReport, getHome } from "@/server/queries";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await pageContext();
  if (session.actor.firmRole) redirect("/firma");
  if (!session.companyId) {
    return <StateView variant="empty" title="Selecciona una empresa en la barra superior." />;
  }
  const { error } = await searchParams;
  const database = await db();
  const [home, report, briefing] = await Promise.all([
    getHome(database, session.actor, session.companyId),
    companyReport(database, session.actor, session.companyId),
    loadBriefing(database, session.actor, session.companyId),
  ]);
  const openDebtors = briefing.debtors.filter((debtor) => debtor.openCents > 0);
  const topDebtor = openDebtors[0] ?? null;
  const largest = report.largestExpenses[0] ?? null;
  const starts = homeStarts({
    uncategorizedCount: briefing.uncategorizedCount,
    uncategorizedExpenseCents: briefing.uncategorizedExpenseCents,
    missingReceipts: briefing.missingReceipts,
    needsReview: briefing.needsReview,
    duplicates: report.duplicates.map((row) => ({ id: row.id, fileName: row.fileName, merchant: row.merchant })),
    debtor: topDebtor ? { partyId: topDebtor.partyId, name: topDebtor.name, openCents: topDebtor.openCents, others: Math.max(0, openDebtors.length - 1) } : null,
    largestExpense: largest ? { id: largest.id, merchant: largest.merchant, amountCents: largest.amountCents } : null,
  });
  const periodLabel = report.firstDay && report.lastDay ? `${report.firstDay} a ${report.lastDay}` : null;
  return (
    <div className="space-y-3">
      {error ? <StateView variant="error" title={error} testId="server-error" /> : null}
      <HomeScreen
        name={session.actor.name}
        balanceCents={home.balanceCents}
        accountCount={home.accountCount}
        accounts={home.accounts.map((account) => ({ institution: account.institution, mask: account.mask }))}
        dailyNet={report.daily.map((point) => point.net)}
        netCents={report.net}
        outflowsCents={report.outflows}
        uncategorizedCount={report.uncategorizedCount}
        uncategorizedExpenseCents={report.uncategorizedExpenseCents}
        periodLabel={periodLabel}
        briefing={briefing}
        starts={starts}
      />
      <p className="sr-only">Saldo disponible {formatUsd(home.balanceCents)}</p>
    </div>
  );
}
