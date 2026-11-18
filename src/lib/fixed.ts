export type FixedStatus = "pagado" | "pendiente" | "vencido";

export type FixedCandidate = { id: string; day: string; merchant: string; amountCents: number };

export const FIXED_TOLERANCE = 0.15;

export function findFixedPayment(
  expense: { matchHint: string; amountCents: number },
  period: string,
  movements: FixedCandidate[],
): FixedCandidate | null {
  const hint = expense.matchHint.trim().toLowerCase();
  if (!hint) return null;
  const limit = Math.round(expense.amountCents * FIXED_TOLERANCE);
  return (
    movements.find((movement) => {
      if (!movement.day.startsWith(period) || movement.amountCents >= 0) return false;
      if (!movement.merchant.toLowerCase().includes(hint)) return false;
      return Math.abs(Math.abs(movement.amountCents) - expense.amountCents) <= limit;
    }) ?? null
  );
}

export function fixedStatus(input: { paid: boolean; dueDay: number; referenceDay: number }): FixedStatus {
  if (input.paid) return "pagado";
  return input.dueDay < input.referenceDay ? "vencido" : "pendiente";
}

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function monthName(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const name = MONTHS[(month ?? 1) - 1] ?? "";
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
}

export function shortMonth(period: string): string {
  const month = Number(period.split("-")[1] ?? 1);
  return (MONTHS[month - 1] ?? "").slice(0, 3);
}
