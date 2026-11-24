"use client";

import { Check, ChevronDown, Landmark, Plus, Tag, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { formatDay } from "@/lib/dates";
import type { FixedStatus } from "@/lib/fixed";
import { formatUsd } from "@/lib/money";
import type { FixedProposal, FixedRowView } from "@/server/planning";

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

export function FixedDueWindow(props: {
  monthLabel: string;
  referenceDay: number;
  rows: FixedRowView[];
  proposals?: FixedProposal[];
  accounts: Option[];
  categories: Option[];
}) {
  const total = props.rows.reduce((sum, row) => sum + row.amountCents, 0);
  const paid = props.rows.filter((row) => row.status === "pagado").reduce((sum, row) => sum + row.amountCents, 0);
  const pending = total - paid;
  const paidPct = total === 0 ? 0 : Math.round((paid / total) * 100);
  const pendingPct = total === 0 ? 0 : 100 - paidPct;
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-[#e6e1d8] bg-white" data-testid="fixed-slot">
      <button
        type="button"
        data-testid="fixed-open"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="w-full px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold text-stone-900">Gastos fijos</span>
          <ChevronDown className={`ml-auto size-4 text-stone-500 transition ${open ? "rotate-180" : ""}`} />
        </span>
        <span className="mt-0.5 block text-xs text-slate-500">{props.monthLabel}</span>
        <span className="mt-3 flex items-center gap-3">
          <span
            className="grid size-[4.5rem] shrink-0 place-items-center rounded-full"
            style={{ background: `conic-gradient(#3f6b4e 0% ${paidPct}%, #e7e5e4 ${paidPct}% 100%)` }}
            data-testid="fixed-paid-pct"
            data-paid={paidPct}
            data-pending={pendingPct}
          >
            <span className="grid size-14 place-items-center rounded-full bg-white text-center">
              <span className="text-sm font-semibold leading-none text-stone-900">{paidPct}%</span>
            </span>
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium text-[#3f6b4e]">Ya pagados</span>
            <span className="block text-xs text-slate-500">{formatUsd(paid)} · {paidPct}%</span>
            <span className="mt-1.5 block text-sm font-medium text-stone-800">Por pagar</span>
            <span className="block text-xs text-slate-500">{formatUsd(pending)} · {pendingPct}%</span>
          </span>
        </span>
      </button>
      {open ? (
        <div data-testid="fixed-list" className="border-t border-[#e6e1d8]">
          <FixedChecklist {...props} windowed />
        </div>
      ) : null}
    </section>
  );
}

export function FixedChecklist({
  monthLabel,
  referenceDay,
  rows: initialRows,
  proposals = [],
  accounts,
  categories,
  windowed = false,
}: {
  monthLabel: string;
  referenceDay: number;
  rows: FixedRowView[];
  proposals?: FixedProposal[];
  accounts: Option[];
  categories: Option[];
  windowed?: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);
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

  const overdueRows = rows.filter((row) => row.status === "vencido");
  const soonRows = rows.filter((row) => row.status === "pendiente");
  const paidRows = rows.filter((row) => row.status === "pagado");

  return (
    <section id={windowed ? undefined : "gastos-fijos"} className={windowed ? "" : "rounded-2xl border border-border bg-white"} data-testid="fixed-checklist">
      {windowed ? null : <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Gastos fijos · {monthLabel}</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">Lo que pagas cada mes</h2>
          <p className="text-sm text-slate-500">
            {summary.paidCount} de {rows.length} pagados. Si salió del banco se marca solo. El efectivo se queda aquí y no se vuelve un movimiento.
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
      </div>}

      {windowed ? null : (
        <>
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
        </>
      )}

      {proposals.filter((proposal) => !rows.some((row) => row.vendor.toLowerCase() === proposal.merchant.toLowerCase() || row.name.toLowerCase() === proposal.merchant.toLowerCase())).length > 0 ? (
        <div className="mx-4 mt-3 space-y-2" data-testid="fixed-proposals">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Serbell vio cargos que se repiten</p>
          {proposals
            .filter((proposal) => !rows.some((row) => row.vendor.toLowerCase() === proposal.merchant.toLowerCase() || row.name.toLowerCase() === proposal.merchant.toLowerCase()))
            .map((proposal) => (
              <Proposal key={proposal.merchant} proposal={proposal} onDone={() => router.refresh()} />
            ))}
        </div>
      ) : null}

      {adding ? (
        <AddFixed
          accounts={accounts}
          categories={categories}
          stacked={windowed}
          onDone={() => {
            setAdding(false);
            router.refresh();
          }}
        />
      ) : null}

      {windowed ? (
        <div className="flex justify-end px-4 pt-3">
          <button
            type="button"
            onClick={() => setAdding((value) => !value)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-300"
          >
            {adding ? <X className="size-4" /> : <Plus className="size-4" />}
            {adding ? "Cerrar" : "Agregar gasto fijo"}
          </button>
        </div>
      ) : (
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
      )}
      {error ? <p className="px-4 pt-2 text-sm text-rose-700">{error}</p> : null}

      {windowed ? (
        <div className="mt-2 pb-2">
          <DueGroup title="Vencido" rows={overdueRows} empty="Nada vencido." tone="text-rose-700" onToggle={(row) => void toggle(row)} />
          <DueGroup title="Por vencer" rows={soonRows} empty="Nada por vencer." tone="text-stone-700" onToggle={(row) => void toggle(row)} />
          <DueGroup title="Pagados" rows={paidRows} empty="Todavía no hay pagados." tone="text-emerald-700" onToggle={(row) => void toggle(row)} />
        </div>
      ) : <ul className="mt-2 divide-y divide-border">
        {visible.length === 0 ? <li className="px-4 py-6 text-center text-sm text-slate-500">No hay gastos fijos con este filtro.</li> : null}
        {visible.map((row) => {
          const paid = row.status === "pagado";
          return (
            <li key={row.id} data-testid={`fixed-${row.id}`} data-status={row.status} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => void toggle(row)}
                disabled={row.source === "banco"}
                aria-label={row.source === "banco" ? `${row.name} salió del banco` : paid ? `Desmarcar ${row.name}` : `Lo pagué en efectivo: ${row.name}`}
                title={row.source === "banco" ? "Salió del banco" : paid ? "Desmarcar" : "Lo pagué en efectivo"}
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
                    ? `Salió del banco · ${formatDay(row.movement.day)}`
                    : row.source === "manual"
                      ? "Lo pagué en efectivo"
                      : row.status === "vencido"
                        ? `Venció el día ${row.dueDay}`
                        : `Vence el día ${row.dueDay}`}
                </p>
              </div>
            </li>
          );
        })}
      </ul>}
    </section>
  );
}

function DueGroup({
  title,
  rows,
  empty,
  tone,
  onToggle,
}: {
  title: string;
  rows: FixedRowView[];
  empty: string;
  tone: string;
  onToggle: (row: FixedRowView) => void;
}) {
  return (
    <section className="px-2 pt-3">
      <h3 className={`px-3 text-xs font-semibold uppercase tracking-wide ${tone}`}>{title}</h3>
      {rows.length === 0 ? <p className="px-3 py-3 text-sm text-slate-500">{empty}</p> : (
        <ul className="mt-1 divide-y divide-border">
          {rows.map((row) => {
            const paid = row.status === "pagado";
            return (
              <li key={row.id} data-testid={`fixed-${row.id}`} data-status={row.status} className="flex items-center gap-2 px-2 py-2.5">
                <button
                  type="button"
                  onClick={() => onToggle(row)}
                  disabled={row.source === "banco"}
                  aria-label={row.source === "banco" ? `${row.name} salió del banco` : paid ? `Desmarcar ${row.name}` : `Lo pagué en efectivo: ${row.name}`}
                  title={row.source === "banco" ? "Salió del banco" : paid ? "Desmarcar" : "Lo pagué en efectivo"}
                  className={`grid size-6 shrink-0 place-items-center rounded-full border transition ${
                    paid ? "border-emerald-500 bg-emerald-500 text-white" : row.status === "vencido" ? "border-rose-300 bg-white" : "border-slate-300 bg-white hover:border-slate-400"
                  } disabled:cursor-default`}
                >
                  {paid ? <Check className="size-3.5" /> : null}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`font-medium ${paid ? "text-slate-500" : ""}`}>{row.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{row.vendor} · día {row.dueDay}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums">{formatUsd(row.amountCents)}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {row.source === "banco" && row.movement
                      ? `Salió del banco · ${formatDay(row.movement.day)}`
                      : row.source === "manual"
                        ? "Lo pagué en efectivo"
                        : row.status === "vencido"
                          ? `Venció el día ${row.dueDay}`
                          : `Vence el día ${row.dueDay}`}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Proposal({ proposal, onDone }: { proposal: FixedProposal; onDone: () => void }) {
  const [amount, setAmount] = useState((proposal.amountCents / 100).toFixed(2));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/fixed-expenses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: proposal.merchant,
          vendor: proposal.merchant,
          amount,
          dueDay: String(proposal.dueDay),
          accountId: "",
          subcategoryId: "",
        }),
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
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#e6e1d8] bg-[#f7f6f4] px-3 py-2">
      <p className="min-w-[180px] flex-1 text-sm text-stone-800">
        {proposal.merchant} apareció {proposal.count} veces. ¿Lo dejas como gasto fijo?
      </p>
      <input
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        aria-label={`Monto de ${proposal.merchant}`}
        className="h-8 w-28 rounded-lg border border-[#e6e1d8] bg-white px-2 text-sm"
      />
      <button type="button" disabled={busy} onClick={() => void confirm()} className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm font-medium text-[#f7f6f4] disabled:opacity-50">
        {busy ? "Guardando…" : "Confirmar"}
      </button>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
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

function AddFixed({ accounts, categories, onDone, stacked = false }: { accounts: Option[]; categories: Option[]; onDone: () => void; stacked?: boolean }) {
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
    <form onSubmit={submit} className={stacked ? "mx-3 mt-3 grid gap-2 rounded-xl border border-border bg-slate-50/60 p-3" : "mx-4 mt-3 grid gap-2 rounded-xl border border-border bg-slate-50/60 p-3 sm:grid-cols-6"} data-testid="add-fixed">
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
