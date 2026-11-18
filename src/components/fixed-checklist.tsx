"use client";

import { Check, Landmark, Plus, Tag, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatDay } from "@/lib/dates";
import type { FixedStatus } from "@/lib/fixed";
import { formatUsd } from "@/lib/money";
import type { FixedRowView } from "@/server/planning";

type Option = { id: string; label: string };

const STATUS_STYLE: Record<FixedStatus, string> = {
  pagado: "bg-emerald-50 text-emerald-700",
  pendiente: "bg-slate-100 text-slate-600",
  vencido: "bg-rose-50 text-rose-700",
};

const STATUS_LABEL: Record<FixedStatus, string> = {
  pagado: "Pagado",
  pendiente: "Pendiente",
  vencido: "Vencido",
};

const FILTERS: [string, string][] = [
  ["todos", "Todos"],
  ["faltan", "Faltan"],
  ["pagado", "Pagados"],
];

export function FixedChecklist({
  monthLabel,
  referenceDay,
  rows: initialRows,
  accounts,
  categories,
}: {
  monthLabel: string;
  referenceDay: number;
  rows: FixedRowView[];
  accounts: Option[];
  categories: Option[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [filter, setFilter] = useState("todos");
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const summary = useMemo(() => {
    const total = rows.reduce((sum, row) => sum + row.amountCents, 0);
    const paid = rows.filter((row) => row.status === "pagado").reduce((sum, row) => sum + row.amountCents, 0);
    const overdue = rows.filter((row) => row.status === "vencido").reduce((sum, row) => sum + row.amountCents, 0);
    const paidCount = rows.filter((row) => row.status === "pagado").length;
    return { total, paid, pending: total - paid, overdue, paidCount };
  }, [rows]);

  const visible = rows.filter((row) =>
    filter === "todos" ? true : filter === "pagado" ? row.status === "pagado" : row.status !== "pagado",
  );

  async function toggle(row: FixedRowView) {
    if (row.source === "banco") return;
    const paid = row.status !== "pagado";
    const previous = rows;
    setRows((current) =>
      current.map((item) =>
        item.id === row.id
          ? {
              ...item,
              status: paid ? "pagado" : item.dueDay < referenceDay ? "vencido" : "pendiente",
              source: paid ? "manual" : null,
            }
          : item,
      ),
    );
    setError(null);
    try {
      const response = await fetch(`/api/fixed-expenses/${row.id}/payment`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paid }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "No se pudo guardar.");
    } catch (cause) {
      setRows(previous);
      setError(cause instanceof Error ? cause.message : "No se pudo guardar.");
    }
  }

  const percent = summary.total === 0 ? 0 : Math.round((summary.paid / summary.total) * 100);

  return (
    <section className="rounded-2xl border border-border bg-white" data-testid="fixed-checklist">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Gastos fijos · {monthLabel}</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">Lo que pagas cada mes</h2>
          <p className="text-sm text-slate-500">
            {summary.paidCount} de {rows.length} pagados. Se marcan solos cuando el pago aparece en el banco.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding((value) => !value)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-300"
        >
          {adding ? <X className="size-4" /> : <Plus className="size-4" />}
          {adding ? "Cerrar" : "Agregar gasto fijo"}
        </button>
      </div>

      <div className="grid gap-px bg-border sm:grid-cols-4">
        <Figure label="Total mensual" value={formatUsd(summary.total)} />
        <Figure label="Pagado" value={formatUsd(summary.paid)} tone="text-emerald-700" />
        <Figure label="Falta pagar" value={formatUsd(summary.pending)} />
        <Figure label="Vencido" value={formatUsd(summary.overdue)} tone={summary.overdue > 0 ? "text-rose-700" : undefined} />
      </div>
      <div className="px-4 pt-3">
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-1 text-xs text-slate-500">{percent}% del mes cubierto</p>
      </div>

      {adding ? (
        <AddFixed
          accounts={accounts}
          categories={categories}
          onDone={() => {
            setAdding(false);
            router.refresh();
          }}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={filter === key ? "rounded-full bg-slate-900 px-3 py-1 text-xs text-white" : "rounded-full border border-border px-3 py-1 text-xs text-slate-600"}
          >
            {label}
          </button>
        ))}
      </div>
      {error ? <p className="px-4 pt-2 text-sm text-rose-700">{error}</p> : null}

      <ul className="mt-2 divide-y divide-border">
        {visible.length === 0 ? <li className="px-4 py-6 text-center text-sm text-slate-500">No hay gastos fijos con este filtro.</li> : null}
        {visible.map((row) => {
          const paid = row.status === "pagado";
          return (
            <li key={row.id} data-testid={`fixed-${row.id}`} data-status={row.status} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => void toggle(row)}
                disabled={row.source === "banco"}
                aria-label={paid ? `Desmarcar ${row.name}` : `Marcar ${row.name} como pagado`}
                title={row.source === "banco" ? "Detectado en el banco" : paid ? "Desmarcar" : "Marcar como pagado"}
                className={`grid size-6 shrink-0 place-items-center rounded-full border transition ${
                  paid ? "border-emerald-500 bg-emerald-500 text-white" : row.status === "vencido" ? "border-rose-300 bg-white" : "border-slate-300 bg-white hover:border-slate-400"
                } disabled:cursor-default`}
              >
                {paid ? <Check className="size-3.5" /> : null}
              </button>
              <div className="min-w-[200px] flex-1">
                <p className={`font-medium ${paid ? "text-slate-500" : ""}`}>{row.name}</p>
                <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                  <span>{row.vendor} · día {row.dueDay}</span>
                  {row.accountLabel ? (
                    <span className="inline-flex items-center gap-1"><Landmark className="size-3" /> Sale de {row.accountLabel}</span>
                  ) : null}
                  {row.categoryLabel ? (
                    <span className="inline-flex items-center gap-1"><Tag className="size-3" /> Se registra en {row.categoryLabel}</span>
                  ) : null}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold tabular-nums">{formatUsd(row.amountCents)}</p>
                <span className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[row.status]}`}>
                  {STATUS_LABEL[row.status]}
                </span>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {row.source === "banco" && row.movement
                    ? `Detectado en el banco · ${formatDay(row.movement.day)}`
                    : row.source === "manual"
                      ? "Marcado a mano"
                      : row.status === "vencido"
                        ? `Venció el día ${row.dueDay}`
                        : `Vence el día ${row.dueDay}`}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-white px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold tracking-tight tabular-nums ${tone ?? ""}`}>{value}</p>
    </div>
  );
}

function AddFixed({ accounts, categories, onDone }: { accounts: Option[]; categories: Option[]; onDone: () => void }) {
  const [form, setForm] = useState({ name: "", vendor: "", amount: "", dueDay: "1", accountId: "", subcategoryId: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = "h-9 w-full rounded-lg border border-border bg-white px-2.5 text-sm";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/fixed-expenses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "No se pudo agregar.");
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo agregar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-4 mt-3 grid gap-2 rounded-xl border border-border bg-slate-50/60 p-3 sm:grid-cols-6" data-testid="add-fixed">
      <input className={`${field} sm:col-span-2`} placeholder="Qué es (ej. Renta)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-label="Nombre del gasto" />
      <input className={`${field} sm:col-span-2`} placeholder="A quién se le paga" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} aria-label="Proveedor" />
      <input className={field} placeholder="Monto USD" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} aria-label="Monto" />
      <input className={field} type="number" min={1} max={31} placeholder="Día" value={form.dueDay} onChange={(e) => setForm({ ...form, dueDay: e.target.value })} aria-label="Día de pago" />
      <select className={`${field} sm:col-span-3`} value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} aria-label="Cuenta">
        <option value="">¿De qué cuenta sale?</option>
        {accounts.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}
      </select>
      <select className={`${field} sm:col-span-3`} value={form.subcategoryId} onChange={(e) => setForm({ ...form, subcategoryId: e.target.value })} aria-label="Categoría">
        <option value="">¿En qué categoría se registra?</option>
        {categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
      </select>
      <div className="flex items-center gap-3 sm:col-span-6">
        <button type="submit" disabled={busy} className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
          {busy ? "Guardando…" : "Guardar gasto fijo"}
        </button>
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      </div>
    </form>
  );
}
