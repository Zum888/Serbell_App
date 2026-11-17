export function atNoon(day: string): Date {
  return new Date(`${day}T12:00:00.000Z`);
}

export function dayKey(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

export function formatDay(day: string | null | undefined): string {
  if (!day) return "Sin fecha";
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return day;
  const value = new Date(Date.UTC(year, month - 1, date, 12));
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(value)
    .replace(/\./g, "");
}

export function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(value);
}

export function formatTodayLabel(now = new Date()): string {
  const label = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(now);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function isDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(atNoon(value).getTime());
}
