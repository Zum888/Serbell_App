import { AlertTriangle, Scale, TrendingDown, Wallet } from "lucide-react";
import Link from "next/link";
import { HomeChat } from "@/components/home-chat";
import { Sparkline } from "@/components/charts";
import type { Briefing } from "@/lib/briefing";
import type { HomeStart } from "@/lib/home-starts";
import { formatUsd } from "@/lib/money";

export function HomeScreen({
  name,
  balanceCents,
  accountCount,
  accounts,
  dailyNet,
  netCents,
  outflowsCents,
  uncategorizedCount,
  uncategorizedExpenseCents,
  periodLabel,
  briefing,
  starts,
}: {
  name: string;
  balanceCents: number;
  accountCount: number;
  accounts: { institution: string; mask: string }[];
  dailyNet: number[];
  netCents: number;
  outflowsCents: number;
  uncategorizedCount: number;
  uncategorizedExpenseCents: number;
  periodLabel: string | null;
  briefing: Briefing;
  starts: HomeStart[];
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

      <HomeChat name={name} briefing={briefing} starts={starts} />
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
