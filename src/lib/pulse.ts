import { formatUsd } from "@/lib/money";

export type PulseFlow = "factura" | "lote" | "duplicado" | "faltantes" | "cobro" | "clasificar" | "efectivo";

export type PulseItem = {
  id: string;
  flow: PulseFlow;
  title: string;
  detail: string;
  action: string;
};

export type PulseDone = {
  id: string;
  flow: PulseFlow;
  text: string;
};

export type PulseStory = {
  userLine: string;
  assistant: string;
  checks: { label: string; value: string }[];
  closing: string;
  href: string;
};

export type Pulse = {
  companyName: string;
  balanceCents: number;
  balanceNote: string | null;
  receivableCents: number;
  receivableNote: string;
  payableCents: number;
  payableNote: string;
  attention: PulseItem[];
  done: PulseDone[];
  stories: Partial<Record<PulseFlow, PulseStory>>;
};

export function buildPulse(input: {
  companyName: string;
  balanceCents: number;
  earlyNet: number | null;
  lateNet: number | null;
  receivableCents: number;
  receivableCount: number;
  payableCents: number;
  payableCount: number;
  payableSoon: number;
  duplicate: { merchant: string; amount: string } | null;
  debtor: { partyId: string; name: string; openCents: number } | null;
  reconciled: number;
  categorized: number;
  linked: number;
  uncategorized: number;
  inflows: number;
  outflows: number;
  net: number;
}): Pulse {
  const attention: PulseItem[] = [];
  const stories: Pulse["stories"] = {};
  if (input.duplicate) {
    attention.push({
      id: "duplicado",
      flow: "duplicado",
      title: "Detecté un posible cobro duplicado",
      detail: `${input.duplicate.merchant} hizo dos cargos de ${input.duplicate.amount}. Hay que decidir si son el mismo.`,
      action: "Revisar movimientos",
    });
  }
  if (input.debtor && input.debtor.openCents > 0) {
    attention.push({
      id: "cobro",
      flow: "cobro",
      title: "Una factura está vencida",
      detail: `${input.debtor.name} te debe ${formatUsd(input.debtor.openCents)}. Preparé un recordatorio de cobro para tu aprobación.`,
      action: "Revisar recordatorio",
    });
    stories.cobro = {
      userLine: `Revisa el recordatorio para ${input.debtor.name}.`,
      assistant: "El recordatorio ya está escrito. Confirmo cliente, importe y que la factura venció.",
      checks: [
        { label: "Cliente", value: input.debtor.name },
        { label: "Importe", value: formatUsd(input.debtor.openCents) },
        { label: "Estado", value: "Vencida" },
      ],
      closing: "Te llevo a Por cobrar para que lo apruebes.",
      href: `/por-cobrar?parte=${input.debtor.partyId}&con=chat&flujo=cobro`,
    };
  }
  const done: PulseDone[] = [];
  if (input.reconciled > 0) {
    const noun = input.reconciled === 1 ? "movimiento bancario" : "movimientos bancarios";
    done.push({ id: "lote", flow: "lote", text: `Concilié ${input.reconciled} ${noun}.` });
  }
  if (input.categorized > 0) {
    const noun = input.categorized === 1 ? "gasto" : "gastos";
    done.push({ id: "clasificar", flow: "clasificar", text: `Clasifiqué ${input.categorized} ${noun} de tu empresa.` });
    stories.clasificar = {
      userLine: "Muéstrame cómo clasificaste los gastos.",
      assistant: input.uncategorized > 0
        ? `Dejé categoría en ${input.categorized} gastos. Quedan ${input.uncategorized} sin clasificar.`
        : `Los ${input.categorized} gastos ya tienen categoría.`,
      checks: [
        { label: "Con categoría", value: String(input.categorized) },
        { label: "Pendientes", value: String(input.uncategorized) },
      ],
      closing: input.uncategorized > 0 ? "Te llevo a los que todavía no tienen categoría." : "Te llevo a las categorías.",
      href: input.uncategorized > 0
        ? "/movimientos?filtro=sin-categoria&con=chat&flujo=clasificar"
        : "/categorias?con=chat&flujo=clasificar",
    };
  }
  if (input.linked > 0) {
    const noun = input.linked === 1 ? "comprobante" : "comprobantes";
    done.push({ id: "faltantes", flow: "faltantes", text: `Registré ${input.linked} ${noun}.` });
  }
  done.push({ id: "efectivo", flow: "efectivo", text: "Actualicé tu flujo de efectivo." });
  stories.efectivo = {
    userLine: "Muéstrame el flujo de efectivo.",
    assistant: "Lo armé con las entradas y las salidas que ya están en el banco.",
    checks: [
      { label: "Entradas", value: formatUsd(input.inflows) },
      { label: "Salidas", value: formatUsd(input.outflows) },
      { label: "Neto", value: formatUsd(input.net) },
    ],
    closing: "Te llevo al reporte.",
    href: "/reportes?con=chat&flujo=efectivo",
  };
  done.push({ id: "factura", flow: "factura", text: "Dejé lista una factura para conciliarla con el banco." });

  const receivableNote = input.receivableCount === 1 ? "1 factura pendiente" : `${input.receivableCount} facturas pendientes`;
  const payableNote = input.payableSoon > 0
    ? input.payableSoon === 1 ? "1 pago esta semana" : `${input.payableSoon} pagos esta semana`
    : input.payableCount === 1 ? "1 factura por pagar" : `${input.payableCount} facturas por pagar`;

  return {
    companyName: input.companyName,
    balanceCents: input.balanceCents,
    balanceNote: balanceNote(input.earlyNet, input.lateNet),
    receivableCents: input.receivableCents,
    receivableNote,
    payableCents: input.payableCents,
    payableNote,
    attention,
    done,
    stories,
  };
}

function balanceNote(early: number | null, late: number | null) {
  if (early === null || late === null || early === 0) return null;
  const pct = Math.round(((late - early) / Math.abs(early)) * 100);
  if (!Number.isFinite(pct) || pct === 0 || Math.abs(pct) > 99) return null;
  return `${pct > 0 ? "+" : ""}${pct}% vs. la primera mitad`;
}
