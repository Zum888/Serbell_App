import { MISSING_RECEIPTS } from "@/lib/missing-receipts";

export function MissingPanel({ ready }: { ready: number }) {
  return (
    <div className="mx-4 mb-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4" data-testid="missing-panel">
      <p className="text-sm font-medium text-emerald-950">Comprobantes para el contador</p>
      <ul className="mt-2 space-y-1 text-sm text-emerald-950">
        {MISSING_RECEIPTS.map((item) => (
          <li key={item.id} className="flex justify-between gap-3">
            <span>{item.merchant} · {item.fileName}</span>
            <span className="tabular-nums">{item.amount}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-emerald-950" data-testid="missing-note">
        {ready === MISSING_RECEIPTS.length
          ? "Los tres tickets quedaron ligados. El contador los tiene para revisar."
          : `${ready} de ${MISSING_RECEIPTS.length} quedaron ligados. El resto sigue sin ticket.`}
      </p>
    </div>
  );
}
