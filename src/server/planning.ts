import { dayKey } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { findFixedPayment, fixedStatus, type FixedStatus } from "@/lib/fixed";
import { assertCompanyAccess, type Actor } from "@/lib/permissions";
import type { Db } from "@/server/db";
import { nid } from "@/server/ids";

export type FixedRowView = {
  id: string;
  name: string;
  vendor: string;
  amountCents: number;
  dueDay: number;
  status: FixedStatus;
  source: "banco" | "manual" | null;
  accountLabel: string | null;
  categoryLabel: string | null;
  movement: { id: string; day: string; merchant: string; amountCents: number } | null;
};

async function currentPeriod(db: Db, companyId: string) {
  const latest = await db.bankTransaction.findFirst({ where: { companyId }, orderBy: { postedOn: "desc" } });
  const day = dayKey(latest?.postedOn ?? new Date()) ?? new Date().toISOString().slice(0, 10);
  return { period: day.slice(0, 7), referenceDay: Number(day.slice(8, 10)) };
}

export async function fixedChecklist(db: Db, actor: Actor, companyId: string) {
  assertCompanyAccess(actor, companyId);
  const { period, referenceDay } = await currentPeriod(db, companyId);
  const [expenses, accounts, categories, transactions] = await Promise.all([
    db.fixedExpense.findMany({
      where: { companyId },
      include: { payments: { where: { period } } },
      orderBy: [{ dueDay: "asc" }, { name: "asc" }],
    }),
    db.bankAccount.findMany({ where: { companyId }, orderBy: [{ institution: "asc" }, { mask: "asc" }] }),
    db.accountingCategory.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
    db.bankTransaction.findMany({
      where: { companyId, amountCents: { lt: 0 } },
      orderBy: [{ postedOn: "asc" }, { id: "asc" }],
    }),
  ]);
  const movements = transactions.map((row) => ({
    id: row.id,
    day: dayKey(row.postedOn) ?? "",
    merchant: row.merchant,
    amountCents: row.amountCents,
  }));
  const accountLabel = (id: string | null) => {
    const account = accounts.find((item) => item.id === id);
    return account ? `${account.institution} ····${account.mask}` : null;
  };
  const categoryLabel = (id: string | null) => {
    const sub = categories.find((item) => item.id === id);
    if (!sub) return null;
    const parent = categories.find((item) => item.id === sub.parentId);
    return parent ? `${parent.name} › ${sub.name}` : sub.name;
  };
  const rows: FixedRowView[] = expenses.map((expense) => {
    const movement = findFixedPayment(expense, period, movements);
    const manual = expense.payments.length > 0;
    const paid = Boolean(movement) || manual;
    return {
      id: expense.id,
      name: expense.name,
      vendor: expense.vendor,
      amountCents: expense.amountCents,
      dueDay: expense.dueDay,
      status: fixedStatus({ paid, dueDay: expense.dueDay, referenceDay }),
      source: movement ? "banco" : manual ? "manual" : null,
      accountLabel: accountLabel(expense.accountId),
      categoryLabel: categoryLabel(expense.subcategoryId),
      movement,
    };
  });
  const totalCents = rows.reduce((sum, row) => sum + row.amountCents, 0);
  const paidCents = rows.filter((row) => row.status === "pagado").reduce((sum, row) => sum + row.amountCents, 0);
  const overdueCents = rows.filter((row) => row.status === "vencido").reduce((sum, row) => sum + row.amountCents, 0);
  return {
    period,
    referenceDay,
    rows,
    summary: { totalCents, paidCents, pendingCents: totalCents - paidCents, overdueCents },
    accounts: accounts.map((account) => ({ id: account.id, label: `${account.institution} ····${account.mask}` })),
    categories: categories
      .filter((category) => category.parentId)
      .map((category) => ({ id: category.id, label: categoryLabel(category.id) ?? category.name }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  };
}

export async function setFixedPaid(db: Db, actor: Actor, fixedExpenseId: string, paid: boolean) {
  const expense = await db.fixedExpense.findUnique({ where: { id: fixedExpenseId } });
  if (!expense) throw new AppError("Ese gasto fijo no existe.", 404, "FIXED_NOT_FOUND");
  assertCompanyAccess(actor, expense.companyId);
  const { period } = await currentPeriod(db, expense.companyId);
  if (paid) {
    await db.fixedExpensePayment.upsert({
      where: { fixedExpenseId_period: { fixedExpenseId, period } },
      create: { id: nid("fxp"), fixedExpenseId, period, actorId: actor.id },
      update: {},
    });
  } else {
    await db.fixedExpensePayment.deleteMany({ where: { fixedExpenseId, period } });
  }
}

export async function createFixedExpense(
  db: Db,
  actor: Actor,
  companyId: string,
  input: { name: string; vendor: string; amountCents: number; dueDay: number; accountId: string; subcategoryId: string },
) {
  assertCompanyAccess(actor, companyId);
  const name = input.name.trim();
  const vendor = input.vendor.trim();
  if (name.length < 2 || name.length > 80) throw new AppError("Escribe el nombre del gasto.", 400, "NAME_REQUIRED");
  if (vendor.length < 2 || vendor.length > 80) throw new AppError("Escribe a quién se le paga.", 400, "VENDOR_REQUIRED");
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new AppError("El monto tiene que ser mayor a cero.", 400, "AMOUNT_INVALID");
  }
  if (!Number.isInteger(input.dueDay) || input.dueDay < 1 || input.dueDay > 31) {
    throw new AppError("El día de pago va del 1 al 31.", 400, "DAY_INVALID");
  }
  const account = input.accountId
    ? await db.bankAccount.findFirst({ where: { id: input.accountId, companyId } })
    : null;
  if (input.accountId && !account) throw new AppError("Esa cuenta no es de esta empresa.", 400, "ACCOUNT_INVALID");
  const sub = input.subcategoryId
    ? await db.accountingCategory.findFirst({ where: { id: input.subcategoryId, companyId, parentId: { not: null } } })
    : null;
  if (input.subcategoryId && !sub) throw new AppError("Esa categoría no es de esta empresa.", 400, "CATEGORY_INVALID");
  const id = nid("fx");
  await db.fixedExpense.create({
    data: {
      id,
      companyId,
      name,
      vendor,
      matchHint: vendor.toLowerCase(),
      amountCents: input.amountCents,
      dueDay: input.dueDay,
      accountId: account?.id ?? null,
      subcategoryId: sub?.id ?? null,
      isDemonstration: false,
    },
  });
  return id;
}

export async function monthHistory(db: Db, actor: Actor, companyId: string) {
  assertCompanyAccess(actor, companyId);
  const rows = await db.monthSnapshot.findMany({ where: { companyId }, orderBy: { month: "asc" } });
  return rows.map((row) => ({
    month: row.month,
    inflows: row.inflowsCents,
    outflows: row.outflowsCents,
    net: row.inflowsCents - row.outflowsCents,
    closingBalanceCents: row.closingBalanceCents,
    categories: JSON.parse(row.categoriesJson) as { category: string; totalCents: number }[],
    isDemonstration: row.isDemonstration,
  }));
}
