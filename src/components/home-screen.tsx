import { AlertTriangle, Layers, Scale, Sparkles, TrendingDown, Wallet } from "lucide-react";
import Link from "next/link";
import { HomeChat } from "@/components/home-chat";
import { Sparkline } from "@/components/charts";
import type { Briefing } from "@/lib/briefing";
import { formatUsd } from "@/lib/money";

export function HomeScreen({
  name,
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
  briefing,
}: {
  name: string;
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
  briefing: Briefing;
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
        <HomeChat name={name} briefing={briefing} />
        <aside className="space-y-4">
          <section data-testid="home-reading" className="rounded-2xl border border-border bg-white p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-4 text-primary" /> Lectura de hoy
            </h2>
            <ul className="mt-3 space-y-3">
              {reading.map((line) => (
                <li key={line} className="flex gap-2 text-sm text-slate-600">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                  <span className="leading-5">{line}</span>
                </li>
              ))}
            </ul>
          </section>
          {duplicates.length === 0 ? (
            <Link href="/comprobantes" className="flex items-start gap-3 rounded-2xl border border-border bg-white p-4 text-sm">
              <Layers className="mt-0.5 size-4 text-slate-400" />
              <span>
                <span className="block font-medium">No hay comprobantes duplicados</span>
                <span className="text-slate-500">La búsqueda en los archivos de esta empresa no encontró una copia.</span>
              </span>
            </Link>
          ) : (
            <Link href={`/comprobantes?foco=${duplicates[0].id}`} data-testid="duplicate-card" className="flex items-start gap-3 rounded-2xl border border-border bg-white p-4 text-sm">
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
          <Link href="/reportes" className="flex items-start gap-3 rounded-2xl border border-border bg-white p-4 text-sm hover:border-slate-300">
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
