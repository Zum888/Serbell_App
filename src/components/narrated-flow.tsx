"use client";

import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { PulseStory } from "@/lib/pulse";

export function NarratedFlow({ testId, story }: { testId: string; story: PulseStory }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const last = 2 + story.checks.length;

  useEffect(() => {
    if (step >= last) return;
    const timer = window.setTimeout(() => setStep((current) => current + 1), step >= 2 ? 420 : 700);
    return () => window.clearTimeout(timer);
  }, [step, last]);

  useEffect(() => {
    if (step !== last) return;
    const timer = window.setTimeout(() => router.push(story.href), 700);
    return () => window.clearTimeout(timer);
  }, [router, step, last, story.href]);

  const done = Math.max(0, Math.min(story.checks.length, step - 2));
  const active = step >= 2 && step < last ? step - 2 : -1;

  return (
    <div className="space-y-6" data-testid={testId}>
      <p className="ml-auto w-fit max-w-[80%] rounded-3xl bg-white px-4 py-2.5 text-[15px] leading-6 text-slate-800 shadow-sm">{story.userLine}</p>
      {step >= 1 ? <p className="max-w-[40rem] text-[15px] leading-7 text-slate-800">{story.assistant}</p> : null}
      {step >= 2 ? (
        <ul className="max-w-md overflow-hidden rounded-2xl bg-white shadow-sm">
          {story.checks.map((item, index) => {
            const state = index < done ? "done" : index === active ? "active" : "wait";
            return (
              <li key={item.label} className="flex items-center gap-3 border-b border-slate-100 px-4 py-2.5 last:border-b-0">
                {state === "done" ? (
                  <span className="grid size-5 place-items-center rounded-full bg-emerald-600 text-white"><Check className="size-3" /></span>
                ) : state === "active" ? (
                  <Loader2 className="size-5 animate-spin text-slate-400" />
                ) : (
                  <span className="size-5 rounded-full border border-slate-200" />
                )}
                <span className="w-28 text-xs text-slate-500">{item.label}</span>
                <span className={`text-sm ${state === "wait" ? "text-slate-300" : "text-slate-900"}`}>{item.value}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {step >= last ? <p className="text-[15px] leading-7 text-slate-800">{story.closing}</p> : null}
    </div>
  );
}
