"use client";

import { useMemo, useState } from "react";
import { formatUsd } from "@/lib/money";
import { rankReceipts, visibleReceipts, type ReceiptChoice } from "@/lib/receipt-rank";
import { Button } from "@/components/ui/button";

export function ReceiptPicker({
  action,
  hidden,
  choices,
  merchant,
  amountCents,
}: {
  action: string;
  hidden: Record<string, string>;
  choices: ReceiptChoice[];
  merchant: string;
  amountCents: number | null;
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState("");
  const ranked = useMemo(() => rankReceipts(choices, { merchant, amountCents }), [choices, merchant, amountCents]);
  const view = visibleReceipts(ranked, query);
  const shown = view.searched.length > 0 || query.trim() ? view.searched : [...(view.suggested ? [view.suggested] : []), ...view.similar];

  return (
    <form action={action} method="post" className="space-y-3">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <input type="hidden" name="documentId" value={picked} />
      <label className="block text-xs text-slate-500">
        Buscar por comercio o archivo
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="FleetSmarts, Shell, 203.94..."
          aria-label="Buscar comprobante"
          className="mt-1 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm"
        />
      </label>
      <div data-testid="receipt-choice" className="space-y-2">
        {view.suggested && !query.trim() ? <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Sugerido</p> : null}
        {shown.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-3 py-4 text-sm text-slate-500">
            {choices.length === 0 ? "No hay otros comprobantes libres." : "Nada coincide con esa búsqueda."}
          </p>
        ) : (
          shown.map((choice, index) => {
            const suggested = !query.trim() && view.suggested?.id === choice.id;
            const similarStart = !query.trim() && view.suggested && index === 1;
            return (
              <div key={choice.id}>
                {similarStart ? <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Parecidos</p> : null}
                <button
                  type="button"
                  onClick={() => setPicked(choice.id)}
                  className={`flex w-full items-start justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm ${
                    picked === choice.id ? "border-slate-900 bg-slate-50" : suggested ? "border-emerald-200 bg-emerald-50/50" : "border-border bg-white"
                  }`}
                >
                  <span>
                    <span className="block font-medium">{choice.merchant || choice.fileName}</span>
                    <span className="text-xs text-slate-500">{choice.fileName}</span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-slate-600">
                    {choice.amountCents !== null && choice.amountCents !== undefined ? formatUsd(choice.amountCents) : ""}
                  </span>
                </button>
              </div>
            );
          })
        )}
      </div>
      {!query.trim() && choices.length > shown.length ? (
        <p className="text-xs text-slate-500">Hay {choices.length} comprobantes. La búsqueda muestra el resto, de a ocho.</p>
      ) : null}
      <Button type="submit" variant="outline" data-testid="receipt-use" disabled={!picked}>
        Usar este
      </Button>
    </form>
  );
}
