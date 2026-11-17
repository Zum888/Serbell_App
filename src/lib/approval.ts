export const APPROVAL_FLOW = ["por_autorizar", "autorizada", "en_proceso", "conciliada"] as const;

export type Approval = (typeof APPROVAL_FLOW)[number];

export const APPROVAL_LABEL: Record<Approval, string> = {
  por_autorizar: "Por autorizar",
  autorizada: "Autorizada",
  en_proceso: "En proceso",
  conciliada: "Conciliada",
};

export const APPROVAL_TONE: Record<Approval, string> = {
  por_autorizar: "bg-amber-50 text-amber-700",
  autorizada: "bg-blue-50 text-blue-700",
  en_proceso: "bg-violet-50 text-violet-700",
  conciliada: "bg-emerald-50 text-emerald-700",
};

export function normalizeApproval(value: string | null | undefined): Approval {
  return (APPROVAL_FLOW as readonly string[]).includes(value ?? "") ? (value as Approval) : "por_autorizar";
}

/** The next step the owner can advance to by hand. Conciliada comes only from a bank link, so it is never returned here. */
export function nextApproval(current: Approval): Approval | null {
  if (current === "por_autorizar") return "autorizada";
  if (current === "autorizada") return "en_proceso";
  return null;
}

export const ADVANCE_LABEL: Record<string, string> = {
  autorizada: "Autorizar",
  en_proceso: "Marcar en proceso",
};
