"use client";

import { CheckSquare, Search, Square } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

export type GalleryCard = {
  id: string;
  fileName: string;
  merchant: string;
  amountLabel: string;
  dateLabel: string;
  duplicate: boolean;
  conflict: boolean;
  status: string;
  statusLabel: string;
  movementId: string | null;
};

const STATUS_CHIPS: [string, string][] = [
  ["todos", "Todos"],
  ["recibido", "Recibido"],
  ["procesado", "Procesado"],
  ["listo", "Listo"],
  ["sellado", "Sellado"],
];

export function DocumentGallery({ cards }: { cards: GalleryCard[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("todos");
  const [selected, setSelected] = useState<Record<string, true>>({});
  const [preview, setPreview] = useState<string | null>(cards[0]?.id ?? null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return cards.filter((card) => {
      if (status !== "todos" && card.status !== status) return false;
      if (!needle) return true;
      return (
        card.merchant.toLowerCase().includes(needle) ||
        card.fileName.toLowerCase().includes(needle) ||
        card.amountLabel.toLowerCase().includes(needle) ||
        card.dateLabel.toLowerCase().includes(needle)
      );
    });
  }, [cards, query, status]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { todos: cards.length };
    for (const card of cards) map[card.status] = (map[card.status] ?? 0) + 1;
    return map;
  }, [cards]);

  const selectedIds = Object.keys(selected);
  const current = cards.find((card) => card.id === preview) ?? null;
  const allVisibleSelected = filtered.length > 0 && filtered.every((card) => selected[card.id]);

  function toggle(id: string) {
    setSelected((state) => {
      const nextState = { ...state };
      if (nextState[id]) delete nextState[id];
      else nextState[id] = true;
      return nextState;
    });
  }

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por comercio, archivo, importe o fecha…"
              className="h-10 w-full rounded-xl border border-border bg-white pl-9 pr-3 text-sm"
              aria-label="Buscar comprobantes"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              if (allVisibleSelected) {
                setSelected((state) => {
                  const nextState = { ...state };
                  for (const card of filtered) delete nextState[card.id];
                  return nextState;
                });
              } else {
                setSelected((state) => ({ ...state, ...Object.fromEntries(filtered.map((card) => [card.id, true as const])) }));
              }
            }}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border px-3 text-sm text-slate-600"
          >
            {allVisibleSelected ? <CheckSquare className="size-4" /> : <Square className="size-4" />}
            {allVisibleSelected ? "Quitar visibles" : "Seleccionar visibles"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {STATUS_CHIPS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatus(key)}
              className={status === key ? "rounded-full bg-slate-900 px-3 py-1.5 text-xs text-white" : "rounded-full border border-border px-3 py-1.5 text-xs text-slate-600"}
            >
              {label} ({counts[key] ?? 0})
            </button>
          ))}
        </div>

        {selectedIds.length > 0 ? (
          <div className="mt-3 flex items-center justify-between rounded-xl border border-primary/30 bg-blue-50/60 px-3 py-2 text-sm">
            <span className="font-medium text-primary">{selectedIds.length} comprobantes seleccionados</span>
            <button type="button" onClick={() => setSelected({})} className="text-xs text-slate-500">Limpiar</button>
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {filtered.length === 0 ? <p className="col-span-full py-8 text-center text-sm text-slate-500">No hay comprobantes con este filtro.</p> : null}
          {filtered.map((card) => {
            const isSelected = Boolean(selected[card.id]);
            const isPreview = preview === card.id;
            return (
              <button
                type="button"
                key={card.id}
                onClick={() => setPreview(card.id)}
                data-testid={`doc-card-${card.id}`}
                data-column={card.status}
                className={`relative rounded-xl border bg-white p-2 text-left transition ${isPreview ? "border-primary ring-1 ring-primary/40" : "border-border hover:border-slate-300"}`}
              >
                <span
                  role="checkbox"
                  aria-checked={isSelected}
                  aria-label={`Seleccionar ${card.merchant}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggle(card.id);
                  }}
                  className={`absolute right-3 top-3 z-10 flex size-5 items-center justify-center rounded-md border ${isSelected ? "border-primary bg-primary text-white" : "border-slate-300 bg-white"}`}
                >
                  {isSelected ? <CheckSquare className="size-3.5" /> : null}
                </span>
                <img
                  src={`/api/documents/${card.id}/file`}
                  alt={card.fileName}
                  loading="lazy"
                  className="h-24 w-full rounded-lg border border-border bg-slate-50 object-cover object-top"
                />
                <p className="mt-2 truncate text-sm font-medium">{card.merchant}</p>
                <p className="truncate text-xs text-slate-500">{card.amountLabel} · {card.dateLabel}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{card.statusLabel}</span>
                  {card.duplicate ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">Duplicado</span> : null}
                  {card.conflict ? <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] text-rose-700">Conflicto</span> : null}
                </div>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-slate-500">{filtered.length} de {cards.length} comprobantes</p>
      </div>

      <aside className="rounded-2xl border border-border bg-white p-4 xl:sticky xl:top-4">
        {current ? (
          <>
            <p className="text-xs text-slate-500">Vista previa</p>
            <h2 className="text-lg font-semibold">{current.merchant}</h2>
            <p className="text-sm text-slate-500">{current.amountLabel} · {current.dateLabel}</p>
            <img
              src={`/api/documents/${current.id}/file`}
              alt={current.fileName}
              className="mt-3 max-h-80 w-full rounded-xl border border-border bg-slate-50 object-contain"
            />
            <p className="mt-2 text-xs text-slate-500">{current.fileName}</p>
            <Link
              href={`/comprobantes?recibo=${current.id}${current.movementId ? `&fila=${current.movementId}` : ""}`}
              className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-primary px-3 py-2 text-sm font-medium text-white"
            >
              Abrir acciones
            </Link>
          </>
        ) : (
          <p className="text-sm text-slate-500">Elige un comprobante para verlo aquí.</p>
        )}
      </aside>
    </div>
  );
}
