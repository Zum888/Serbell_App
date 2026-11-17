import { normalizeMerchant } from "@/lib/matching";

export function isPendingMovement(row: {
  sealedAt: Date | null;
  accountingState: string;
  documentState: string;
}): boolean {
  if (row.sealedAt) return false;
  return row.accountingState === "Uncategorized" || row.documentState === "Suggested" || row.documentState === "Conflict";
}

export type FocusHistory = {
  id: string;
  merchant: string;
  amountCents: number;
  subcategoryId: string;
  label: string;
  postedOn: string;
};

export type FocusSuggestion = {
  subcategoryId: string;
  label: string;
  reason: string;
};

function tally(rows: FocusHistory[]) {
  const groups = new Map<string, { subcategoryId: string; label: string; count: number; postedOn: string }>();
  for (const row of rows) {
    const current = groups.get(row.subcategoryId);
    if (!current) {
      groups.set(row.subcategoryId, {
        subcategoryId: row.subcategoryId,
        label: row.label,
        count: 1,
        postedOn: row.postedOn,
      });
      continue;
    }
    current.count += 1;
    if (row.postedOn > current.postedOn) current.postedOn = row.postedOn;
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || b.postedOn.localeCompare(a.postedOn) || a.label.localeCompare(b.label, "es"));
}

export function rankSuggestions(input: {
  transactionId: string;
  merchant: string;
  amountCents: number;
  history: FocusHistory[];
  rules: { merchant: string; subcategoryId: string; label: string; postedOn: string }[];
  extraction: { subcategoryId: string; label: string } | null;
}): FocusSuggestion[] {
  const suggestions: FocusSuggestion[] = [];
  const seen = new Set<string>();
  const add = (subcategoryId: string, label: string, reason: string) => {
    if (!subcategoryId || seen.has(subcategoryId) || suggestions.length >= 3) return;
    seen.add(subcategoryId);
    suggestions.push({ subcategoryId, label, reason });
  };
  const merchant = normalizeMerchant(input.merchant);
  const others = input.history.filter((row) => row.id !== input.transactionId && row.subcategoryId);
  const same = tally(others.filter((row) => normalizeMerchant(row.merchant) === merchant));
  for (const group of same) {
    const reason = group.count === 1
      ? `Otro movimiento de ${input.merchant} en esta empresa está en ${group.label}.`
      : `${group.count} movimientos de ${input.merchant} en esta empresa están en ${group.label}.`;
    add(group.subcategoryId, group.label, reason);
  }
  const rules = input.rules
    .filter((rule) => normalizeMerchant(rule.merchant) === merchant)
    .sort((a, b) => b.postedOn.localeCompare(a.postedOn));
  for (const rule of rules) {
    add(rule.subcategoryId, rule.label, `Una regla guardada de esta empresa clasifica a ${input.merchant} como ${rule.label}.`);
  }
  if (input.extraction) {
    add(input.extraction.subcategoryId, input.extraction.label, `El comprobante sugiere ${input.extraction.label}.`);
  }
  const sign = Math.sign(input.amountCents);
  const sameSign = tally(others.filter((row) => Math.sign(row.amountCents) === sign));
  const kind = sign < 0 ? "gastos" : "ingresos";
  for (const group of sameSign) {
    add(
      group.subcategoryId,
      group.label,
      group.count === 1
        ? `Otro ${kind.slice(0, -1)} de esta empresa está en ${group.label}.`
        : `${group.count} ${kind} de esta empresa están en ${group.label}.`,
    );
  }
  return suggestions;
}
