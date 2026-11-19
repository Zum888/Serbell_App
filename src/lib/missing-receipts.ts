export const MISSING_RECEIPTS = [
  { id: "tx_qpl_x06", documentId: "doc_x_loves", merchant: "Love's", date: "24 oct 2026", amount: "USD 58.90", fileName: "Loves_1024.jpg" },
  { id: "tx_qpl_x11", documentId: "doc_x_comfort", merchant: "Comfort Inn", date: "25 oct 2026", amount: "USD 112.80", fileName: "ComfortInn_1025.jpg" },
  { id: "tx_qpl_x17", documentId: "doc_x_flyingj", merchant: "Flying J", date: "27 oct 2026", amount: "USD 67.30", fileName: "FlyingJ_1027.jpg" },
] as const;

export const MISSING_IDS: readonly string[] = MISSING_RECEIPTS.map((item) => item.id);

export const MISSING_HREF = "/movimientos?faltantes=1&con=chat&flujo=faltantes";
