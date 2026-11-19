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
