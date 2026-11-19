import { normalizeMerchant } from "@/lib/matching";

export type ReceiptChoice = {
  id: string;
  fileName: string;
  merchant?: string | null;
  amountCents?: number | null;
};

export type RankedReceipt = ReceiptChoice & { score: number };

export function rankReceipts(choices: ReceiptChoice[], movement: { merchant: string; amountCents: number | null }): RankedReceipt[] {
  const merchant = normalizeMerchant(movement.merchant);
  const target = movement.amountCents === null ? null : Math.abs(movement.amountCents);
  return choices
    .map((choice) => {
      const haystack = normalizeMerchant(`${choice.merchant ?? ""} ${choice.fileName}`);
      let score = 0;
      if (merchant && haystack.includes(merchant)) score += 50;
      else if (merchant) {
        const token = merchant.split(" ").find((part) => part.length > 3);
        if (token && haystack.includes(token)) score += 20;
      }
      if (target !== null && choice.amountCents !== null && choice.amountCents !== undefined) {
        const amount = Math.abs(choice.amountCents);
        if (amount === target) score += 40;
        else if (target > 0 && Math.abs(amount - target) / target <= 0.02) score += 15;
      }
      return { ...choice, score };
    })
    .sort((a, b) => b.score - a.score || a.fileName.localeCompare(b.fileName, "es"));
}

export function visibleReceipts(ranked: RankedReceipt[], query: string): { suggested: RankedReceipt | null; similar: RankedReceipt[]; searched: RankedReceipt[] } {
  const needle = query.trim().toLowerCase();
  if (needle) {
    const searched = ranked
      .filter((choice) => `${choice.fileName} ${choice.merchant ?? ""}`.toLowerCase().includes(needle))
      .slice(0, 8);
    return { suggested: null, similar: [], searched };
  }
  const suggested = ranked[0] && ranked[0].score >= 40 ? ranked[0] : null;
  const rest = suggested ? ranked.slice(1) : ranked;
  const similar = rest.filter((choice) => choice.score > 0).slice(0, 3);
  const filler = similar.length > 0 ? [] : rest.slice(0, 3);
  return { suggested, similar: similar.length > 0 ? similar : filler, searched: [] };
}
