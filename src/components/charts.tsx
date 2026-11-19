import { useId } from "react";

export function Sparkline({ points, color, fill = false }: { points: number[]; color: string; fill?: boolean }) {
  const width = 128;
  const height = 44;
  const gradientId = `spark-${useId().replace(/:/g, "")}`;
  const series = points.length > 0 ? points : [0];
  const padded = series.length === 1 ? [series[0], series[0]] : series;
  const min = fill ? Math.min(...padded, 0) : Math.min(...padded);
  const max = Math.max(...padded);
  const span = max - min || 1;
  const coords = padded.map((point, index) => {
    const x = (index / (padded.length - 1)) * width;
    const y = height - ((point - min) / span) * (height - 4) - 2;
    return { x, y };
  });
  const path = coords.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  const area = `${path} L${width} ${height} L0 ${height} Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-1 h-11 w-full" aria-hidden>
      {fill ? (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.55" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
      ) : null}
      {fill ? <path d={area} fill={`url(#${gradientId})`} stroke="none" /> : null}
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AreaChart({
  series,
  color,
  fromZero = false,
}: {
  series: { label: string; value: number }[];
  color: string;
  fromZero?: boolean;
}) {
  const gradientId = `area-${useId().replace(/:/g, "")}`;
  const points = series.length > 0 ? series : [{ label: "", value: 0 }];
  const values = points.map((point) => point.value);
  const { bottom, mid, top } = axisRange(values, fromZero);
  const span = top - bottom || 1;
  const width = 320;
  const height = 112;
  const pad = 6;
  const coords = points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
    const y = pad + (height - pad * 2) - ((point.value - bottom) / span) * (height - pad * 2);
    return { x, y };
  });
  const line = coords.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  const area = `${line} L${width} ${height} L0 ${height} Z`;
  const last = coords[coords.length - 1] ?? { x: width, y: height / 2 };
  const ticks = [top, mid, bottom];
  const labels = axisLabels(points);
  return (
    <div className="mt-3">
      <div className="flex gap-2">
        <div className="flex h-28 w-11 shrink-0 flex-col justify-between text-right text-[10px] tabular-nums leading-none text-slate-400">
          {ticks.map((tick, index) => (
            <span key={`${index}-${tick}`}>{compactAxis(tick)}</span>
          ))}
        </div>
        <div className="relative h-28 min-w-0 flex-1">
          <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.42" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill={`url(#${gradientId})`} stroke="none" />
            <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
          <span
            className="absolute size-2.5 rounded-full ring-2 ring-white"
            style={{ left: `${(last.x / width) * 100}%`, top: `${(last.y / height) * 100}%`, transform: "translate(-50%, -50%)", backgroundColor: color }}
          />
        </div>
      </div>
      <div className="mt-1.5 flex justify-between pl-[3.25rem] text-[10px] text-slate-400">
        {labels.map((label) => (
          <span key={label.key}>{label.text}</span>
        ))}
      </div>
    </div>
  );
}

function axisRange(values: number[], fromZero: boolean) {
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  if (fromZero) {
    const top = niceCeil(Math.max(rawMax * 1.08, 100));
    return { bottom: 0, mid: top / 2, top };
  }
  const pad = Math.max((rawMax - rawMin) * 0.2, 100);
  const min = Math.max(0, rawMin - pad);
  const max = rawMax + pad;
  const step = niceStep(Math.max((max - min) / 2, 1));
  const bottom = Math.floor(min / step) * step;
  const top = Math.max(bottom + step, Math.ceil(max / step) * step);
  return { bottom, mid: (bottom + top) / 2, top };
}

function niceCeil(value: number) {
  const exp = 10 ** Math.floor(Math.log10(value));
  const frac = value / exp;
  const nice = frac <= 1 ? 1 : frac <= 1.2 ? 1.2 : frac <= 1.5 ? 1.5 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 3 ? 3 : frac <= 4 ? 4 : frac <= 5 ? 5 : frac <= 6 ? 6 : frac <= 8 ? 8 : 10;
  return nice * exp;
}

function niceStep(rough: number) {
  const exp = 10 ** Math.floor(Math.log10(rough));
  const frac = rough / exp;
  const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 5 ? 5 : 10;
  return nice * exp;
}

function compactAxis(cents: number) {
  const dollars = Math.round(cents / 100);
  return dollars.toLocaleString("en-US");
}

function axisLabels(points: { label: string }[]) {
  const count = Math.min(7, points.length);
  if (count <= 1) return points.map((point, index) => ({ key: String(index), text: point.label }));
  const indexes = [...new Set(Array.from({ length: count }, (_, index) => Math.round((index * (points.length - 1)) / (count - 1))))];
  return indexes.map((index) => ({ key: String(index), text: points[index]?.label ?? "" }));
}

export function Bars({ rows }: { rows: { label: string; value: number; hint: string }[] }) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  if (rows.length === 0) return <p className="text-sm text-slate-500">No hay importes para esta gráfica.</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{row.label}</span>
            <span className="shrink-0 tabular-nums text-slate-600">{row.hint}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-slate-100">
            <div className="h-1.5 rounded-full bg-primary" style={{ width: `${row.value <= 0 ? 0 : (row.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
