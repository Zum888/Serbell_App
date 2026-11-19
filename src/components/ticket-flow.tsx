"use client";

import { Check, FileText, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const CHECKS = [
  { label: "Monto", value: "USD 203.94" },
  { label: "Lugar", value: "FleetSmarts" },
  { label: "Fecha", value: "12 oct 2026" },
  { label: "Concepto", value: "Combustible" },
];

const BANK = "/cuentas?cuenta=acct_qpl_boa&paso=conciliar&actual=tx_qpl_fs_20394&factura=1";

export function InvoiceFlow() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step >= 7) return;
    const delay = step >= 2 && step <= 5 ? 420 : 700;
    const timer = window.setTimeout(() => setStep((current) => current + 1), delay);
    return () => window.clearTimeout(timer);
  }, [step]);

  useEffect(() => {
    if (step !== 7) return;
    const timer = window.setTimeout(() => router.push(BANK), 700);
    return () => window.clearTimeout(timer);
  }, [router, step]);

  const done = step >= 6 ? 4 : step >= 2 ? step - 2 : 0;
  const active = step >= 2 && step <= 5 ? step - 2 : -1;

  return (
    <div className="space-y-6" data-testid="ticket-flow">
      <div className="ml-auto w-fit max-w-[80%]">
        <p className="rounded-3xl bg-white px-4 py-2.5 text-[15px] leading-6 text-slate-800 shadow-sm">Aquí está la factura.</p>
        <div className="mt-2 flex items-center gap-3 rounded-2xl bg-white px-3 py-2.5 shadow-sm">
          <span className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-600">
            <FileText className="size-5" />
          </span>
          <span className="text-left">
            <span className="block text-sm font-medium">Factura_FleetSmarts.pdf</span>
            <span className="block text-xs text-slate-500">USD 203.94 · 12 oct 2026</span>
          </span>
        </div>
      </div>

      {step >= 1 ? (
        <p className="max-w-[40rem] text-[15px] leading-7 text-slate-800">
          {step < 6 ? "Recibí la factura. Estoy leyendo el monto, el lugar, la fecha y el concepto." : "Los cuatro datos cierran. Busco este cargo en el banco."}
        </p>
      ) : null}

      {step >= 2 ? (
        <ul className="max-w-md overflow-hidden rounded-2xl bg-white shadow-sm" data-testid="ticket-checklist">
          {CHECKS.map((item, index) => {
            const state = index < done ? "done" : index === active ? "active" : "wait";
            return (
              <li key={item.label} className="flex items-center gap-3 border-b border-slate-100 px-4 py-2.5 last:border-b-0">
                <Mark state={state} />
                <span className="w-24 text-xs text-slate-500">{item.label}</span>
                <span className={`text-sm ${state === "wait" ? "text-slate-300" : "text-slate-900"}`}>{item.value}</span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {step >= 7 ? <p className="text-[15px] leading-7 text-slate-800">Te llevo a Cuentas bancarias para conciliarla con el movimiento.</p> : null}
    </div>
  );
}

function Mark({ state }: { state: "done" | "active" | "wait" }) {
  if (state === "done") {
    return (
      <span className="grid size-5 place-items-center rounded-full bg-emerald-600 text-white">
        <Check className="size-3" />
      </span>
    );
  }
  if (state === "active") return <Loader2 className="size-5 animate-spin text-slate-400" />;
  return <span className="size-5 rounded-full border border-slate-200" />;
}
