import { ChatShell } from "@/components/chat-shell";
import { todayKey } from "@/lib/aging";
import { DUPLICATE_IDS, DUPLICATE_PAIR } from "@/lib/duplicates";
import { homeStarts } from "@/lib/home-starts";
import type { Actor } from "@/lib/permissions";
import { buildPulse } from "@/lib/pulse";
import { loadBriefing } from "@/server/assistant";
import { db } from "@/server/db";
import { invoiceDesk } from "@/server/invoices";
import { monthHistory } from "@/server/planning";
import { companyReport } from "@/server/queries";

function monthWord(iso: string | null) {
  if (!iso) return "Este mes";
  const name = new Intl.DateTimeFormat("es-MX", { month: "long", timeZone: "UTC" }).format(new Date(`${iso.slice(0, 7)}-01T12:00:00.000Z`));
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export async function ChatFrame({ actor, companyId, children }: { actor: Actor; companyId: string; children: React.ReactNode }) {
  const database = await db();
  const today = todayKey();
  const soon = new Date(Date.parse(`${today}T12:00:00.000Z`) + 7 * 86_400_000).toISOString().slice(0, 10);
  const [briefing, report, receivable, payable, movements, duplicateCharges, history] = await Promise.all([
    loadBriefing(database, actor, companyId),
    companyReport(database, actor, companyId),
    invoiceDesk(database, actor, companyId, "receivable", today),
    invoiceDesk(database, actor, companyId, "payable", today),
    database.bankTransaction.findMany({
      where: { companyId },
      select: { reconciliationState: true, accountingState: true, documentState: true, amountCents: true },
    }),
    database.bankTransaction.count({ where: { companyId, id: { in: [...DUPLICATE_IDS] } } }),
    monthHistory(database, actor, companyId),
  ]);
  const month = report.lastDay?.slice(0, 7) ?? "";
  const prior = history.filter((row) => row.month < month).at(-1) ?? null;
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
  const openReceivable = receivable.folders.flatMap((folder) => folder.invoices).filter((invoice) => invoice.status === "open");
  const openPayable = payable.folders.flatMap((folder) => folder.invoices).filter((invoice) => invoice.status === "open");
  const overdue = receivable.folders
    .filter((folder) => folder.aging.d30 + folder.aging.d60 + folder.aging.d60plus > 0 && folder.openCents > 0)
    .sort((a, b) => b.openCents - a.openCents)[0] ?? null;
  const pulse = buildPulse({
    companyName: briefing.companyName,
    balanceCents: report.storedBalanceCents,
    monthLabel: monthWord(report.lastDay),
    priorBalanceCents: prior?.closingBalanceCents ?? null,
    receivableCents: receivable.summary.openCents,
    receivableCount: openReceivable.length,
    payableCents: payable.summary.openCents,
    payableCount: openPayable.length,
    payableSoon: openPayable.filter((invoice) => invoice.dueOn >= today && invoice.dueOn <= soon).length,
    duplicate: duplicateCharges >= 2 ? { merchant: DUPLICATE_PAIR[0].merchant, amount: DUPLICATE_PAIR[0].amount } : null,
    debtor: overdue ? { partyId: overdue.partyId, name: overdue.name, openCents: overdue.openCents } : null,
    reconciled: movements.filter((row) => row.reconciliationState === "Reconciled").length,
    categorized: movements.filter((row) => row.amountCents < 0 && row.accountingState !== "Uncategorized").length,
    linked: movements.filter((row) => row.documentState === "Linked").length,
    uncategorized: movements.filter((row) => row.amountCents < 0 && row.accountingState === "Uncategorized").length,
    inflows: report.inflows,
    outflows: report.outflows,
    net: report.net,
  });
  return (
    <ChatShell name={actor.name} briefing={briefing} starts={starts} pulse={pulse}>
      {children}
    </ChatShell>
  );
}
