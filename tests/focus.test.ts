import { expect, it } from "vitest";
import { isPendingMovement, rankSuggestions } from "@/lib/focus";

it("deja fuera lo sellado y lo que ya tiene categoría y vínculo", () => {
  expect(isPendingMovement({ sealedAt: new Date(), accountingState: "Uncategorized", documentState: "Missing" })).toBe(false);
  expect(isPendingMovement({ sealedAt: null, accountingState: "Uncategorized", documentState: "Linked" })).toBe(true);
  expect(isPendingMovement({ sealedAt: null, accountingState: "Proposed", documentState: "Suggested" })).toBe(true);
  expect(isPendingMovement({ sealedAt: null, accountingState: "Proposed", documentState: "Conflict" })).toBe(true);
  expect(isPendingMovement({ sealedAt: null, accountingState: "Recorded", documentState: "Missing" })).toBe(false);
  expect(isPendingMovement({ sealedAt: null, accountingState: "Approved", documentState: "Linked" })).toBe(false);
});

it("arma tres sugerencias con el historial de la misma empresa", () => {
  const suggestions = rankSuggestions({
    transactionId: "tx_new",
    merchant: "NAPA Auto Parts",
    amountCents: -2750,
    history: [
      { id: "a", merchant: "FleetSmarts", amountCents: -100, subcategoryId: "cat_qpl_combustible", label: "Transporte / Combustible", postedOn: "2026-10-12" },
      { id: "b", merchant: "FleetSmarts", amountCents: -100, subcategoryId: "cat_qpl_combustible", label: "Transporte / Combustible", postedOn: "2026-10-08" },
      { id: "c", merchant: "SunPass", amountCents: -100, subcategoryId: "cat_qpl_peajes", label: "Transporte / Peajes", postedOn: "2026-10-03" },
      { id: "d", merchant: "SunPass", amountCents: -100, subcategoryId: "cat_qpl_mantenimiento", label: "Operación / Mantenimiento", postedOn: "2026-10-27" },
      { id: "e", merchant: "Cliente García", amountCents: 500, subcategoryId: "cat_riv_servicios", label: "Ingresos / Servicios", postedOn: "2026-10-09" },
    ],
    rules: [{ merchant: "Carlos David", subcategoryId: "cat_qpl_honorarios", label: "Administración / Honorarios", postedOn: "2026-10-20" }],
    extraction: null,
  });
  expect(suggestions.map((item) => item.subcategoryId)).toEqual(["cat_qpl_combustible", "cat_qpl_mantenimiento", "cat_qpl_peajes"]);
  expect(suggestions[0].reason).toContain("2 gastos");
  expect(suggestions.some((item) => item.subcategoryId.startsWith("cat_riv"))).toBe(false);
  expect(suggestions.some((item) => item.reason.includes("regla"))).toBe(false);
});

it("prioriza el historial y la regla del mismo comercio", () => {
  const suggestions = rankSuggestions({
    transactionId: "tx_sun",
    merchant: "SunPass",
    amountCents: -1000,
    history: [
      { id: "other", merchant: "SunPass", amountCents: -1000, subcategoryId: "cat_qpl_peajes", label: "Transporte / Peajes", postedOn: "2026-10-03" },
      { id: "fuel", merchant: "FleetSmarts", amountCents: -100, subcategoryId: "cat_qpl_combustible", label: "Transporte / Combustible", postedOn: "2026-10-12" },
    ],
    rules: [{ merchant: "SunPass", subcategoryId: "cat_qpl_mantenimiento", label: "Operación / Mantenimiento", postedOn: "2026-10-27" }],
    extraction: { subcategoryId: "cat_qpl_peajes", label: "Transporte / Peajes" },
  });
  expect(suggestions.map((item) => item.subcategoryId)).toEqual(["cat_qpl_peajes", "cat_qpl_mantenimiento", "cat_qpl_combustible"]);
  expect(suggestions[0].reason).toContain("Otro movimiento de SunPass");
  expect(suggestions[1].reason).toContain("regla guardada");
  expect(suggestions[2].reason).toContain("gasto");
});
