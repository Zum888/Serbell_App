import { Clock, Layers, Paperclip, Sparkles, TrendingUp, Upload, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { formatTodayLabel } from "@/lib/dates";
import { greetingName } from "@/lib/labels";
import { formatUsd } from "@/lib/money";
import { Input } from "@/components/ui/input";

const DEMO = {
  profitCents: 832000,
  receivablesCents: 1245000,
  payablesCents: 678000,
};

function Sparkline({ points, color }: { points: number[]; color: string }) {
  const width = 128;
  const height = 36;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const path = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - ((point - min) / span) * (height - 4) - 2;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-9 w-full" aria-hidden>
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function HomeScreen({
  name,
  companyId,
  balanceCents,
  accountCount,
  accounts,
  duplicates,
}: {
  name: string;
  companyId: string;
  balanceCents: number;
  accountCount: number;
  accounts: { institution: string; mask: string }[];
  duplicates: { id: string; fileName: string; merchant: string | null; amountCents: number | null; occurredOn: string; originalName: string | null }[];
}) {
  const accountLine = accounts.map((account) => `${account.institution} ····${account.mask}`).join(" · ");
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-border bg-white p-4">
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span className="flex items-center gap-2">
                <Wallet className="size-4" /> Disponible en bancos
              </span>
            </div>
            <p data-testid="bank-balance" className="mt-3 text-2xl font-semibold tracking-tight">
              {formatUsd(balanceCents)}
            </p>
            <Sparkline points={[8, 9, 8, 11, 10, 12, 13, 12]} color="#2563eb" />
            <p className="text-xs text-slate-500">
              {accountCount === 1 ? "1 cuenta conectada" : `${accountCount} cuentas conectadas`}
            </p>
            <p className="text-xs text-slate-400">{accountLine}. El saldo sale de la base. La gráfica es ilustrativa.</p>
          </article>
          <DemoCard title="Utilidad del mes" icon={<TrendingUp className="size-4" />} value={formatUsd(DEMO.profitCents)} detail="Margen ilustrativo 33.9%" color="#16a34a" points={[4, 6, 5, 8, 7, 9, 11]} />
          <DemoCard title="Por cobrar" icon={<Layers className="size-4" />} value={formatUsd(DEMO.receivablesCents)} detail="5 facturas abiertas, dato ilustrativo" color="#f97316" points={[6, 8, 7, 9, 8, 10, 9]} />
          <DemoCard title="Por pagar" icon={<Wallet className="size-4" />} value={formatUsd(DEMO.payablesCents)} detail="8 facturas por pagar, dato ilustrativo" color="#f59e0b" points={[5, 7, 6, 8, 7, 6, 8]} />
        </section>
        <section className="relative overflow-hidden rounded-3xl border border-border bg-white px-6 pb-24 pt-6">
          <p className="text-sm text-slate-500">{formatTodayLabel()}</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            Buenos días, <span className="text-primary">{greetingName(name)}.</span>
          </h1>
          <p className="mt-2 text-slate-500">¿En qué te gustaría que te ayude hoy?</p>
          <form action="/api/chat" method="post" className="mt-6 flex items-center gap-2 rounded-full border border-border bg-white px-3 py-2 shadow-sm">
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
          <div className="mt-4 flex flex-wrap gap-2">
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
      </div>
      <aside className="rounded-2xl border border-border bg-white p-4">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Sparkles className="size-4 text-primary" /> Tu resumen de hoy
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          La cifra de facturas vencidas es de demostración y no cobra nada. El duplicado, si aparece, sale de los comprobantes guardados.
        </p>
        <Link href="/no-implementado?tema=cobrar" data-testid="demo-overdue" className="mt-4 flex items-start gap-3 rounded-xl border border-border p-3 text-sm">
          <Clock className="mt-0.5 size-4 text-amber-600" />
          <span>
            <span className="block font-medium">USD 3,200 pendientes de recuperar</span>
            <span className="text-slate-500">3 clientes tienen facturas vencidas. Demostración. Abrir no cobra.</span>
          </span>
        </Link>
        {duplicates.length === 0 ? (
          <Link href="/comprobantes" className="mt-3 flex items-start gap-3 rounded-xl border border-border p-3 text-sm">
            <Layers className="mt-0.5 size-4 text-rose-500" />
            <span>
              <span className="block font-medium">No hay comprobantes duplicados</span>
              <span className="text-slate-500">La búsqueda en los archivos de esta empresa no encontró una copia.</span>
            </span>
          </Link>
        ) : (
          <Link href={`/comprobantes?foco=${duplicates[0].id}`} data-testid="duplicate-card" className="mt-3 flex items-start gap-3 rounded-xl border border-border p-3 text-sm">
            <Layers className="mt-0.5 size-4 text-rose-500" />
            <span>
              <span className="block font-medium">
                Comprobante duplicado{duplicates[0].merchant ? `: ${duplicates[0].merchant}` : ""}
                {duplicates[0].amountCents !== null ? ` · ${formatUsd(duplicates[0].amountCents)}` : ""}
              </span>
              <span className="text-slate-500">
                {duplicates[0].fileName}
                {duplicates[0].originalName ? ` es copia de ${duplicates[0].originalName}` : ""}.
                {duplicates[0].occurredOn ? ` ${duplicates[0].occurredOn}.` : ""}
                {duplicates.length > 1 ? ` Hay ${duplicates.length} duplicados.` : ""}
              </span>
            </span>
          </Link>
        )}
        <p className="mt-4 flex items-center gap-2 text-xs text-slate-400">
          <Users className="size-3" /> Última revisión ilustrativa. No es un dato de la base.
        </p>
      </aside>
    </div>
  );
}

function DemoCard({
  title,
  icon,
  value,
  detail,
  color,
  points,
}: {
  title: string;
  icon: React.ReactNode;
  value: string;
  detail: string;
  color: string;
  points: number[];
}) {
  return (
    <article className="rounded-2xl border border-border bg-white p-4">
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span className="flex items-center gap-2">
          {icon} {title}
        </span>
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">Demostración</span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
      <Sparkline points={points} color={color} />
      <p className="text-xs text-slate-500">{detail}</p>
    </article>
  );
}
