import { formatDay } from "@/lib/dates";
import { formatUsd } from "@/lib/money";

type Expense = {
  merchant: string;
  postedOn: string;
  amountCents: number;
  isDemonstration: boolean;
};

type Period = { from: string; to: string; outflows: number; net: number };

export type ReadingReport = {
  count: number;
  outflows: number;
  net: number;
  inflows: number;
  firstDay: string | null;
  early: Period | null;
  late: Period | null;
  largestExpenses: Expense[];
  categories: { category: string; totalCents: number }[];
  uncategorizedCount: number;
  uncategorizedExpenseCents: number;
  duplicates: { fileName: string; originalName: string | null }[];
  demonstrationAccountCount: number;
  storedBalanceCents: number;
  accountCount: number;
};

export function reportReading(report: ReadingReport): string[] {
  if (report.count === 0) return ["No hay movimientos guardados para esta empresa."];
  const lines = [changeLine(report), expenseLine(report), uncategorizedLine(report), duplicateLine(report.duplicates)];
  return lines.filter((line): line is string => Boolean(line));
}

export function expenseReading(report: ReadingReport): string[] {
  if (report.outflows === 0) return ["No hay gastos en los movimientos guardados."];
  const leader = report.categories[0];
  return [
    expenseLine(report),
    leader ? `${leader.category} concentra ${formatUsd(leader.totalCents)} de esos gastos.` : "",
    uncategorizedLine(report),
  ].filter(Boolean);
}

export function inflowReading(report: Pick<ReadingReport, "inflows" | "count"> & { inflowCount: number; largestMerchant: string | null; largestCents: number }): string[] {
  if (report.inflowCount === 0) return ["No hay ingresos en los movimientos guardados. No hay facturas abiertas."];
  const largest = report.largestMerchant ? ` El mayor es ${report.largestMerchant} por ${formatUsd(report.largestCents)}.` : "";
  return [
    `Entraron ${formatUsd(report.inflows)} en ${report.inflowCount} movimientos que ya están en el banco.${largest}`,
    "No hay facturas abiertas ni vencidas en la base. Esto no registra un cobro nuevo.",
  ];
}

export function accountReading(report: Pick<ReadingReport, "storedBalanceCents" | "net" | "demonstrationAccountCount" | "accountCount">): string[] {
  const demo = report.demonstrationAccountCount === 0
    ? "Ninguna está marcada como demostración."
    : report.demonstrationAccountCount === 1
      ? "1 está marcada como demostración."
      : `${report.demonstrationAccountCount} están marcadas como demostración.`;
  return [
    `${report.accountCount} cuentas. El saldo disponible guardado suma ${formatUsd(report.storedBalanceCents)}. ${demo}`,
    `El neto de sus movimientos es ${formatUsd(report.net)}. Ese neto no reemplaza el saldo guardado en cada cuenta.`,
  ];
}

function changeLine(report: ReadingReport): string {
  if (report.early && report.late) {
    const direction = report.late.outflows > report.early.outflows ? "subieron" : report.late.outflows < report.early.outflows ? "bajaron" : "se mantuvieron";
    return `Del ${formatDay(report.early.from)} al ${formatDay(report.early.to)} el neto fue ${formatUsd(report.early.net)}. Del ${formatDay(report.late.from)} al ${formatDay(report.late.to)} el neto fue ${formatUsd(report.late.net)}. Los gastos ${direction} de ${formatUsd(report.early.outflows)} a ${formatUsd(report.late.outflows)}.`;
  }
  if (report.firstDay) {
    return `Todos los movimientos guardados son del ${formatDay(report.firstDay)}. No hay un periodo anterior en la base para comparar.`;
  }
  return "";
}

function expenseLine(report: ReadingReport): string {
  const top = report.largestExpenses[0];
  if (!top) return `Los gastos suman ${formatUsd(report.outflows)}.`;
  const where = top.isDemonstration ? " El movimiento está en una cuenta de demostración." : "";
  return `Los gastos suman ${formatUsd(report.outflows)}. El mayor es ${top.merchant} por ${formatUsd(Math.abs(top.amountCents))} el ${top.postedOn}.${where}`;
}

function uncategorizedLine(report: ReadingReport): string {
  if (report.uncategorizedCount === 0) return "No hay movimientos sin categoría.";
  return `Hay ${report.uncategorizedCount} movimientos sin categoría. Sus gastos suman ${formatUsd(report.uncategorizedExpenseCents)}.`;
}

function duplicateLine(duplicates: ReadingReport["duplicates"]): string {
  if (duplicates.length === 0) return "No hay comprobantes duplicados.";
  const first = duplicates[0];
  const copy = first.originalName ? ` ${first.fileName} es copia de ${first.originalName}.` : "";
  const noun = duplicates.length === 1 ? "comprobante duplicado" : "comprobantes duplicados";
  return `Hay ${duplicates.length} ${noun}.${copy}`;
}
