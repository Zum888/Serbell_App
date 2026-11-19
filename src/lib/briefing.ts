import { formatUsd } from "@/lib/money";

export type Briefing = {
  companyName: string;
  inflows: number;
  outflows: number;
  net: number;
  uncategorizedCount: number;
  uncategorizedExpenseCents: number;
  missingReceipts: number;
  needsReview: number;
  categories: { name: string; totalCents: number }[];
  duplicates: { id: string; fileName: string; merchant: string | null; amountCents: number | null }[];
  debtors: { partyId: string; name: string; openCents: number; invoiceCount: number }[];
  movements: { merchant: string; postedOn: string; amountCents: number; category: string }[];
};

export const TALK = ["analyze_spending", "review_duplicates", "who_owes", "track_movement", "earnings"] as const;
export type Talk = (typeof TALK)[number];

export function isTalk(type: string): type is Talk {
  return (TALK as readonly string[]).includes(type);
}

function moneyLine(name: string, cents: number): string {
  return `${name}: ${formatUsd(cents)}`;
}

export function talkReply(kind: Talk, briefing: Briefing): string {
  if (kind === "analyze_spending") {
    if (briefing.outflows === 0) return `${briefing.companyName} no tiene gastos en los movimientos guardados.`;
    const top = briefing.categories.slice(0, 3).map((row) => moneyLine(row.name, row.totalCents));
    const pending =
      briefing.uncategorizedCount === 0
        ? "Todos los movimientos tienen categoría."
        : `Quedan ${briefing.uncategorizedCount} sin categoría, y sus gastos suman ${formatUsd(briefing.uncategorizedExpenseCents)}.`;
    return [`En ${briefing.companyName} los gastos del periodo suman ${formatUsd(briefing.outflows)}.`, top.length ? `Lo más grande: ${top.join("; ")}.` : "", pending]
      .filter(Boolean)
      .join(" ");
  }
  if (kind === "review_duplicates") {
    if (briefing.duplicates.length === 0) return "No hay comprobantes duplicados en esta empresa.";
    const lines = briefing.duplicates.slice(0, 3).map((row) => {
      const who = row.merchant ? `${row.merchant} · ` : "";
      const amount = row.amountCents !== null ? ` · ${formatUsd(row.amountCents)}` : "";
      return `${who}${row.fileName}${amount}`;
    });
    const more = briefing.duplicates.length > 3 ? ` Hay ${briefing.duplicates.length - 3} más.` : "";
    return `Encontré ${briefing.duplicates.length} comprobante${briefing.duplicates.length === 1 ? "" : "s"} duplicado${briefing.duplicates.length === 1 ? "" : "s"}. ${lines.join(". ")}.${more}`;
  }
  if (kind === "who_owes") {
    const open = briefing.debtors.filter((row) => row.openCents > 0);
    if (open.length === 0) return "Ningún cliente tiene saldo abierto en las facturas guardadas.";
    const total = open.reduce((sum, row) => sum + row.openCents, 0);
    const lines = open.slice(0, 4).map((row) => `${row.name} debe ${formatUsd(row.openCents)}`);
    return `Te deben ${formatUsd(total)}. ${lines.join(". ")}.`;
  }
  if (kind === "track_movement") {
    if (briefing.movements.length === 0) return "No hay movimientos guardados para rastrear.";
    const lines = briefing.movements.slice(0, 4).map((row) => `${row.postedOn} · ${row.merchant} · ${formatUsd(row.amountCents)} · ${row.category}`);
    return `Estos son los movimientos más recientes. Ábrelos en Bancos para el comprobante y la conciliación. ${lines.join(". ")}.`;
  }
  const net =
    briefing.net === 0
      ? "entradas y salidas quedaron parejas"
      : briefing.net > 0
        ? `quedó un neto de ${formatUsd(briefing.net)}`
        : `el periodo cerró ${formatUsd(briefing.net)}`;
  return `En ${briefing.companyName} entraron ${formatUsd(briefing.inflows)} y salieron ${formatUsd(briefing.outflows)}. ${net.charAt(0).toUpperCase()}${net.slice(1)}.`;
}

export const GUIDE_REPLY =
  "Puedo analizar tus gastos, revisar duplicados, decirte quién debe, rastrear un movimiento o decirte cuánto ganaste.";
