export function Sparkline({ points, color }: { points: number[]; color: string }) {
  const width = 128;
  const height = 36;
  const series = points.length > 0 ? points : [0];
  const padded = series.length === 1 ? [series[0], series[0]] : series;
  const min = Math.min(...padded);
  const max = Math.max(...padded);
  const span = max - min || 1;
  const path = padded
    .map((point, index) => {
      const x = (index / (padded.length - 1)) * width;
      const y = height - ((point - min) / span) * (height - 4) - 2;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-9 w-full" aria-hidden>
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
