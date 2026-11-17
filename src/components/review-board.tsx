import Link from "next/link";
import { TicketThumb } from "@/components/ticket-thumb";
import { Button } from "@/components/ui/button";

export type ReviewCard = {
  id: string;
  companyName: string;
  merchant: string;
  amountLabel: string;
  dateLabel: string;
  documentId: string | null;
  documentName: string | null;
  duplicate: boolean;
  conflict: boolean;
  canSeal: boolean;
};

const columns = [
  ["revisar", "Por revisar"],
  ["cliente", "Esperando cliente"],
  ["aprobar", "Listo para aprobar"],
  ["sellado", "Sellado"],
] as const;

export function ReviewBoard({
  groups,
  activeId,
}: {
  groups: Record<(typeof columns)[number][0], ReviewCard[]>;
  activeId?: string;
}) {
  return (
    <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-4">
      {columns.map(([key, title]) => {
        const cards = groups[key];
        return (
          <section key={key} data-testid={`review-column-${key}`} className="rounded-2xl border border-border bg-white">
            <div className="flex items-baseline justify-between gap-2 border-b border-border px-3 py-3">
              <h2 className="text-sm font-semibold">{title}</h2>
              <span data-testid={`review-count-${key}`} className="text-sm font-semibold text-slate-500">{cards.length}</span>
            </div>
            <div className="max-h-[calc(100vh-220px)] space-y-2 overflow-y-auto p-2">
              {cards.length === 0 ? <p className="px-1 py-2 text-xs text-slate-500">Ninguno</p> : null}
              {cards.map((card) => {
                const params = new URLSearchParams({ tipo: "revisar", movimiento: card.id });
                const back = `/firma/lista?${params}`;
                return (
                  <article
                    key={card.id}
                    data-testid={`review-card-${card.id}`}
                    data-column={key}
                    className={activeId === card.id ? "rounded-xl border border-primary bg-white p-2" : "rounded-xl border border-border bg-white p-2"}
                  >
                    <Link href={back} className="block">
                      {card.documentId ? <TicketThumb id={card.documentId} alt={card.documentName ?? card.merchant} /> : (
                        <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border bg-slate-50 text-xs text-slate-400">Sin comprobante</div>
                      )}
                      <p className="mt-2 text-sm font-medium">{card.merchant}</p>
                      <p className="text-xs text-slate-500">{card.amountLabel} · {card.dateLabel}</p>
                      <p className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{card.companyName}</p>
                      {card.documentName ? <p className="mt-1 text-xs text-slate-500">{card.documentName}</p> : null}
                      {card.duplicate ? <p data-testid="dup-mark" className="mt-1 text-xs text-amber-700">Duplicado</p> : null}
                      {card.conflict ? <p data-testid="conflict-mark" className="mt-1 text-xs text-red-700">Conflicto</p> : null}
                    </Link>
                    {card.canSeal ? (
                      <form action={`/api/transactions/${card.id}/seal`} method="post" className="mt-2">
                        <input type="hidden" name="next" value={back} />
                        <Button type="submit" data-testid={`seal-${card.id}`}>Aprobar y sellar</Button>
                      </form>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
