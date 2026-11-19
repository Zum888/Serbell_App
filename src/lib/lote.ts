export const LOTE_ACCOUNT = "acct_qpl_boa";

export const LOTE = [
  { id: "tx_qpl_x01", kind: "Ticket", fileName: "RaceTrac_ticket.jpg", merchant: "RaceTrac", amount: "USD 42.15", date: "2 oct 2026" },
  { id: "tx_qpl_x02", kind: "Factura", fileName: "Factura_OfficeDepot.pdf", merchant: "Office Depot", amount: "USD 89.30", date: "5 oct 2026" },
  { id: "tx_qpl_x04", kind: "Ticket", fileName: "TA_ticket.jpg", merchant: "TA Travel Center", amount: "USD 76.50", date: "11 oct 2026" },
  { id: "tx_qpl_x05", kind: "Factura", fileName: "Factura_Verizon.pdf", merchant: "Verizon", amount: "USD 31.20", date: "16 oct 2026" },
] as const;

export function loteItem(id: string | undefined) {
  return LOTE.find((item) => item.id === id) ?? null;
}

const CHAT = "con=chat&flujo=lote";

export function loteStartHref() {
  return `/cuentas?cuenta=${LOTE_ACCOUNT}&paso=conciliar&actual=${LOTE[0].id}&lote=1&${CHAT}`;
}

export function loteNextHref(id: string) {
  const index = LOTE.findIndex((item) => item.id === id);
  const next = index >= 0 ? LOTE[index + 1] : undefined;
  if (!next) return `/movimientos?cuenta=${LOTE_ACCOUNT}&lote=lista&${CHAT}`;
  return `/cuentas?cuenta=${LOTE_ACCOUNT}&paso=conciliar&actual=${next.id}&lote=1&${CHAT}`;
}
