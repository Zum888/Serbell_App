import { expect, it } from "vitest";
import { documentColumn, reviewColumn } from "@/lib/board";

it("coloca cada comprobante en una columna según su estado real", () => {
  expect(documentColumn({ linked: false, sealed: false, reviewState: null, hasSuggestion: false, duplicate: false, conflict: false })).toBe("recibido");
  expect(documentColumn({ linked: false, sealed: false, reviewState: null, hasSuggestion: true, duplicate: false, conflict: false })).toBe("procesado");
  expect(documentColumn({ linked: false, sealed: false, reviewState: null, hasSuggestion: false, duplicate: true, conflict: false })).toBe("procesado");
  expect(documentColumn({ linked: false, sealed: false, reviewState: null, hasSuggestion: false, duplicate: false, conflict: true })).toBe("procesado");
  expect(documentColumn({ linked: true, sealed: false, reviewState: "NeedsReview", hasSuggestion: false, duplicate: false, conflict: false })).toBe("listo");
  expect(documentColumn({ linked: true, sealed: false, reviewState: "Approved", hasSuggestion: false, duplicate: false, conflict: false })).toBe("listo");
  expect(documentColumn({ linked: true, sealed: false, reviewState: "NeedsClient", hasSuggestion: true, duplicate: false, conflict: false })).toBe("procesado");
  expect(documentColumn({ linked: true, sealed: true, reviewState: "Approved", hasSuggestion: false, duplicate: true, conflict: false })).toBe("sellado");
});

it("coloca la revisión del contador sin inventar un sello", () => {
  expect(reviewColumn({ sealed: false, reviewState: "NeedsReview", documentState: "Missing" })).toBe("revisar");
  expect(reviewColumn({ sealed: false, reviewState: "NeedsReview", documentState: "Suggested" })).toBe("revisar");
  expect(reviewColumn({ sealed: false, reviewState: "NeedsReview", documentState: "Conflict" })).toBe("revisar");
  expect(reviewColumn({ sealed: false, reviewState: "NeedsClient", documentState: "Missing" })).toBe("cliente");
  expect(reviewColumn({ sealed: false, reviewState: "NeedsClient", documentState: "Linked" })).toBe("cliente");
  expect(reviewColumn({ sealed: false, reviewState: "NeedsReview", documentState: "Linked" })).toBe("aprobar");
  expect(reviewColumn({ sealed: false, reviewState: "Approved", documentState: "Linked" })).toBe("aprobar");
  expect(reviewColumn({ sealed: true, reviewState: "Approved", documentState: "Linked" })).toBe("sellado");
});
