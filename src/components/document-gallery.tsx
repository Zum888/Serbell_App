"use client";

import { ArrowDown, ArrowUp, CheckSquare, ChevronLeft, ChevronRight, Folder, FolderOpen, LayoutGrid, List, Search, Square, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type GalleryCard = {
  id: string;
  fileName: string;
  merchant: string;
  amountLabel: string;
  amountCents: number | null;
  dateLabel: string;
  day: string | null;
  duplicate: boolean;
  conflict: boolean;
  status: string;
  statusLabel: string;
  movementId: string | null;
};

type View = "iconos" | "lista" | "carpetas";
type SortKey = "fileName" | "merchant" | "day" | "amountCents" | "statusLabel";

const STATUS_CHIPS: [string, string][] = [
  ["todos", "Todos"],
  ["recibido", "Recibido"],
  ["procesado", "Procesado"],
  ["listo", "Listo"],
  ["sellado", "Sellado"],
];

const STATUS_DOT: Record<string, string> = {
  recibido: "bg-slate-400",
  procesado: "bg-blue-500",
  listo: "bg-amber-500",
  sellado: "bg-emerald-500",
};

const VIEWS: [View, string, typeof LayoutGrid][] = [
  ["iconos", "Íconos", LayoutGrid],
  ["lista", "Lista", List],
  ["carpetas", "Carpetas", Folder],
];

function compare(a: GalleryCard, b: GalleryCard, key: SortKey) {
  const left = a[key];
  const right = b[key];
  if (left === right) return a.fileName.localeCompare(b.fileName);
  if (left === null) return 1;
  if (right === null) return -1;
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left).localeCompare(String(right));
}

function isTyping(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  return Boolean(element?.closest("input, textarea, select, [contenteditable=true]"));
}

export function DocumentGallery({ cards }: { cards: GalleryCard[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("todos");
  const [view, setView] = useState<View>("iconos");
  const [groupBy, setGroupBy] = useState<"merchant" | "statusLabel">("merchant");
  const [folder, setFolder] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "day", dir: -1 });
  const [selected, setSelected] = useState<Record<string, true>>({});
  const [anchor, setAnchor] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(cards[0]?.id ?? null);
  const [quickLook, setQuickLook] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return cards
      .filter((card) => {
        if (status !== "todos" && card.status !== status) return false;
        if (!needle) return true;
        return [card.merchant, card.fileName, card.amountLabel, card.dateLabel].some((value) => value.toLowerCase().includes(needle));
      })
      .sort((a, b) => compare(a, b, sort.key) * sort.dir);
  }, [cards, query, status, sort]);

  const folders = useMemo(() => {
    const map = new Map<string, number>();
    for (const card of filtered) map.set(card[groupBy], (map.get(card[groupBy]) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, groupBy]);

  const activeFolder = folder && folders.some(([name]) => name === folder) ? folder : folders[0]?.[0] ?? null;
  const visible = view === "carpetas" ? filtered.filter((card) => card[groupBy] === activeFolder) : filtered;

  const counts = useMemo(() => {
    const map: Record<string, number> = { todos: cards.length };
    for (const card of cards) map[card.status] = (map[card.status] ?? 0) + 1;
    return map;
  }, [cards]);

  const selectedIds = Object.keys(selected);
  const current = cards.find((card) => card.id === preview) ?? null;
  const allVisibleSelected = visible.length > 0 && visible.every((card) => selected[card.id]);

  function choose(card: GalleryCard, event: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }) {
    setPreview(card.id);
    if (event.shiftKey && anchor) {
      const from = visible.findIndex((item) => item.id === anchor);
      const to = visible.findIndex((item) => item.id === card.id);
      if (from >= 0 && to >= 0) {
        const [start, end] = from < to ? [from, to] : [to, from];
        setSelected((state) => ({ ...state, ...Object.fromEntries(visible.slice(start, end + 1).map((item) => [item.id, true as const])) }));
        return;
      }
    }
    if (event.metaKey || event.ctrlKey) {
      toggle(card.id);
    } else {
      setSelected({ [card.id]: true });
    }
    setAnchor(card.id);
  }

  function toggle(id: string) {
    setSelected((state) => {
      const nextState = { ...state };
      if (nextState[id]) delete nextState[id];
      else nextState[id] = true;
      return nextState;
    });
    setAnchor(id);
  }

  const step = useCallback(
    (delta: number) => {
      if (visible.length === 0) return;
      const index = visible.findIndex((card) => card.id === preview);
      const nextIndex = index < 0 ? 0 : Math.min(visible.length - 1, Math.max(0, index + delta));
      const card = visible[nextIndex];
      setPreview(card.id);
      setSelected({ [card.id]: true });
      setAnchor(card.id);
      listRef.current?.querySelector(`[data-card="${card.id}"]`)?.scrollIntoView({ block: "nearest" });
    },
    [visible, preview],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (isTyping(event.target)) return;
      if (event.key === " ") {
        if (!preview) return;
        event.preventDefault();
        setQuickLook((open) => !open);
      } else if (event.key === "Escape") {
        setQuickLook(false);
      } else if (event.key === "ArrowRight" || (event.key === "ArrowDown" && view !== "iconos")) {
        event.preventDefault();
        step(1);
      } else if (event.key === "ArrowLeft" || (event.key === "ArrowUp" && view !== "iconos")) {
        event.preventDefault();
        step(-1);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        step(4);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        step(-4);
      } else if (event.key === "a" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSelected(Object.fromEntries(visible.map((card) => [card.id, true as const])));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview, step, view, visible]);

  function sortBy(key: SortKey) {
    setSort((state) => (state.key === key ? { key, dir: state.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  }

  const icons = (items: GalleryCard[]) => (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {items.map((card) => {
        const isSelected = Boolean(selected[card.id]);
        return (
          <button
            type="button"
            key={card.id}
            data-card={card.id}
            onClick={(event) => choose(card, event)}
            onDoubleClick={() => setQuickLook(true)}
            data-testid={`doc-card-${card.id}`}
            data-column={card.status}
            className={`relative rounded-xl border p-2 text-left transition ${
              isSelected ? "border-primary bg-blue-50/70 ring-2 ring-primary/30" : preview === card.id ? "border-primary/50 bg-white" : "border-border bg-white hover:border-slate-300"
            }`}
          >
            <span
              role="checkbox"
              aria-checked={isSelected}
              aria-label={`Seleccionar ${card.merchant}`}
              onClick={(event) => {
                event.stopPropagation();
                toggle(card.id);
              }}
              className={`absolute right-3 top-3 z-10 flex size-5 items-center justify-center rounded-md border ${isSelected ? "border-primary bg-primary text-white" : "border-slate-300 bg-white/90"}`}
            >
              {isSelected ? <CheckSquare className="size-3.5" /> : null}
            </span>
            <img
              src="/demo/comprobante.svg"
              alt={card.fileName}
              loading="lazy"
              className="h-28 w-full rounded-lg border border-border bg-slate-50 object-cover object-top"
            />
            <p className="mt-2 truncate text-sm font-medium">{card.merchant}</p>
            <p className="truncate text-xs text-slate-500">{card.amountLabel} · {card.dateLabel}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                <span className={`size-1.5 rounded-full ${STATUS_DOT[card.status] ?? "bg-slate-400"}`} />
                {card.statusLabel}
              </span>
              {card.duplicate ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">Duplicado</span> : null}
              {card.conflict ? <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] text-rose-700">Conflicto</span> : null}
            </div>
          </button>
        );
      })}
    </div>
  );

  const header = (key: SortKey, label: string, align = "text-left") => (
    <th className={`px-3 py-2 font-medium ${align}`}>
      <button type="button" onClick={() => sortBy(key)} className="inline-flex items-center gap-1 hover:text-slate-900">
        {label}
        {sort.key === key ? sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : null}
      </button>
    </th>
  );

  const list = (items: GalleryCard[]) => (
    <div className="overflow-hidden rounded-xl border border-border bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-slate-50/80 text-xs text-slate-500">
          <tr>
            <th className="w-8 px-3 py-2" />
            {header("fileName", "Nombre")}
            {header("merchant", "Comercio")}
            {header("day", "Fecha")}
            {header("amountCents", "Importe", "text-right")}
            {header("statusLabel", "Estado")}
          </tr>
        </thead>
        <tbody>
          {items.map((card, index) => {
            const isSelected = Boolean(selected[card.id]);
            return (
              <tr
                key={card.id}
                data-card={card.id}
                data-testid={`doc-row-${card.id}`}
                onClick={(event) => choose(card, event)}
                onDoubleClick={() => setQuickLook(true)}
                className={`cursor-default select-none ${isSelected ? "bg-primary text-white" : index % 2 ? "bg-slate-50/60" : "bg-white"}`}
              >
                <td className="px-3 py-1.5">
                  <span
                    role="checkbox"
                    aria-checked={isSelected}
                    aria-label={`Seleccionar ${card.merchant}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggle(card.id);
                    }}
                    className={`flex size-4 items-center justify-center rounded border ${isSelected ? "border-white bg-white text-primary" : "border-slate-300 bg-white"}`}
                  >
                    {isSelected ? <CheckSquare className="size-3" /> : null}
                  </span>
                </td>
                <td className="px-3 py-1.5">
                  <span className="flex items-center gap-2">
                    <img src="/demo/comprobante.svg" alt="" loading="lazy" className="size-6 rounded border border-border bg-slate-50 object-cover" />
                    <span className="truncate">{card.fileName}</span>
                  </span>
                </td>
                <td className="px-3 py-1.5">{card.merchant}</td>
                <td className={`px-3 py-1.5 ${isSelected ? "" : "text-slate-500"}`}>{card.dateLabel}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{card.amountLabel}</td>
                <td className="px-3 py-1.5">
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    <span className={`size-2 rounded-full ${STATUS_DOT[card.status] ?? "bg-slate-400"}`} />
                    {card.statusLabel}
                    {card.duplicate ? " · Duplicado" : ""}
                    {card.conflict ? " · Conflicto" : ""}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por comercio, archivo, importe o fecha…"
              className="h-10 w-full rounded-xl border border-border bg-white pl-9 pr-3 text-sm"
              aria-label="Buscar comprobantes"
            />
          </div>
          <div className="inline-flex rounded-xl border border-border bg-slate-100 p-0.5" role="tablist" aria-label="Vista">
            {VIEWS.map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={view === key}
                data-testid={`view-${key}`}
                onClick={() => setView(key)}
                title={label}
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium ${view === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              if (allVisibleSelected) {
                setSelected((state) => {
                  const nextState = { ...state };
                  for (const card of visible) delete nextState[card.id];
                  return nextState;
                });
              } else {
                setSelected((state) => ({ ...state, ...Object.fromEntries(visible.map((card) => [card.id, true as const])) }));
              }
            }}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border bg-white px-3 text-sm text-slate-600"
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
              className={status === key ? "rounded-full bg-slate-900 px-3 py-1.5 text-xs text-white" : "rounded-full border border-border bg-white px-3 py-1.5 text-xs text-slate-600"}
            >
              {label} ({counts[key] ?? 0})
            </button>
          ))}
        </div>

        {selectedIds.length > 1 ? (
          <div className="mt-3 flex items-center justify-between rounded-xl border border-primary/30 bg-blue-50/60 px-3 py-2 text-sm">
            <span className="font-medium text-primary">{selectedIds.length} comprobantes seleccionados</span>
            <button type="button" onClick={() => setSelected({})} className="text-xs text-slate-500">Limpiar</button>
          </div>
        ) : null}

        <div ref={listRef} className="mt-4">
          {filtered.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No hay comprobantes con este filtro.</p> : null}
          {filtered.length > 0 && view === "iconos" ? icons(visible) : null}
          {filtered.length > 0 && view === "lista" ? list(visible) : null}
          {filtered.length > 0 && view === "carpetas" ? (
            <div className="grid items-start gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
              <aside className="rounded-xl border border-border bg-slate-50/80 p-2">
                <div className="mb-2 flex rounded-lg bg-slate-200/70 p-0.5 text-[11px]">
                  {([["merchant", "Comercio"], ["statusLabel", "Estado"]] as const).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setGroupBy(key);
                        setFolder(null);
                      }}
                      className={`flex-1 rounded-md px-2 py-1 font-medium ${groupBy === key ? "bg-white shadow-sm" : "text-slate-500"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <ul className="max-h-[520px] space-y-0.5 overflow-y-auto">
                  {folders.map(([name, count]) => {
                    const active = name === activeFolder;
                    return (
                      <li key={name}>
                        <button
                          type="button"
                          data-testid="doc-folder"
                          onClick={() => setFolder(name)}
                          className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm ${active ? "bg-primary text-white" : "hover:bg-slate-200/60"}`}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            {active ? <FolderOpen className="size-4 shrink-0" /> : <Folder className="size-4 shrink-0 text-blue-500" />}
                            <span className="truncate">{name}</span>
                          </span>
                          <span className={`text-xs tabular-nums ${active ? "text-white/80" : "text-slate-400"}`}>{count}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </aside>
              <div>
                <p className="mb-2 text-sm font-semibold">{activeFolder}</p>
                {icons(visible)}
              </div>
            </div>
          ) : null}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {visible.length} de {cards.length} comprobantes · Espacio: vista rápida · Flechas: moverte · ⌘/Shift + clic: varios
        </p>
      </div>

      <aside className="rounded-2xl border border-border bg-white p-4 xl:sticky xl:top-4">
        {current ? (
          <>
            <p className="text-xs text-slate-500">Vista previa</p>
            <h2 className="text-lg font-semibold">{current.merchant}</h2>
            <p className="text-sm text-slate-500">{current.amountLabel} · {current.dateLabel}</p>
            <button type="button" onClick={() => setQuickLook(true)} className="mt-3 block w-full" title="Vista rápida (espacio)">
              <img
                src="/demo/comprobante.svg"
                alt={current.fileName}
                className="max-h-80 w-full rounded-xl border border-border bg-slate-50 object-contain"
              />
            </button>
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

      {quickLook && current ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Vista rápida de ${current.fileName}`}
          data-testid="quick-look"
          onClick={() => setQuickLook(false)}
          className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/60 p-6 backdrop-blur-sm"
        >
          <div onClick={(event) => event.stopPropagation()} className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{current.fileName}</p>
                <p className="text-xs text-slate-500">{current.merchant} · {current.amountLabel} · {current.dateLabel} · {current.statusLabel}</p>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => step(-1)} aria-label="Anterior" className="rounded-md p-1.5 hover:bg-slate-100"><ChevronLeft className="size-4" /></button>
                <button type="button" onClick={() => step(1)} aria-label="Siguiente" className="rounded-md p-1.5 hover:bg-slate-100"><ChevronRight className="size-4" /></button>
                <button type="button" onClick={() => setQuickLook(false)} aria-label="Cerrar" className="rounded-md p-1.5 hover:bg-slate-100"><X className="size-4" /></button>
              </div>
            </div>
            <div className="bg-slate-100 p-4">
              <img src="/demo/comprobante.svg" alt={current.fileName} className="mx-auto max-h-[65vh] rounded-lg bg-white object-contain shadow" />
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs text-slate-500">
              <span>Espacio o Esc para cerrar · ← → para moverte</span>
              <Link href={`/comprobantes?recibo=${current.id}${current.movementId ? `&fila=${current.movementId}` : ""}`} className="font-medium text-primary">
                Abrir acciones
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
