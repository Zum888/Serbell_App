"use client";

import { Check, ChevronDown, ChevronRight, Plus, Search } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type CategoryNode = { id: string; name: string; children?: CategoryNode[] };

type Flat = { id: string; path: string[]; ids: string[] };

const COLUMN_WIDTH = 232;

function flatten(nodes: CategoryNode[], trail: CategoryNode[] = []): Flat[] {
  return nodes.flatMap((node) => {
    const chain = [...trail, node];
    const self = trail.length > 0 ? [{ id: node.id, path: chain.map((item) => item.name), ids: chain.map((item) => item.id) }] : [];
    return [...self, ...flatten(node.children ?? [], chain)];
  });
}

export function pathOf(nodes: CategoryNode[], id: string): CategoryNode[] {
  for (const node of nodes) {
    if (node.id === id) return [node];
    const inner = pathOf(node.children ?? [], id);
    if (inner.length) return [node, ...inner];
  }
  return [];
}

export function CategoryMenu({
  tree,
  value,
  disabled,
  attention,
  leaf,
  placeholder = "Elegir categoría",
  testId,
  onPick,
  onAdd,
}: {
  tree: CategoryNode[];
  value: string;
  disabled?: boolean;
  attention?: boolean;
  leaf?: boolean;
  placeholder?: string;
  testId?: string;
  onPick: (id: string) => void;
  onAdd: (parentId: string | null, name: string) => Promise<CategoryNode | null>;
}) {
  const [open, setOpen] = useState(false);
  const [trail, setTrail] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState<{ level: number; parentId: string | null } | null>(null);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);

  const selectedPath = useMemo(() => pathOf(tree, value), [tree, value]);
  const selectedIds = new Set(selectedPath.map((node) => node.id));
  const label = selectedPath.length > 1
    ? (leaf ? selectedPath[selectedPath.length - 1]?.name ?? null : selectedPath.map((node) => node.name).join(" › "))
    : null;

  const columns = useMemo(() => {
    const result: { parentId: string | null; parentName: string | null; nodes: CategoryNode[] }[] = [{ parentId: null, parentName: null, nodes: tree }];
    let level = tree;
    for (const id of trail) {
      const node = level.find((item) => item.id === id);
      if (!node) break;
      result.push({ parentId: node.id, parentName: node.name, nodes: node.children ?? [] });
      level = node.children ?? [];
    }
    return result;
  }, [tree, trail]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return flatten(tree).filter((item) => item.path.join(" ").toLowerCase().includes(needle)).slice(0, 12);
  }, [tree, query]);

  function close() {
    setOpen(false);
    setQuery("");
    setAdding(null);
    setNewName("");
    setError(null);
  }

  function place() {
    const rect = button.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.max(columns.length, 2) * (COLUMN_WIDTH + 6);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const below = window.innerHeight - rect.bottom;
    setAnchor(below < 300 && rect.top > below ? { bottom: window.innerHeight - rect.top + 4, left } : { top: rect.bottom + 4, left });
  }

  useLayoutEffect(() => {
    if (open) place();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, columns.length]);

  useEffect(() => {
    if (open && anchor) search.current?.focus({ preventScroll: true });
  }, [open, anchor]);

  useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) {
      const target = event.target as Node;
      if (panel.current?.contains(target) || button.current?.contains(target)) return;
      close();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    function onScroll(event: Event) {
      if (panel.current?.contains(event.target as Node)) return;
      place();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  function pick(id: string) {
    onPick(id);
    close();
  }

  async function create() {
    if (!adding) return;
    const name = newName.trim();
    if (name.length < 2) {
      setError("El nombre es demasiado corto.");
      return;
    }
    setBusy(true);
    setError(null);
    const node = await onAdd(adding.parentId, name).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "No se pudo agregar.");
      return null;
    });
    setBusy(false);
    if (!node) return;
    setNewName("");
    setAdding(null);
    if (adding.parentId) pick(node.id);
    else setTrail([node.id]);
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        disabled={disabled}
        data-testid={testId}
        onClick={() => {
          if (open) return close();
          setTrail(selectedPath.slice(0, -1).map((node) => node.id));
          setOpen(true);
        }}
        className={`inline-flex h-8 max-w-[260px] items-center gap-1.5 rounded-lg border px-2.5 text-xs transition disabled:opacity-50 ${
          label
            ? "border-border bg-white text-slate-700 hover:border-slate-300"
            : attention
              ? "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300"
              : "border-border bg-white text-slate-500 hover:border-slate-300"
        } ${open ? "ring-2 ring-primary/30" : ""}`}
      >
        <span className="truncate">{label ?? placeholder}</span>
        <ChevronDown className="size-3.5 shrink-0 opacity-60" />
      </button>
      {open && anchor ? createPortal(
        <div
          ref={panel}
          role="menu"
          style={{ position: "fixed", top: anchor.top, bottom: anchor.bottom, left: anchor.left, zIndex: 60 }}
          className="flex items-start gap-1.5"
        >
          {(query.trim() ? [columns[0]] : columns).map((column, level) => (
            <div
              key={`${column.parentId ?? "root"}-${level}`}
              style={{ width: COLUMN_WIDTH }}
              className="max-h-[320px] overflow-y-auto rounded-xl border border-slate-200 bg-white/95 p-1 text-sm shadow-xl shadow-slate-900/10 backdrop-blur"
            >
              {level === 0 ? (
                <div className="relative mb-1">
                  <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={search}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar categoría…"
                    aria-label="Buscar categoría"
                    className="h-8 w-full rounded-lg bg-slate-100 pl-7 pr-2 text-xs outline-none focus:bg-white focus:ring-1 focus:ring-primary/40"
                  />
                </div>
              ) : (
                <p className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{column.parentName}</p>
              )}
              {level === 0 && query.trim() ? (
                matches.length === 0 ? (
                  <p className="px-2 py-3 text-xs text-slate-500">Sin resultados.</p>
                ) : (
                  matches.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      onClick={() => pick(item.id)}
                      className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-primary hover:text-white"
                    >
                      <span className="truncate">{item.path.join(" › ")}</span>
                      {item.id === value ? <Check className="size-3.5 shrink-0" /> : null}
                    </button>
                  ))
                )
              ) : (
                <>
                  {column.nodes.length === 0 ? <p className="px-2 py-2 text-xs text-slate-500">Todavía no hay subcategorías.</p> : null}
                  {column.nodes.map((node) => {
                    const branch = level === 0 || (node.children?.length ?? 0) > 0;
                    const active = trail[level] === node.id;
                    return (
                      <button
                        key={node.id}
                        type="button"
                        role="menuitem"
                        onMouseEnter={() => setTrail(branch ? [...trail.slice(0, level), node.id] : trail.slice(0, level))}
                        onClick={() => (branch ? setTrail([...trail.slice(0, level), node.id]) : pick(node.id))}
                        className={`group flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs ${
                          active ? "bg-primary text-white" : "hover:bg-slate-100"
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="w-3.5 shrink-0">{selectedIds.has(node.id) ? <Check className="size-3.5" /> : null}</span>
                          <span className="truncate">{node.name}</span>
                        </span>
                        {branch ? <ChevronRight className={`size-3.5 shrink-0 ${active ? "" : "text-slate-400"}`} /> : null}
                      </button>
                    );
                  })}
                  <div className="mt-1 border-t border-slate-100 pt-1">
                    {adding?.level === level ? (
                      <div className="space-y-1 p-1">
                        <input
                          autoFocus
                          value={newName}
                          onChange={(event) => setNewName(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void create();
                            }
                          }}
                          placeholder={level === 0 ? "Nombre de la categoría" : "Nombre de la subcategoría"}
                          aria-label="Nombre de la nueva categoría"
                          className="h-7 w-full rounded-md border border-border px-2 text-xs"
                        />
                        <div className="flex items-center gap-2">
                          <button type="button" disabled={busy} onClick={() => void create()} className="rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white disabled:opacity-50">
                            {busy ? "Creando…" : "Crear"}
                          </button>
                          <button type="button" onClick={() => setAdding(null)} className="text-[11px] text-slate-500">Cancelar</button>
                        </div>
                        {error ? <p className="text-[11px] text-rose-700">{error}</p> : null}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setAdding({ level, parentId: column.parentId });
                          setNewName("");
                          setError(null);
                        }}
                        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-primary hover:bg-blue-50"
                      >
                        <Plus className="size-3.5" />
                        {level === 0 ? "Nueva categoría" : `Nueva en ${column.parentName}`}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>,
        document.body,
      ) : null}
    </>
  );
}
