"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { TicketFlow } from "@/components/ticket-flow";
import { GUIDE_REPLY, isTalk, talkReply, type Briefing } from "@/lib/briefing";
import type { HomeStart } from "@/lib/home-starts";
import { UNSUPPORTED_REPLY, parseIntent } from "@/lib/intent";
import { greetingName } from "@/lib/labels";
import { formatTodayLabel } from "@/lib/dates";

const PROMPTS = [
  ["Analizar mis gastos", "Analiza mis gastos"],
  ["Revisar duplicados", "Revisar duplicados"],
  ["Clientes que deben", "Clientes que deben"],
  ["Rastrear un movimiento", "Rastréame un movimiento"],
  ["¿Cuánto gané?", "¿Cuánto gané?"],
] as const;

type Bubble = { id: string; role: "user" | "assistant"; body: string };

export function HomeChat({ name, briefing, starts }: { name: string; briefing: Briefing; starts: HomeStart[] }) {
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [text, setText] = useState("");
  const [flow, setFlow] = useState<"ticket" | null>(null);

  function ask(raw: string) {
    const value = raw.trim();
    if (!value) return;
    const intent = parseIntent(value);
    const body = isTalk(intent.type) ? talkReply(intent.type, briefing) : intent.type === "unsupported" ? UNSUPPORTED_REPLY : GUIDE_REPLY;
    const stamp = `${Date.now()}-${messages.length}`;
    setMessages((current) => [
      ...current,
      { id: `u-${stamp}`, role: "user", body: value },
      { id: `a-${stamp}`, role: "assistant", body },
    ]);
    setText("");
  }

  return (
    <section data-testid="home-chat" className="flex min-h-[520px] flex-col rounded-3xl border border-border bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-slate-950 text-white">
            <Sparkles className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Serbell</p>
            <p className="text-xs text-slate-500">{briefing.companyName}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setMessages([]);
            setText("");
            setFlow(null);
          }}
          className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300"
        >
          Nuevo chat
        </button>
      </header>
      <div className="flex flex-1 flex-col px-5 py-6">
        {flow === "ticket" ? (
          <div className="flex flex-1 flex-col">
            <h1 className="sr-only">Conciliar un ticket</h1>
            <TicketFlow />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-sm text-slate-500">{formatTodayLabel()}</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">
              Buenos días, <span className="text-primary">{greetingName(name)}.</span>
            </h1>
            <div className="mt-8 w-full max-w-lg text-left">
              <p className="text-sm font-medium text-slate-900">Flujos</p>
              <ul className="mt-2 space-y-2">
                <li>
                  <button
                    type="button"
                    data-testid="flow-ticket"
                    onClick={() => setFlow("ticket")}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-white px-4 py-3 text-left transition hover:border-slate-300"
                  >
                    <span>
                      <span className="block text-sm font-medium text-slate-900">Conciliar un ticket</span>
                      <span className="mt-0.5 block text-xs leading-5 text-slate-500">Sube el ticket, lo lee, lo cruza con el banco y pone la categoría.</span>
                    </span>
                    <span className="shrink-0 text-xs font-medium text-primary">Arrancar</span>
                  </button>
                </li>
                <li>
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-border px-4 py-3 text-left">
                    <span>
                      <span className="block text-sm font-medium text-slate-900">Conciliar un lote</span>
                      <span className="mt-0.5 block text-xs leading-5 text-slate-500">Tickets y facturas mezclados. Lo armamos cuando este quede.</span>
                    </span>
                    <span className="shrink-0 text-xs font-medium text-slate-400">Después</span>
                  </div>
                </li>
              </ul>
              <p className="mt-6 text-sm leading-6 text-slate-600">{openingLine(starts.length)}</p>
              <ul className="mt-3 space-y-2">
                {starts.map((start) => (
                  <li key={start.id}>
                    <Link
                      href={start.href}
                      data-testid={`home-start-${start.id}`}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-white px-4 py-3 transition hover:border-slate-300"
                    >
                      <span>
                        <span className="block text-sm font-medium text-slate-900">{start.title}</span>
                        <span className="mt-0.5 block text-xs leading-5 text-slate-500">{start.detail}</span>
                      </span>
                      <span className="shrink-0 text-xs font-medium text-primary">{start.action}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col">
            <h1 className="sr-only">Buenos días, {greetingName(name)}.</h1>
            <div className="space-y-3">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={
                    message.role === "user"
                      ? "ml-auto max-w-[85%] rounded-2xl bg-slate-950 px-4 py-3 text-sm text-white"
                      : "max-w-[85%] rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700"
                  }
                >
                  <p className="whitespace-pre-wrap">{message.body}</p>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="border-t border-border px-4 py-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {PROMPTS.map(([label, prompt]) => (
            <button
              key={prompt}
              type="button"
              onClick={() => ask(prompt)}
              className="rounded-full border border-border bg-white px-3 py-1.5 text-xs text-slate-600 hover:border-slate-300"
            >
              {label}
            </button>
          ))}
        </div>
        <form
          className="flex items-center gap-2 rounded-full border border-border bg-white px-3 py-2 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            ask(text);
          }}
        >
          <Sparkles className="size-4 text-primary" />
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Pregúntame sobre tu empresa..."
            aria-label="Mensaje para Serbell"
            className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          <button type="submit" className="rounded-full bg-slate-950 px-4 py-2 text-xs font-medium text-white">
            Enviar
          </button>
        </form>
      </div>
    </section>
  );
}

function openingLine(count: number) {
  if (count <= 1) return "Esto es lo que conviene atender primero.";
  return `Encontré ${count} pendientes. Elige con cuál empezar.`;
}
