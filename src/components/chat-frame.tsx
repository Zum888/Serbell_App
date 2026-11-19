import { ChatShell } from "@/components/chat-shell";
import { homeStarts } from "@/lib/home-starts";
import type { Actor } from "@/lib/permissions";
import { loadBriefing } from "@/server/assistant";
import { db } from "@/server/db";
import { companyReport } from "@/server/queries";

export async function ChatFrame({ actor, companyId, children }: { actor: Actor; companyId: string; children: React.ReactNode }) {
  const database = await db();
  const [briefing, report] = await Promise.all([
    loadBriefing(database, actor, companyId),
    companyReport(database, actor, companyId),
  ]);
  const openDebtors = briefing.debtors.filter((debtor) => debtor.openCents > 0);
  const topDebtor = openDebtors[0] ?? null;
  const largest = report.largestExpenses[0] ?? null;
  const starts = homeStarts({
    uncategorizedCount: briefing.uncategorizedCount,
    uncategorizedExpenseCents: briefing.uncategorizedExpenseCents,
    missingReceipts: briefing.missingReceipts,
    needsReview: briefing.needsReview,
    duplicates: briefing.duplicates.map((row) => ({ id: row.id, fileName: row.fileName, merchant: row.merchant })),
    debtor: topDebtor ? { partyId: topDebtor.partyId, name: topDebtor.name, openCents: topDebtor.openCents, others: Math.max(0, openDebtors.length - 1) } : null,
    largestExpense: largest ? { id: largest.id, merchant: largest.merchant, amountCents: largest.amountCents } : null,
  });
  return (
    <ChatShell name={actor.name} briefing={briefing} starts={starts}>
      {children}
    </ChatShell>
  );
}
