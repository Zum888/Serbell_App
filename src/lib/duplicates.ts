export const DUPLICATE_IDS = ["tx_qpl_sunpass_03", "tx_qpl_sunpass_27"] as const;

export const DUPLICATE_PAIR = [
  { id: DUPLICATE_IDS[0], merchant: "SunPass", date: "3 oct 2026", amount: "USD 10.00", amountCents: -1000 },
  { id: DUPLICATE_IDS[1], merchant: "SunPass", date: "27 oct 2026", amount: "USD 10.00", amountCents: -1000 },
] as const;

export const DUPLICATE_HREF = "/movimientos?duplicado=sunpass&con=chat&flujo=duplicado";

export const DUPLICATE_CHOICES = [
  { id: "distintos", label: "Son compras distintas", note: "Quedaron como compras distintas. Los dos cargos siguen en el banco." },
  { id: "investigar", label: "Marcar para investigación", note: "Marqué el cargo para investigación. No eliminé ningún movimiento." },
  { id: "reclamo", label: "Preparar una reclamación", note: "Preparé la reclamación. Los dos cargos siguen en el banco." },
] as const;

export function duplicateChoice(id: string | undefined) {
  return DUPLICATE_CHOICES.find((choice) => choice.id === id) ?? null;
}
