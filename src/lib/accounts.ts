const SMALL_WORD = new Set(["of", "de", "del", "la", "el", "y", "the", "and"]);

export function accountInitials(institution: string): string {
  const parts = institution
    .trim()
    .split(/\s+/)
    .filter((part) => part && !SMALL_WORD.has(part.toLowerCase()));
  const letters = parts.length > 1 ? parts.slice(0, 2).map((part) => part[0] ?? "") : (parts[0] ?? institution).slice(0, 2).split("");
  return letters.join("").toUpperCase() || "CB";
}

export function movementRunningCents(
  rows: { id: string; day: string; amountCents: number }[],
  id: string,
): number | null {
  const ordered = [...rows].sort((a, b) => a.day.localeCompare(b.day) || a.id.localeCompare(b.id));
  let sum = 0;
  for (const row of ordered) {
    sum += row.amountCents;
    if (row.id === id) return sum;
  }
  return null;
}
