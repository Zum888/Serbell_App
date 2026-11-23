"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatUsd } from "@/lib/money";

type Node = { id: string; name: string; children: Node[] };

export function CategoryTree({
  companyId,
  tree,
  amounts,
}: {
  companyId: string;
  tree: Node[];
  amounts: Record<string, number>;
}) {
  const router = useRouter();
  const [nodes, setNodes] = useState(tree);
  const [adding, setAdding] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  async function rename(id: string, name: string, previous: string) {
    const next = name.trim();
    if (next.length < 2 || next === previous) return;
    setError(null);
    const response = await fetch(`/api/categories/${id}`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ name: next }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error || "No se pudo guardar el nombre.");
      return;
    }
    setNodes((current) => renameNode(current, id, next));
  }

  async function addChild(parentId: string) {
    const name = draft.trim();
    if (name.length < 2) return;
    setError(null);
    const response = await fetch("/api/categories", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ companyId, parentId, name }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string; id?: string; name?: string };
    if (!response.ok || !body.id) {
      setError(body.error || "No se pudo agregar.");
      return;
    }
    setNodes((current) => addNode(current, parentId, { id: body.id!, name: body.name ?? name, children: [] }));
    setAdding(null);
    setDraft("");
    router.refresh();
  }

  async function move(id: string, parentId: string) {
    setError(null);
    const previous = nodes;
    setNodes((current) => moveNode(current, id, parentId) ?? current);
    const response = await fetch(`/api/categories/${id}`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ parentId }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setNodes(previous);
      setError(body.error || "No se pudo mover.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-rose-700" data-testid="server-error">{error}</p> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {nodes.map((parent) => (
          <article
            key={parent.id}
            className={`rounded-2xl border bg-white ${over === parent.id ? "border-stone-900" : "border-border"}`}
            onDragOver={(event) => {
              event.preventDefault();
              setOver(parent.id);
            }}
            onDragLeave={() => setOver((current) => (current === parent.id ? null : current))}
            onDrop={(event) => {
              event.preventDefault();
              setOver(null);
              const id = event.dataTransfer.getData("text/plain");
              if (id) void move(id, parent.id);
            }}
          >
            <header className="flex items-center gap-2 px-4 py-3">
              <NameField label={parent.name} onSave={(value) => void rename(parent.id, value, parent.name)} />
              <button
                type="button"
                aria-label={`Agregar subcategoría en ${parent.name}`}
                onClick={() => {
                  setAdding(parent.id);
                  setDraft("");
                }}
                className="grid size-7 place-items-center rounded-full text-slate-500 hover:bg-[#efede8]"
              >
                <Plus className="size-4" />
              </button>
              <span className="text-sm font-medium tabular-nums text-slate-700">{formatUsd(amounts[parent.id] ?? 0)}</span>
            </header>
            {adding === parent.id ? (
              <AddRow
                value={draft}
                onChange={setDraft}
                onSave={() => void addChild(parent.id)}
                placeholder="Nueva subcategoría"
              />
            ) : null}
            <ul className="divide-y divide-border border-t border-border">
              {parent.children.length === 0 ? <li className="px-4 py-3 text-xs text-slate-400">Sin subcategorías todavía.</li> : null}
              {parent.children.map((child) => (
                <li
                  key={child.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/plain", child.id);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  className="px-4 py-2"
                  title="Arrastra esta subcategoría a otra categoría"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-slate-300">—</span>
                    <NameField label={child.name} onSave={(value) => void rename(child.id, value, child.name)} />
                    <button
                      type="button"
                      aria-label={`Agregar detalle en ${child.name}`}
                      onClick={() => {
                        setAdding(child.id);
                        setDraft("");
                      }}
                      className="grid size-7 place-items-center rounded-full text-slate-400 hover:bg-[#efede8]"
                    >
                      <Plus className="size-4" />
                    </button>
                    <span className="text-xs tabular-nums text-slate-500">{formatUsd(amounts[child.id] ?? 0)}</span>
                  </div>
                  {adding === child.id ? (
                    <AddRow value={draft} onChange={setDraft} onSave={() => void addChild(child.id)} placeholder="Nuevo detalle" />
                  ) : null}
                  {child.children.length > 0 ? (
                    <ul className="mt-1 space-y-1 pl-6">
                      {child.children.map((detail) => (
                        <li key={detail.id} className="flex items-center gap-2">
                          <span className="text-slate-300">··</span>
                          <NameField label={detail.name} onSave={(value) => void rename(detail.id, value, detail.name)} />
                          <span className="text-xs tabular-nums text-slate-500">{formatUsd(amounts[detail.id] ?? 0)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}

function NameField({ label, onSave }: { label: string; onSave: (value: string) => void }) {
  const [value, setValue] = useState(label);
  return (
    <input
      value={value}
      aria-label={`Nombre de ${label}`}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onSave(value);
          event.currentTarget.blur();
        }
      }}
      className="h-8 min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
    />
  );
}

function AddRow({
  value,
  onChange,
  onSave,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  placeholder: string;
}) {
  return (
    <form
      className="flex items-center gap-2 px-4 py-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <input
        autoFocus
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-8 min-w-0 flex-1 rounded-lg border border-[#e6e1d8] px-2 text-sm"
      />
      <button type="submit" className="text-sm font-medium text-stone-800">
        Agregar
      </button>
    </form>
  );
}

function renameNode(nodes: Node[], id: string, name: string): Node[] {
  return nodes.map((node) =>
    node.id === id ? { ...node, name } : { ...node, children: renameNode(node.children, id, name) },
  );
}

function addNode(nodes: Node[], parentId: string, child: Node): Node[] {
  return nodes.map((node) =>
    node.id === parentId ? { ...node, children: [...node.children, child] } : { ...node, children: addNode(node.children, parentId, child) },
  );
}

function moveNode(nodes: Node[], id: string, parentId: string): Node[] | null {
  let moved: Node | null = null;
  const stripped = nodes.map((parent) => ({
    ...parent,
    children: parent.children.filter((child) => {
      if (child.id === id) {
        moved = child;
        return false;
      }
      return true;
    }),
  }));
  if (!moved) return null;
  return stripped.map((parent) => (parent.id === parentId ? { ...parent, children: [...parent.children, moved!] } : parent));
}
