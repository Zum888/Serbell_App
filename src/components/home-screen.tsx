import { AlertTriangle, Layers, Paperclip, Scale, Sparkles, TrendingDown, Upload, Wallet } from "lucide-react";
import Link from "next/link";
import { Sparkline } from "@/components/charts";
import { formatTodayLabel } from "@/lib/dates";
import { greetingName } from "@/lib/labels";
import { formatUsd } from "@/lib/money";
import { Input } from "@/components/ui/input";

export function HomeScreen({
  name,
  companyId,
  balanceCents,
  accountCount,
  accounts,
  duplicates,
  reading,
  dailyNet,
  netCents,
  outflowsCents,
  uncategorizedCount,
  uncategorizedExpenseCents,
  periodLabel,
}: {
  name: string;
  companyId: string;
  balanceCents: number;
  accountCount: number;
  accounts: { institution: string; mask: string }[];
  duplicates: { id: string; fileName: string; merchant: string | null; amountCents: number | null; occurredOn: string; originalName: string | null }[];
  reading: string[];
  dailyNet: number[];
  netCents: number;
  outflowsCents: number;
  uncategorizedCount: number;
  uncategorizedExpenseCents: number;
  periodLabel: string | null;
}) {
  const accountLine = accounts.map((account) => `${account.institution} ····${account.mask}`).join(" · ");
  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<Wallet className="size-4" />}
          title="Disponible en bancos"
          value={formatUsd(balanceCents)}
          detail={`${accountCount === 1 ? "1 cuenta" : `${accountCount} cuentas`} · ${accountLine}`}
          color="#2563eb"
          points={dailyNet}
          testId="bank-balance"
        />
        <MetricCard
          icon={<Scale className="size-4" />}
          title="Neto del periodo"
          value={formatUsd(netCents)}
          detail={periodLabel ? `Entradas menos salidas · ${periodLabel}` : "Entradas menos salidas"}
          color={netCents < 0 ? "#dc2626" : "#16a34a"}
          points={dailyNet}
        />
        <MetricCard
          icon={<TrendingDown className="size-4" />}
          title="Gastos del periodo"
          value={formatUsd(outflowsCents)}
          detail="Suma de los movimientos de salida"
          color="#f97316"
          points={dailyNet.map((value) => (value < 0 ? -value : 0))}
        />
        <Link href="/movimientos?filtro=sin-categoria" className="block">
          <article className="h-full rounded-2xl border border-border bg-white p-4 transition hover:border-slate-300">
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span className="flex items-center gap-2">
                <AlertTriangle className="size-4" /> Sin categoría
              </span>
            </div>
            <p className="mt-3 text-2xl font-semibold tracking-tight">{uncategorizedCount}</p>
            <p className="mt-2 text-xs text-slate-500">
              {uncategorizedCount === 0
                ? "Todos los movimientos tienen categoría."
                : `Sus gastos suman ${formatUsd(uncategorizedExpenseCents)}. Abrir para clasificar.`}
            </p>
          </article>
        </Link>
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <section className="relative overflow-hidden rounded-3xl border border-border bg-white px-6 pb-24 pt-8 text-center">
            <p className="text-sm text-slate-500">{formatTodayLabel()}</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">
              Buenos días, <span className="text-primary">{greetingName(name)}.</span>
            </h1>
            <p className="mt-2 text-slate-500">¿En qué te gustaría que te ayude hoy?</p>
            <form action="/api/chat" method="post" className="mx-auto mt-6 flex max-w-xl items-center gap-2 rounded-full border border-border bg-white px-3 py-2 shadow-sm">
              <Sparkles className="size-4 text-primary" />
              <input type="hidden" name="companyId" value={companyId} />
              <Input name="text" required placeholder="Pregúntame sobre tu empresa..." className="h-9 border-0 shadow-none focus:border-0" />
              <Link href="/chat?subir=1" aria-label="Adjuntar comprobante" className="text-slate-500">
                <Paperclip className="size-4" />
              </Link>
              <button className="flex size-9 items-center justify-center rounded-full bg-primary text-white" type="submit" aria-label="Enviar">
                <Upload className="size-4" />
              </button>
            </form>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link href="/gastos" className="rounded-full border border-border bg-white px-3 py-2 text-sm text-slate-600">
                Analizar mis gastos
              </Link>
              <Link href="/chat?subir=1" className="rounded-full border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-medium text-primary">
                Subir comprobantes
              </Link>
              <Link href="/por-cobrar" className="rounded-full border border-border bg-white px-3 py-2 text-sm text-slate-600">
                Revisar mis cobros
              </Link>
            </div>
            <svg viewBox="0 0 1200 140" className="absolute bottom-0 left-0 h-24 w-full" preserveAspectRatio="none" aria-hidden>
              <path d="M0 70 C 220 130 380 10 620 60 C 840 100 1000 30 1200 80 L 1200 140 L 0 140 Z" fill="#dbeafe" />
              <path d="M0 96 C 260 50 480 130 760 84 C 940 52 1080 110 1200 78 L 1200 140 L 0 140 Z" fill="#93c5fd" />
            </svg>
          </section>

          <section data-testid="home-reading" className="rounded-2xl border border-border bg-white p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-4 text-primary" /> Serbell
            </h2>
            <ul className="mt-3 space-y-2">
              {reading.map((line) => (
                <li key={line} className="flex gap-2 text-sm text-slate-600">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                  <span className="leading-5">{line}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="rounded-2xl border border-border bg-white p-4">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="size-4 text-primary" /> Tu resumen de hoy
          </h2>
          <p className="mt-2 text-xs text-slate-500">El duplicado, si aparece, sale de los comprobantes guardados.</p>
          {duplicates.length === 0 ? (
            <Link href="/comprobantes" className="mt-3 flex items-start gap-3 rounded-xl border border-border p-3 text-sm">
              <Layers className="mt-0.5 size-4 text-slate-400" />
              <span>
                <span className="block font-medium">No hay comprobantes duplicados</span>
                <span className="text-slate-500">La búsqueda en los archivos de esta empresa no encontró una copia.</span>
              </span>
            </Link>
          ) : (
            <Link href={`/comprobantes?foco=${duplicates[0].id}`} data-testid="duplicate-card" className="mt-3 flex items-start gap-3 rounded-xl border border-rose-100 bg-rose-50/40 p-3 text-sm">
              <Layers className="mt-0.5 size-4 text-rose-500" />
              <span>
                <span className="block font-medium">
                  Comprobante duplicado{duplicates[0].merchant ? `: ${duplicates[0].merchant}` : ""}
                  {duplicates[0].amountCents !== null ? ` · ${formatUsd(duplicates[0].amountCents)}` : ""}
                </span>
                <span className="text-slate-500">
                  {duplicates[0].fileName}
                  {duplicates[0].originalName ? ` es copia de ${duplicates[0].originalName}` : ""}.
                  {duplicates.length > 1 ? ` Hay ${duplicates.length} duplicados.` : ""}
                </span>
              </span>
            </Link>
          )}
          <Link href="/reportes" className="mt-3 flex items-start gap-3 rounded-xl border border-border p-3 text-sm hover:border-slate-300">
            <Scale className="mt-0.5 size-4 text-primary" />
            <span>
              <span className="block font-medium">Ver el reporte del periodo</span>
              <span className="text-slate-500">Entradas, salidas y gastos por categoría.</span>
            </span>
          </Link>
        </aside>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  title,
  value,
  detail,
  color,
  points,
  testId,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  detail: string;
  color: string;
  points: number[];
  testId?: string;
}) {
  return (
    <article className="rounded-2xl border border-border bg-white p-4">
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span className="flex items-center gap-2">
          {icon} {title}
        </span>
      </div>
      <p data-testid={testId} className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
      <Sparkline points={points} color={color} />
      <p className="truncate text-xs text-slate-400" title={detail}>{detail}</p>
    </article>
  );
}
