"use client";

import { Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DUPLICATE_HREF, DUPLICATE_PAIR } from "@/lib/duplicates";

const SCAN = [
  { id: "racetrac", merchant: "RaceTrac", date: "2 oct", amount: "USD 42.15", hit: false },
  { id: DUPLICATE_PAIR[0].id, merchant: "SunPass", date: "3 oct", amount: "USD 10.00", hit: true },
  { id: "office", merchant: "Office Depot", date: "5 oct", amount: "USD 89.30", hit: false },
  { id: "verizon", merchant: "Verizon", date: "16 oct", amount: "USD 31.20", hit: false },
  { id: DUPLICATE_PAIR[1].id, merchant: "SunPass", date: "27 oct", amount: "USD 10.00", hit: true },
];

export function DuplicateFlow() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const look = step - 2;
  const found = SCAN.filter((row, index) => row.hit && look >= index).length;

  useEffect(() => {
    if (step >= 8) return;
    const delay = step >= 2 && step <= 6 ? 520 : 700;
    const timer = window.setTimeout(() => setStep((current) => current + 1), delay);
    return () => window.clearTimeout(timer);
  }, [step]);

  useEffect(() => {
    if (step !== 8) return;
    const timer = window.setTimeout(() => router.push(DUPLICATE_HREF), 800);
    return () => window.clearTimeout(timer);
  }, [router, step]);

  return (
    <div className="space-y-6" data-testid="duplicate-flow">
      <p className="ml-auto w-fit max-w-[80%] rounded-3xl bg-white px-4 py-2.5 text-[15px] leading-6 text-slate-800 shadow-sm">
        Revisa si hay gastos duplicados.
      </p>

      {step >= 1 ? (
        <p className="max-w-[40rem] text-[15px] leading-7 text-slate-800">
          {found < 2
            ? "Comparo comercio y monto. Busco dos cargos que se parezcan."
            : "Encontré dos cargos de SunPass por USD 10.00. No borro ninguno."}
        </p>
      ) : null}

      {step >= 2 ? (
        <div className="max-w-md overflow-hidden rounded-2xl bg-white shadow-sm" data-testid="duplicate-search">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
            <Search className="size-4 text-slate-400" />
            {found < 2 ? "Busco el mismo comercio y el mismo monto." : "Dos cargos iguales."}
          </div>
          <ul>
            {SCAN.map((row, index) => {
              const seen = look >= index;
              const looking = look === index;
              const hit = row.hit && seen;
              const passed = seen && !row.hit;
              return (
                <li
                  key={row.id}
                  data-testid={hit ? "duplicate-hit" : undefined}
                  className={`flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 ${hit ? "bg-amber-50" : looking ? "bg-slate-50" : ""}`}
                >
                  <span>
                    <span className={`block text-sm ${passed ? "text-slate-400" : "font-medium text-slate-900"}`}>{row.merchant}</span>
                    <span className="block text-xs text-slate-500">{row.date}</span>
                  </span>
                  <span className={`text-sm tabular-nums ${hit ? "font-semibold text-amber-900" : passed ? "text-slate-400" : "text-slate-800"}`}>{row.amount}</span>
                  {hit ? (
                    <span className="flex gap-1">
                      <span className="rounded-full bg-amber-600 px-2 py-1 text-[11px] font-medium text-white">Mismo comercio</span>
                      <span className="rounded-full bg-amber-600 px-2 py-1 text-[11px] font-medium text-white">Mismo monto</span>
                    </span>
                  ) : looking ? (
                    <Loader2 className="size-4 animate-spin text-slate-400" />
                  ) : passed ? (
                    <span className="text-xs text-slate-400">Distinto</span>
                  ) : (
                    <span className="w-14" />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {step >= 8 ? <p className="text-[15px] leading-7 text-slate-800">Te llevo a Bancos para que decidas.</p> : null}
    </div>
  );
}
