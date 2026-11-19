import { formatUsd } from "@/lib/money";

export type HomeStart = {
  id: string;
  title: string;
  detail: string;
  href: string;
  action: string;
};

export type HomeStartInput = {
  uncategorizedCount: number;
  uncategorizedExpenseCents: number;
  missingReceipts: number;
  needsReview: number;
  duplicates: { id: string; fileName: string; merchant: string | null }[];
  debtor: { partyId: string; name: string; openCents: number; others: number } | null;
  largestExpense: { id: string; merchant: string; amountCents: number } | null;
};

export function homeStarts(input: HomeStartInput): HomeStart[] {
  const starts: HomeStart[] = [];
  if (input.uncategorizedCount > 0) {
    const noun = input.uncategorizedCount === 1 ? "movimiento no tiene categoría" : "movimientos no tienen categoría";
    starts.push({
      id: "categoria",
      title: "Clasificar movimientos",
      detail: `${input.uncategorizedCount} ${noun}. Sus gastos suman ${formatUsd(input.uncategorizedExpenseCents)}.`,
      href: "/movimientos?filtro=sin-categoria",
      action: "Clasificar",
    });
  }
  if (input.missingReceipts > 0) {
    const noun = input.missingReceipts === 1 ? "movimiento no tiene comprobante" : "movimientos no tienen comprobante";
    starts.push({
      id: "comprobante",
      title: "Adjuntar comprobantes",
      detail: `${input.missingReceipts} ${noun}.`,
      href: "/movimientos?filtro=sin-comprobante",
      action: "Adjuntar",
    });
  }
  if (input.needsReview > 0) {
    const noun = input.needsReview === 1 ? "movimiento espera revisión" : "movimientos esperan revisión";
    starts.push({
      id: "revisar",
      title: "Revisar con el contador",
      detail: `${input.needsReview} ${noun}.`,
      href: "/movimientos?filtro=por-revisar",
      action: "Revisar",
    });
  }
  if (input.duplicates.length > 0) {
    const first = input.duplicates[0];
    const who = first.merchant ? `${first.merchant}: ` : "";
    const more = input.duplicates.length > 1 ? ` Hay ${input.duplicates.length} duplicados.` : "";
    starts.push({
      id: "duplicado",
      title: "Revisar un duplicado",
      detail: `${who}${first.fileName} es una copia.${more}`,
      href: `/comprobantes?recibo=${first.id}`,
      action: "Abrir",
    });
  }
  if (input.debtor && input.debtor.openCents > 0) {
    const extra = input.debtor.others === 1
      ? " Hay 1 cliente más con saldo."
      : input.debtor.others > 1
        ? ` Hay ${input.debtor.others} clientes más con saldo.`
        : "";
    starts.push({
      id: "cobrar",
      title: `Cobrar a ${input.debtor.name}`,
      detail: `Debe ${formatUsd(input.debtor.openCents)}.${extra}`,
      href: `/por-cobrar?parte=${input.debtor.partyId}`,
      action: "Cobrar",
    });
  }
  const picked = starts.slice(0, 5);
  if (picked.length >= 2) return picked;
  if (input.largestExpense) {
    picked.push({
      id: "gasto",
      title: `Ver el gasto de ${input.largestExpense.merchant}`,
      detail: `Es el mayor del periodo: ${formatUsd(Math.abs(input.largestExpense.amountCents))}.`,
      href: `/movimientos?movimiento=${input.largestExpense.id}`,
      action: "Abrir",
    });
  }
  if (picked.length < 2) {
    picked.push({
      id: "reporte",
      title: "Ver el reporte del periodo",
      detail: "Entradas, salidas y gastos por categoría.",
      href: "/reportes",
      action: "Abrir",
    });
  }
  if (picked.length < 2) {
    picked.push({
      id: "movimientos",
      title: "Ver los movimientos",
      detail: "La conciliación y los comprobantes están en esa tabla.",
      href: "/movimientos",
      action: "Abrir",
    });
  }
  return picked.slice(0, 5);
}
