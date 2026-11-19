import { describe, expect, it } from "vitest";
import { homeStarts, type HomeStartInput } from "@/lib/home-starts";

const empty: HomeStartInput = {
  uncategorizedCount: 0,
  uncategorizedExpenseCents: 0,
  missingReceipts: 0,
  needsReview: 0,
  duplicates: [],
  debtor: null,
  largestExpense: null,
};

describe("con qué empezar en el inicio", () => {
  it("ofrece los pendientes y cada uno abre su pantalla", () => {
    const starts = homeStarts({
      ...empty,
      uncategorizedCount: 4,
      uncategorizedExpenseCents: 12_00,
      missingReceipts: 2,
      needsReview: 1,
      duplicates: [{ id: "doc_dup", fileName: "copia.jpg", merchant: "FleetSmarts" }],
      debtor: { partyId: "party_ruiz", name: "Cliente Ruiz", openCents: 40_00, others: 1 },
      largestExpense: { id: "tx_big", merchant: "Shell", amountCents: -86_40 },
    });
    expect(starts.map((start) => start.id)).toEqual(["categoria", "comprobante", "revisar", "duplicado", "cobrar"]);
    expect(starts[0].href).toBe("/movimientos?filtro=sin-categoria");
    expect(starts[1].href).toBe("/movimientos?filtro=sin-comprobante");
    expect(starts[2].href).toBe("/movimientos?filtro=por-revisar");
    expect(starts[3].href).toBe("/comprobantes?recibo=doc_dup");
    expect(starts[4].href).toBe("/por-cobrar?parte=party_ruiz");
    expect(starts[4].title).toContain("Cliente Ruiz");
  });

  it("no pasa de cinco y no inventa un pendiente en cero", () => {
    const starts = homeStarts({
      ...empty,
      uncategorizedCount: 1,
      missingReceipts: 1,
      needsReview: 1,
      duplicates: [
        { id: "a", fileName: "a.jpg", merchant: null },
        { id: "b", fileName: "b.jpg", merchant: null },
      ],
      debtor: { partyId: "p", name: "Andina", openCents: 10, others: 0 },
      largestExpense: { id: "tx", merchant: "Shell", amountCents: -100 },
    });
    expect(starts).toHaveLength(5);
    expect(starts.some((start) => start.id === "gasto")).toBe(false);
  });

  it("si no hay pendientes, deja dos entradas para seguir", () => {
    const starts = homeStarts(empty);
    expect(starts.map((start) => start.id)).toEqual(["reporte", "movimientos"]);
  });
});
