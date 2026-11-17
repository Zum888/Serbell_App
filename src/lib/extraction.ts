export type ExtractionDraft = {
  source: "demonstration" | "empty" | "user";
  isDemonstration: boolean;
  merchant: string | null;
  amountCents: number | null;
  currency: "USD";
  occurredOn: string | null;
  categoryName: string | null;
  subcategoryName: string | null;
  notice: string;
};

export function isDemoFleetSmartsTicket(fileName: string): boolean {
  const normalized = fileName
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  return normalized.includes("fleetsmarts") && (normalized.includes("ticket") || normalized.includes("203"));
}

export function extractLocal(fileName: string): ExtractionDraft {
  if (isDemoFleetSmartsTicket(fileName)) {
    return {
      source: "demonstration",
      isDemonstration: true,
      merchant: "FleetSmarts",
      amountCents: 20394,
      currency: "USD",
      occurredOn: "2026-10-12",
      categoryName: "Transporte",
      subcategoryName: "Combustible",
      notice:
        "Dato de demostración. No es una lectura del archivo. Verifica comercio, fecha e importe antes de vincular.",
    };
  }
  return {
    source: "empty",
    isDemonstration: false,
    merchant: null,
    amountCents: null,
    currency: "USD",
    occurredOn: null,
    categoryName: null,
    subcategoryName: null,
    notice: "No hay datos extraídos. Completa comercio, fecha e importe. El laboratorio no inventa campos.",
  };
}
