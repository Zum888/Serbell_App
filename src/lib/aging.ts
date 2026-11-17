export type AgingKey = "current" | "d30" | "d60" | "d60plus";

export function todayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function agingKey(dueOn: string, today: string): AgingKey {
  const due = Date.parse(`${dueOn}T12:00:00.000Z`);
  const now = Date.parse(`${today}T12:00:00.000Z`);
  const days = Math.round((now - due) / 86_400_000);
  if (days <= 0) return "current";
  if (days <= 30) return "d30";
  if (days <= 60) return "d60";
  return "d60plus";
}

export const AGING_LABEL: Record<AgingKey, string> = {
  current: "Al corriente",
  d30: "1–30",
  d60: "31–60",
  d60plus: "+60",
};
