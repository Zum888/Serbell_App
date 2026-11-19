import { ArrowRight, Building2, Check, Clock, FileText, Landmark, Sparkles, Wallet } from "lucide-react";
import Link from "next/link";
import type { Pulse, PulseFlow } from "@/lib/pulse";
import { formatUsd } from "@/lib/money";
import { greetingName } from "@/lib/labels";

const FLOW_TEST: Partial<Record<PulseFlow, string>> = {
  factura: "flow-factura",
  lote: "flow-lote",
  duplicado: "flow-duplicado",
  faltantes: "flow-faltantes",
  cobro: "flow-cobro",
  clasificar: "flow-clasificar",
  efectivo: "flow-efectivo",
};

export function ProactiveHome({
  name,
  pulse,
  onFlow,
}: {
  name: string;
  pulse: Pulse;
  onFlow: (flow: PulseFlow) => void;
}) {
  const issues = pulse.attention.length;
  const except = issues === 0
    ? "Todo está en orden."
    : issues === 1
      ? "Todo está en orden, excepto un asunto que me gustaría revisar contigo."
      : `Todo está en orden, excepto ${issues} asuntos que me gustaría revisar contigo.`;
  return (
    <div className="mx-auto w-full max-w-3xl pb-4">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-1.5 size-6 shrink-0 text-violet-600" />
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">Buenos días, {greetingName(name)}.</h1>
          <p className="mt-3 text-[15px] leading-6 text-slate-500">Ya revisé las finanzas de {pulse.companyName}.</p>
          <p className="text-[15px] leading-6 text-slate-500">{except}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <Summary href="/movimientos" tone="emerald" icon={<Landmark className="size-4" />} title="Disponible en bancos" value={formatUsd(pulse.balanceCents)} note={pulse.balanceNote ?? "En las cuentas conectadas"} testId="bank-balance" />
        <Summary href="/por-cobrar" tone="violet" icon={<Wallet className="size-4" />} title="Por cobrar" value={formatUsd(pulse.receivableCents)} note={pulse.receivableNote} />
        <Summary href="/por-pagar" tone="rose" icon={<Building2 className="size-4" />} title="Por pagar" value={formatUsd(pulse.payableCents)} note={pulse.payableNote} />
      </div>

      {pulse.attention.length > 0 ? (
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Necesito tu atención</h2>
            <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-700">{issues === 1 ? "1 asunto" : `${issues} asuntos`}</span>
          </div>
          <ul className="mt-3 space-y-3">
            {pulse.attention.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700">
                  {item.flow === "cobro" ? <Clock className="size-4" /> : <FileText className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900">{item.title}</span>
                  <span className="mt-0.5 block text-sm text-slate-500">{item.detail}</span>
                </span>
                <button
                  type="button"
                  data-testid={FLOW_TEST[item.flow]}
                  onClick={() => onFlow(item.flow)}
                  className="inline-flex items-center gap-1 rounded-full border border-violet-200 px-3 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-50"
                >
                  {item.action} <ArrowRight className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Lo que hice por ti</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {pulse.done.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                data-testid={FLOW_TEST[item.flow]}
                onClick={() => onFlow(item.flow)}
                className="flex w-full items-start gap-2 rounded-xl px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-white"
              >
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                <span>{item.text}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Summary({
  href,
  tone,
  icon,
  title,
  value,
  note,
  testId,
}: {
  href: string;
  tone: "emerald" | "violet" | "rose";
  icon: React.ReactNode;
  title: string;
  value: string;
  note: string;
  testId?: string;
}) {
  const titleTone = {
    emerald: "text-emerald-700",
    violet: "text-violet-700",
    rose: "text-rose-700",
  }[tone];
  const chip = {
    emerald: "bg-emerald-50 text-emerald-700",
    violet: "bg-violet-50 text-violet-700",
    rose: "bg-rose-50 text-rose-700",
  }[tone];
  return (
    <Link href={href} className="rounded-2xl border border-stone-200 bg-white p-4">
      <span className={`flex items-center gap-2 text-sm font-medium ${titleTone}`}>
        {icon} {title}
      </span>
      <span data-testid={testId} className="mt-3 block text-2xl font-semibold tracking-tight text-slate-900">{value}</span>
      <span className={`mt-3 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${chip}`}>{note}</span>
    </Link>
  );
}
