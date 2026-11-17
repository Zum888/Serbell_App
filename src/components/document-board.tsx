import Link from "next/link";
import { TicketThumb } from "@/components/ticket-thumb";

export type DocumentCard = {
  id: string;
  fileName: string;
  merchant: string;
  amountLabel: string;
  dateLabel: string;
  duplicate: boolean;
  conflict: boolean;
  movement: { id: string; label: string } | null;
  suggestionLabel: string | null;
};

const columns = [
  ["recibido", "Recibido"],
  ["procesado", "Procesado por Serbell"],
  ["listo", "Listo para el contador"],
  ["sellado", "Aprobado y sellado"],
] as const;

export function DocumentBoard({
  groups,
  activeId,
}: {
  groups: Record<(typeof columns)[number][0], DocumentCard[]>;
  activeId?: string;
}) {
  return (
    <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-4">
      {columns.map(([key, title]) => {
        const cards = groups[key];
        return (
          <section key={key} data-testid={`column-${key}`} className="rounded-2xl border border-border bg-white">
            <div className="flex items-baseline justify-between gap-2 border-b border-border px-3 py-3">
              <h2 className="text-sm font-semibold">{title}</h2>
              <span data-testid={`count-${key}`} className="text-sm font-semibold text-slate-500">{cards.length}</span>
            </div>
            <div className="max-h-[calc(100vh-220px)] space-y-2 overflow-y-auto p-2">
              {cards.length === 0 ? <p className="px-1 py-2 text-xs text-slate-500">Ninguno</p> : null}
              {cards.map((card) => {
                const params = new URLSearchParams();
                params.set("recibo", card.id);
                if (card.movement) params.set("fila", card.movement.id);
                return (
                  <Link
                    key={card.id}
                    href={`/comprobantes?${params}`}
                    data-testid={`doc-card-${card.id}`}
                    data-column={key}
                    className={activeId === card.id ? "block rounded-xl border border-primary bg-white p-2" : "block rounded-xl border border-border bg-white p-2 hover:border-slate-300"}
                  >
                    <TicketThumb id={card.id} alt={card.fileName} />
                    <p className="mt-2 text-sm font-medium">{card.merchant}</p>
                    <p className="text-xs text-slate-500">{card.amountLabel} · {card.dateLabel}</p>
                    {card.movement ? (
                      <p data-testid={`chip-${card.id}`} className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{card.movement.label}</p>
                    ) : card.suggestionLabel ? (
                      <p className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{card.suggestionLabel}</p>
                    ) : (
                      <p className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Sin movimiento</p>
                    )}
                    {card.duplicate ? <p data-testid="dup-mark" className="mt-1 text-xs text-amber-700">Duplicado</p> : null}
                    {card.conflict ? <p data-testid="conflict-mark" className="mt-1 text-xs text-red-700">Conflicto</p> : null}
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
