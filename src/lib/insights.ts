import { monthName, shortMonth } from "@/lib/fixed";
import { formatUsd } from "@/lib/money";

export type MonthTotals = { month: string; inflows: number; outflows: number; net: number };

export function change(current: number, previous: number | null | undefined): number | null {
  if (previous === null || previous === undefined || previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}

export function percentLabel(value: number | null): string {
  if (value === null) return "—";
  const rounded = Math.round(value * 100);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

export function headline(current: MonthTotals, previous: MonthTotals | null): string {
  const month = monthName(current.month).split(" ")[0];
  const result = current.net >= 0 ? `${month} cerró con ${formatUsd(current.net)} de flujo neto positivo` : `${month} cerró con ${formatUsd(current.net)} de flujo neto`;
  if (!previous) return `${result}.`;
  const delta = change(current.net, previous.net);
  if (delta === null) return `${result}.`;
  const direction = current.net >= previous.net ? "mejor" : "peor";
  return `${result}, ${percentLabel(Math.abs(delta)).replace("+", "")} ${direction} que ${shortMonth(previous.month)}.`;
}

export function subline(current: MonthTotals, previous: MonthTotals | null): string {
  if (!previous) return `Entraron ${formatUsd(current.inflows)} y salieron ${formatUsd(current.outflows)}.`;
  const income = change(current.inflows, previous.inflows);
  const spend = change(current.outflows, previous.outflows);
  return `Los ingresos ${movement(income, true)} y el gasto ${movement(spend, false)} contra ${shortMonth(previous.month)}.`;
}

function movement(value: number | null, plural: boolean) {
  if (value === null || Math.round(value * 100) === 0) return plural ? "se mantuvieron" : "se mantuvo";
  const amount = percentLabel(Math.abs(value)).replace("+", "");
  if (value > 0) return `${plural ? "subieron" : "subió"} ${amount}`;
  return `${plural ? "bajaron" : "bajó"} ${amount}`;
}

export type WaterfallStep = { label: string; value: number; start: number; end: number; kind: "total" | "up" | "down" };

export function waterfall(input: {
  closingCents: number;
  inflows: number;
  categories: { category: string; totalCents: number }[];
  maxCategories?: number;
}): WaterfallStep[] {
  const outflows = input.categories.reduce((sum, row) => sum + row.totalCents, 0);
  const opening = input.closingCents - input.inflows + outflows;
  const steps: WaterfallStep[] = [{ label: "Saldo inicial", value: opening, start: 0, end: opening, kind: "total" }];
  let level = opening;
  steps.push({ label: "Ingresos", value: input.inflows, start: level, end: level + input.inflows, kind: "up" });
  level += input.inflows;
  const limit = input.maxCategories ?? 4;
  const sorted = [...input.categories].sort((a, b) => b.totalCents - a.totalCents);
  const top = sorted.slice(0, limit);
  const rest = sorted.slice(limit).reduce((sum, row) => sum + row.totalCents, 0);
  for (const row of top) {
    steps.push({ label: row.category, value: -row.totalCents, start: level, end: level - row.totalCents, kind: "down" });
    level -= row.totalCents;
  }
  if (rest > 0) {
    steps.push({ label: "Otros", value: -rest, start: level, end: level - rest, kind: "down" });
    level -= rest;
  }
  steps.push({ label: "Saldo final", value: level, start: 0, end: level, kind: "total" });
  return steps;
}

export function weekly(daily: { day: string; inflows: number; outflows: number }[]) {
  const weeks = new Map<number, { label: string; inflows: number; outflows: number }>();
  for (const point of daily) {
    const dayNumber = Number(point.day.slice(8, 10));
    const index = Math.min(4, Math.floor((dayNumber - 1) / 7));
    const from = index * 7 + 1;
    const to = index === 4 ? 31 : from + 6;
    const bucket = weeks.get(index) ?? { label: `${from}–${to}`, inflows: 0, outflows: 0 };
    bucket.inflows += point.inflows;
    bucket.outflows += point.outflows;
    weeks.set(index, bucket);
  }
  return [...weeks.entries()].sort((a, b) => a[0] - b[0]).map(([, bucket]) => bucket);
}

export function cashDays(balanceCents: number, outflows: number, days: number): number | null {
  if (outflows <= 0 || days <= 0) return null;
  return Math.floor(balanceCents / (outflows / days));
}
