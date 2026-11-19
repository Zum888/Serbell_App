import { dayKey, formatDay } from "@/lib/dates";
import type { Briefing } from "@/lib/briefing";
import type { Actor } from "@/lib/permissions";
import type { Db } from "@/server/db";
import { invoiceDesk } from "@/server/invoices";

export async function loadBriefing(db: Db, actor: Actor, companyId: string): Promise<Briefing> {
  const [company, transactions, duplicates, desk] = await Promise.all([
    db.company.findUnique({ where: { id: companyId } }),
    db.bankTransaction.findMany({
      where: { companyId },
      include: { classification: { include: { category: true } } },
      orderBy: [{ postedOn: "desc" }, { merchant: "asc" }],
    }),
    db.document.findMany({
      where: { companyId, duplicateOfId: { not: null } },
      include: { extraction: true },
      orderBy: { createdAt: "desc" },
    }),
    invoiceDesk(db, actor, companyId, "receivable"),
  ]);

  let inflows = 0;
  let outflows = 0;
  let uncategorizedCount = 0;
  let uncategorizedExpenseCents = 0;
  let missingReceipts = 0;
  let needsReview = 0;
  const byCategory = new Map<string, number>();
  for (const row of transactions) {
    if (row.amountCents > 0) inflows += row.amountCents;
    else if (row.amountCents < 0) outflows += Math.abs(row.amountCents);
    if (row.documentState === "Missing") missingReceipts += 1;
    if (row.reviewState === "NeedsReview") needsReview += 1;
    const uncategorized = row.accountingState === "Uncategorized" || !row.classification;
    if (uncategorized) {
      uncategorizedCount += 1;
      if (row.amountCents < 0) uncategorizedExpenseCents += Math.abs(row.amountCents);
    }
    if (row.amountCents < 0) {
      const name = row.classification?.category?.name ?? "Sin categoría";
      byCategory.set(name, (byCategory.get(name) ?? 0) + Math.abs(row.amountCents));
    }
  }

  return {
    companyName: company?.name ?? "la empresa",
    inflows,
    outflows,
    net: inflows - outflows,
    uncategorizedCount,
    uncategorizedExpenseCents,
    missingReceipts,
    needsReview,
    categories: [...byCategory.entries()]
      .map(([name, totalCents]) => ({ name, totalCents }))
      .sort((a, b) => b.totalCents - a.totalCents || a.name.localeCompare(b.name, "es")),
    duplicates: duplicates.map((row) => ({
      fileName: row.fileName,
      merchant: row.extraction?.merchant ?? null,
      amountCents: row.extraction?.amountCents ?? null,
    })),
    debtors: desk.folders
      .map((folder) => ({ partyId: folder.partyId, name: folder.name, openCents: folder.openCents, invoiceCount: folder.invoiceCount }))
      .sort((a, b) => b.openCents - a.openCents || a.name.localeCompare(b.name, "es")),
    movements: transactions.slice(0, 4).map((row) => ({
      merchant: row.merchant,
      postedOn: formatDay(dayKey(row.postedOn)),
      amountCents: row.amountCents,
      category: row.classification?.category?.name ?? "Sin categoría",
    })),
  };
}
