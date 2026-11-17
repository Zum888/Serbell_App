export const DOCUMENT_LABEL: Record<string, string> = {
  Missing: "Faltante",
  Suggested: "Sugerido",
  Linked: "Vinculado",
  Conflict: "Conflicto",
};

export const REVIEW_LABEL: Record<string, string> = {
  NeedsReview: "Por revisar",
  NeedsClient: "Esperando cliente",
  Approved: "Aprobado",
  Reopened: "Reabierto",
};

export const ACCOUNTING_LABEL: Record<string, string> = {
  Uncategorized: "Sin categoría",
  Proposed: "Propuesta",
  Recorded: "Registrada",
  Approved: "Aprobada",
};

export const RECONCILIATION_LABEL: Record<string, string> = {
  Unreconciled: "Sin conciliar",
  Reconciled: "Conciliado",
};

export const BANK_LABEL: Record<string, string> = {
  Pending: "Pendiente",
  Posted: "Publicado",
  Reversed: "Reversado",
};

export const AUDIT_LABEL: Record<string, string> = {
  link_confirmed: "Vínculo confirmado",
  link_postponed: "Vínculo dejado para después",
  link_rejected: "Vínculo rechazado",
  extraction_verified: "Datos del comprobante confirmados",
  classification_changed: "Categoría actualizada",
  seal: "Aprobado y sellado",
  reopen: "Sello reabierto",
  clarification_requested: "Aclaración solicitada",
  clarification_answered: "Aclaración respondida",
  duplicate_detected: "Comprobante duplicado",
  match_none: "Sin movimiento compatible",
  match_conflict: "Coincidencia en conflicto",
  seeded_seal: "Sello de demostración inicial",
  seeded_approval: "Aprobación de demostración inicial",
  manual_reconcile: "Conciliación manual",
  document_replaced: "Comprobante reemplazado",
  serbell_matched: "Serbell concilió",
  asiento_saved: "Asiento registrado",
  invoice_linked: "Factura vinculada al movimiento",
  invoice_follow_up: "Factura marcada para seguimiento",
  focus_skipped: "Movimiento omitido en el modo enfoque",
  classification_rule_applied: "Categoría aplicada a un comercio",
  account_created: "Cuenta manual agregada",
};

export function greetingName(name: string): string {
  if (name === "Padrino") return "Padrino";
  return name.split(" ")[0] ?? name;
}
