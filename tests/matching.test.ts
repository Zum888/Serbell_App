import { describe, expect, it } from "vitest";
import { evaluateMatch, type MatchTxn } from "@/lib/matching";

const transactions: MatchTxn[] = [
  { id: "tx_qpl_fs_20394", merchant: "FleetSmarts", amountCents: -20394, currency: "USD", postedOn: "2026-10-12", confirmedDocumentId: null },
  { id: "tx_qpl_fs_21148", merchant: "FleetSmarts", amountCents: -21148, currency: "USD", postedOn: "2026-10-08", confirmedDocumentId: "doc_qpl_fs_21148" },
  { id: "tx_qpl_fs_15012", merchant: "FleetSmarts", amountCents: -15012, currency: "USD", postedOn: "2026-10-22", confirmedDocumentId: "doc_qpl_fs_15012" },
  { id: "tx_qpl_sunpass_03", merchant: "SunPass", amountCents: -1000, currency: "USD", postedOn: "2026-10-03", confirmedDocumentId: null },
  { id: "tx_qpl_sunpass_27", merchant: "SunPass", amountCents: -1000, currency: "USD", postedOn: "2026-10-27", confirmedDocumentId: null },
];

describe("emparejamiento determinista", () => {
  it("elige la única coincidencia de FleetSmarts por importe, comercio y fecha", () => {
    const result = evaluateMatch({
      document: { id: "doc_new", merchant: "FleetSmarts", amountCents: 20394, currency: "USD", occurredOn: "2026-10-12", fileHash: "abc" },
      transactions,
      documents: [],
    });
    expect(result.decision).toBe("reliable");
    expect(result.proposedTransactionId).toBe("tx_qpl_fs_20394");
    expect(result.candidates.filter((candidate) => !candidate.blocked)).toHaveLength(1);
    expect(result.reasonsFor.join(" ")).toContain("203.94");
    expect(result.reasonsFor.join(" ")).toContain("FleetSmarts");
    expect(result.reasonsFor.join(" ")).toContain("12 oct 2026");
  });

  it("deja ambiguos dos SunPass del mismo importe sin fecha", () => {
    const result = evaluateMatch({
      document: { id: "doc_sun", merchant: "SUNPASS", amountCents: 1000, currency: "USD", occurredOn: null, fileHash: null },
      transactions,
      documents: [],
    });
    expect(result.decision).toBe("ambiguous");
    expect(result.proposedTransactionId).toBeNull();
    expect(result.candidates.map((candidate) => candidate.transactionId).sort()).toEqual(["tx_qpl_sunpass_03", "tx_qpl_sunpass_27"]);
  });

  it("no inventa un movimiento cuando no hay importe y comercio", () => {
    const result = evaluateMatch({
      document: { id: "doc_harbor", merchant: "Harbor Freight", amountCents: 8900, currency: "USD", occurredOn: "2026-10-11", fileHash: null },
      transactions,
      documents: [],
    });
    expect(result.decision).toBe("none");
    expect(result.candidates).toHaveLength(0);
    expect(result.proposedTransactionId).toBeNull();
  });

  it("marca duplicado por comercio, importe y fecha", () => {
    const result = evaluateMatch({
      document: { id: "doc_copy", merchant: "FleetSmarts", amountCents: 21148, currency: "USD", occurredOn: "2026-10-08", fileHash: "nuevo" },
      transactions,
      documents: [{ id: "doc_qpl_fs_21148", merchant: "FleetSmarts", amountCents: 21148, occurredOn: "2026-10-08", fileHash: "otro" }],
    });
    expect(result.decision).toBe("duplicate");
    expect(result.duplicateOfDocumentId).toBe("doc_qpl_fs_21148");
    expect(result.proposedTransactionId).toBeNull();
  });

  it("bloquea un movimiento que ya tiene otro comprobante", () => {
    const result = evaluateMatch({
      document: { id: "doc_other", merchant: "FleetSmarts", amountCents: 15012, currency: "USD", occurredOn: "2026-10-22", fileHash: "distinto" },
      transactions,
      documents: [],
    });
    expect(result.decision).toBe("conflict");
    expect(result.proposedTransactionId).toBeNull();
    expect(result.reasonsAgainst.join(" ")).toContain("ya tiene un comprobante");
  });
});
