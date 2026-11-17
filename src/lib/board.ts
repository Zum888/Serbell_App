export type DocumentColumn = "recibido" | "procesado" | "listo" | "sellado";
export type ReviewColumn = "revisar" | "cliente" | "aprobar" | "sellado";

export function documentColumn(input: {
  linked: boolean;
  sealed: boolean;
  reviewState: string | null;
  hasSuggestion: boolean;
  duplicate: boolean;
  conflict: boolean;
}): DocumentColumn {
  if (input.linked && input.sealed) return "sellado";
  if (input.linked && input.reviewState === "NeedsClient") return "procesado";
  if (input.linked) return "listo";
  if (input.hasSuggestion || input.duplicate || input.conflict) return "procesado";
  return "recibido";
}

export function reviewColumn(input: { sealed: boolean; reviewState: string; documentState: string }): ReviewColumn {
  if (input.sealed) return "sellado";
  if (input.reviewState === "NeedsClient") return "cliente";
  if (input.documentState === "Linked") return "aprobar";
  return "revisar";
}
