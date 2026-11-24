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

export type FixedKind = "renta" | "luz" | "internet" | "nomina" | "seguro" | "equipo" | "honorarios" | "otro";

const KIND_RULES: { key: FixedKind; label: string; test: RegExp }[] = [
  { key: "luz", label: "Luz", test: /luz|electric|energia|fpl/ },
  { key: "internet", label: "Internet", test: /internet|verizon|wifi|telefono|godaddy|dominio|pagina web/ },
  { key: "nomina", label: "Nómina", test: /nomina|payroll|\bgusto\b|\badp\b/ },
  { key: "seguro", label: "Seguro", test: /seguro|insurance|state farm|liberty/ },
  { key: "honorarios", label: "Honorarios", test: /honorario|contable|despacho/ },
  { key: "equipo", label: "Equipo", test: /maquinaria|tractocamion|penske|leasing/ },
  { key: "renta", label: "Renta", test: /renta|yard|oficina/ },
];

export function fixedKind(input: { name: string; vendor: string }): { key: FixedKind; label: string } {
  const value = `${input.name} ${input.vendor}`
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  return KIND_RULES.find((rule) => rule.test.test(value)) ?? { key: "otro", label: "Otros" };
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
