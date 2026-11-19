"use client";

import { Check, FileText, Loader2, Receipt } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LOTE, loteStartHref } from "@/lib/lote";

export function LoteFlow() {
  const router = useRouter();
  const endRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step >= 7) return;
    const delay = step >= 2 && step <= 5 ? 480 : 700;
    const timer = window.setTimeout(() => setStep((current) => current + 1), delay);
    return () => window.clearTimeout(timer);
  }, [step]);

  useEffect(() => {
    if (step !== 7) return;
    const timer = window.setTimeout(() => router.push(loteStartHref()), 700);
    return () => window.clearTimeout(timer);
  }, [router, step]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [step]);

  const done = step >= 6 ? LOTE.length : step >= 2 ? step - 2 : 0;
  const active = step >= 2 && step <= 5 ? step - 2 : -1;

  return (
    <div className="space-y-6" data-testid="lote-flow">
      <div className="ml-auto w-fit max-w-[85%] space-y-2">
        <p className="rounded-3xl bg-white px-4 py-2.5 text-[15px] leading-6 text-slate-800 shadow-sm">Te dejo el lote, tickets y facturas.</p>
        {LOTE.map((item) => (
          <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2.5 text-left shadow-sm">
            <span className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-600">
              {item.kind === "Factura" ? <FileText className="size-5" /> : <Receipt className="size-5" />}
            </span>
            <span>
              <span className="block text-sm font-medium">{item.fileName}</span>
              <span className="block text-xs text-slate-500">
                {item.kind} · {item.amount} · {item.date}
              </span>
            </span>
          </div>
        ))}
      </div>

      {step >= 1 ? (
        <p className="max-w-[40rem] text-[15px] leading-7 text-slate-800">
          {step < 6
            ? "Recibí cuatro comprobantes. Leo cada ticket y cada factura."
            : "Los cuatro cierran. Busco los cargos en el banco."}
        </p>
      ) : null}

      {step >= 2 ? (
        <ul className="max-w-md overflow-hidden rounded-2xl bg-white shadow-sm" data-testid="lote-checklist">
          {LOTE.map((item, index) => {
            const state = index < done ? "done" : index === active ? "active" : "wait";
            return (
              <li key={item.id} className="flex items-center gap-3 border-b border-slate-100 px-4 py-2.5 last:border-b-0">
                <Mark state={state} />
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm ${state === "wait" ? "text-slate-300" : "text-slate-900"}`}>{item.merchant}</span>
                  <span className="block text-xs text-slate-500">
                    {item.kind} · {item.amount}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {step >= 7 ? (
        <p className="text-[15px] leading-7 text-slate-800">Te llevo a conciliarlos con los movimientos del banco.</p>
      ) : null}
      <div ref={endRef} />
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
