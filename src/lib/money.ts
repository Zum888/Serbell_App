export function formatCentsPlain(cents: number): string {
  const abs = Math.abs(cents);
  const dollars = Math.trunc(abs / 100);
  const rem = abs % 100;
  return `${dollars.toLocaleString("en-US")}.${rem.toString().padStart(2, "0")}`;
}

export function formatUsd(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  return `${sign}USD ${formatCentsPlain(cents)}`;
}

export function parseMoneyToCents(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/[^\d,.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === ",") return null;
  const negative = cleaned.startsWith("-");
  const unsigned = cleaned.replace(/-/g, "");
  let normalized = unsigned;
  if (unsigned.includes(",") && unsigned.includes(".")) {
    normalized = unsigned.replace(/,/g, "");
  } else if (unsigned.includes(",")) {
    normalized = unsigned.replace(",", ".");
  }
  const [wholeRaw, fracRaw = "", extra] = normalized.split(".");
  if (extra !== undefined) return null;
  if (!/^\d+$/.test(wholeRaw || "0")) return null;
  if (fracRaw && !/^\d{1,2}$/.test(fracRaw)) return null;
  const cents =
    Number(wholeRaw || "0") * 100 + Number((fracRaw + "00").slice(0, 2));
  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}
