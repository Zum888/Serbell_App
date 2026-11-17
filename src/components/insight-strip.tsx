import { Sparkles } from "lucide-react";

export function InsightStrip({ lines, testId = "serbell-reading" }: { lines: string[]; testId?: string }) {
  return (
    <section data-testid={testId} className="rounded-2xl border border-border bg-white px-4 py-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="size-4 text-primary" />
        Serbell
      </h2>
      <div className="mt-2 space-y-1 text-sm leading-5 text-slate-600">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </section>
  );
}
