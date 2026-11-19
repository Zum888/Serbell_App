import Link from "next/link";
import { DUPLICATE_CHOICES, DUPLICATE_PAIR, duplicateChoice } from "@/lib/duplicates";

export function DuplicatePanel({ decision }: { decision?: string }) {
  const picked = duplicateChoice(decision);
  return (
    <div className="mx-4 mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-4" data-testid="duplicate-panel">
      <p className="text-sm font-medium text-amber-950">Dos cargos parecidos</p>
      <ul className="mt-2 space-y-1 text-sm text-amber-950">
        {DUPLICATE_PAIR.map((row) => (
          <li key={row.id} className="flex justify-between gap-3">
            <span>{row.date} · {row.merchant}</span>
            <span className="tabular-nums">{row.amount}</span>
          </li>
        ))}
      </ul>
      {picked ? (
        <p className="mt-3 text-sm text-amber-950" data-testid="duplicate-note">{picked.note}</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {DUPLICATE_CHOICES.map((choice) => (
            <Link
              key={choice.id}
              href={`/movimientos?duplicado=sunpass&decision=${choice.id}&con=chat&flujo=duplicado`}
              data-testid={`duplicate-${choice.id}`}
              className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm hover:text-slate-950"
            >
              {choice.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
