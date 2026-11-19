import { describe, expect, it } from "vitest";
import { talkReply, type Briefing } from "@/lib/briefing";
import { parseIntent } from "@/lib/intent";
import { rankReceipts, visibleReceipts } from "@/lib/receipt-rank";

const briefing: Briefing = {
  companyName: "Quick Pick Logistics",
  inflows: 100_00,
  outflows: 40_00,
  net: 60_00,
  uncategorizedCount: 2,
  uncategorizedExpenseCents: 15_00,
  missingReceipts: 1,
  needsReview: 1,
  categories: [{ name: "Transporte", totalCents: 25_00 }],
  duplicates: [{ fileName: "copia.jpg", merchant: "FleetSmarts", amountCents: 203_94 }],
  debtors: [{ partyId: "party_andina", name: "Andina", openCents: 50_00, invoiceCount: 1 }],
  movements: [{ merchant: "Shell", postedOn: "12 oct 2026", amountCents: -86_40, category: "Transporte" }],
};

describe("conversaciones simuladas", () => {
  it("reconoce las preguntas del inicio", () => {
    expect(parseIntent("Analiza mis gastos").type).toBe("analyze_spending");
    expect(parseIntent("Revisar duplicados").type).toBe("review_duplicates");
    expect(parseIntent("¿Quién debe?").type).toBe("who_owes");
    expect(parseIntent("Rastréame este movimiento").type).toBe("track_movement");
    expect(parseIntent("¿Cuánto gané?").type).toBe("earnings");
    expect(parseIntent("estado de operaciones").type).toBe("operation_status");
  });

  it("responde con los números guardados", () => {
    expect(talkReply("who_owes", briefing)).toContain("Andina");
    expect(talkReply("earnings", briefing)).toContain("Quick Pick Logistics");
    expect(talkReply("review_duplicates", briefing)).toContain("copia.jpg");
    expect(talkReply("track_movement", briefing)).toContain("Shell");
  });
});

describe("comprobantes sugeridos", () => {
  it("no lista cientos de tickets: muestra el parecido y esconde el resto", () => {
    const choices = [
      { id: "a", fileName: "otro.jpg", merchant: "Costco", amountCents: 100 },
      { id: "b", fileName: "shell.jpg", merchant: "Shell", amountCents: 8640 },
      { id: "c", fileName: "lejos.jpg", merchant: "Walmart", amountCents: 20 },
    ];
    const ranked = rankReceipts(choices, { merchant: "Shell", amountCents: -8640 });
    const view = visibleReceipts(ranked, "");
    expect(view.suggested?.id).toBe("b");
    expect(view.similar.every((item) => item.id !== "b")).toBe(true);
    expect(view.similar.length).toBeLessThanOrEqual(3);
    expect(visibleReceipts(ranked, "walmart").searched.map((item) => item.id)).toEqual(["c"]);
  });
});
