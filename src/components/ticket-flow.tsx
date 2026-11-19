"use client";

import { Check, Loader2, Receipt } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const CHECKS = [
  { label: "Monto", value: "USD 203.94" },
  { label: "Lugar", value: "FleetSmarts" },
  { label: "Fecha", value: "12 oct 2026" },
  { label: "Concepto", value: "Combustible" },
];

const CANDIDATES = [
  { merchant: "SunPass", date: "3 oct", amount: "USD 10.00" },
  { merchant: "FleetSmarts", date: "12 oct", amount: "USD 203.94" },
  { merchant: "Brian", date: "18 oct", amount: "USD 1,487.56" },
];

const CATEGORIES = ["Transporte / Combustible", "Transporte / Peajes", "Operación / Mantenimiento"];

const MOVEMENT = "/movimientos?movimiento=tx_qpl_fs_20394";

export function TicketFlow() {
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [picking, setPicking] = useState(false);
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    if (step >= 11) return;
    const delay = step >= 2 && step <= 5 ? 560 : step >= 8 && step <= 10 ? 680 : 740;
    const timer = window.setTimeout(() => setStep((current) => current + 1), delay);
    return () => window.clearTimeout(timer);
  }, [step]);

  const done = step >= 6 ? 4 : step >= 2 ? step - 2 : 0;
  const active = step >= 2 && step <= 5 ? step - 2 : -1;
  const scan = step >= 11 ? 1 : step >= 8 ? step - 8 : -1;
  const matched = step >= 11;

  return (
    <div className="space-y-3" data-testid="ticket-flow">
      <Bubble>Llegó un ticket de compra.</Bubble>
      <div className="flex max-w-[85%] items-center gap-3 rounded-2xl border border-border bg-white px-4 py-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <Receipt className="size-5" />
        </span>
        <span>
          <span className="block text-sm font-medium">FleetSmarts_ticket.jpg</span>
          <span className="block text-xs text-slate-500">Ticket de compra · USD 203.94</span>
        </span>
      </div>

      {step >= 1 ? <Bubble>{step < 6 ? "Estoy leyendo el ticket." : "Monto, lugar, fecha y concepto cierran. Los confirmé."}</Bubble> : null}

      {step >= 2 ? (
        <ul className="max-w-[85%] overflow-hidden rounded-2xl border border-border bg-white" data-testid="ticket-checklist">
          {CHECKS.map((item, index) => {
            const state = index < done ? "done" : index === active ? "active" : "wait";
            return (
              <li key={item.label} className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0">
                <Mark state={state} />
                <span className="w-24 text-xs text-slate-500">{item.label}</span>
                <span className={`text-sm ${state === "wait" ? "text-slate-300" : "font-medium text-slate-900"}`}>{item.value}</span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {step >= 7 ? (
        <Bubble>{matched ? "Encontré el cargo. Ticket y movimiento quedaron conciliados." : "Busco el cargo en el banco."}</Bubble>
      ) : null}

      {step >= 8 ? (
        <ul className="max-w-[85%] overflow-hidden rounded-2xl border border-border bg-white" data-testid="ticket-search">
          {CANDIDATES.map((row, index) => {
            const looking = !matched && scan === index;
            const hit = matched && index === 1;
            return (
              <li
                key={row.merchant}
                className={`flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 last:border-b-0 ${hit ? "bg-emerald-50" : looking ? "bg-slate-50" : ""}`}
              >
                <span>
                  <span className="block text-sm font-medium">{row.merchant}</span>
                  <span className="block text-xs text-slate-500">{row.date}</span>
                </span>
                <span className="text-sm tabular-nums">{row.amount}</span>
                {hit ? <span className="text-xs font-medium text-emerald-700">Conciliado</span> : looking ? <Loader2 className="size-4 animate-spin text-slate-400" /> : <span className="w-16" />}
              </li>
            );
          })}
        </ul>
      ) : null}

      {matched ? (
        <div className="max-w-[85%] rounded-2xl border border-border bg-white px-4 py-3" data-testid="ticket-category">
          <p className="text-sm text-slate-700">
            {changed ? "Cambié la categoría a" : "La categoría que le queda es"} <span className="font-medium text-slate-950">{category}</span>.
            {changed ? "" : " Si no es esa, cámbiala."}
          </p>
          {picking ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {CATEGORIES.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setCategory(option);
                    setChanged(option !== CATEGORIES[0]);
                    setPicking(false);
                  }}
                  className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-400"
                >
                  {option}
                </button>
              ))}
            </div>
          ) : (
            <button type="button" onClick={() => setPicking(true)} className="mt-3 text-xs font-medium text-primary">
              Cambiar categoría
            </button>
          )}
          <Link href={MOVEMENT} className="mt-3 block text-xs font-medium text-slate-950 underline">
            Ver el movimiento
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function Bubble({ children }: { children: string }) {
  return <p className="max-w-[85%] rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">{children}</p>;
}

function Mark({ state }: { state: "done" | "active" | "wait" }) {
  if (state === "done") {
    return (
      <span className="flex size-5 items-center justify-center rounded-full bg-emerald-600 text-white">
        <Check className="size-3" />
      </span>
    );
  }
  if (state === "active") return <Loader2 className="size-5 animate-spin text-slate-400" />;
  return <span className="size-5 rounded-full border border-slate-200" />;
}
