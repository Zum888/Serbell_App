"use client";

import { ArrowUp, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DuplicateFlow } from "@/components/duplicate-flow";
import { MissingFlow } from "@/components/missing-flow";
import { LoteFlow } from "@/components/lote-flow";
import { InvoiceFlow } from "@/components/ticket-flow";
import { GUIDE_REPLY, isTalk, talkReply, type Briefing } from "@/lib/briefing";
import type { HomeStart } from "@/lib/home-starts";
import { UNSUPPORTED_REPLY, parseIntent } from "@/lib/intent";
import { greetingName } from "@/lib/labels";

const PROMPTS = [
  ["Analizar mis gastos", "Analiza mis gastos"],
  ["¿Cuánto gané?", "¿Cuánto gané?"],
] as const;

type Bubble = { id: string; role: "user" | "assistant"; body: string };

export function HomeChat({ name, briefing, starts }: { name: string; briefing: Briefing; starts: HomeStart[] }) {
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [text, setText] = useState("");
  const [flow, setFlow] = useState<"factura" | "lote" | "duplicado" | "faltantes" | null>(null);

  function ask(raw: string) {
    const value = raw.trim();
    if (!value) return;
    if (/faltan comprobantes|comprobantes faltantes|pedir comprobantes/i.test(value)) {
      setMessages([]);
      setFlow("faltantes");
      setText("");
      return;
    }
    if (/duplicad/i.test(value)) {
      setMessages([]);
      setFlow("duplicado");
      setText("");
      return;
    }
    const intent = parseIntent(value);
    const body = isTalk(intent.type) ? talkReply(intent.type, briefing) : intent.type === "unsupported" ? UNSUPPORTED_REPLY : GUIDE_REPLY;
    const stamp = `${Date.now()}-${messages.length}`;
    setFlow(null);
    setMessages((current) => [
      ...current,
      { id: `u-${stamp}`, role: "user", body: value },
      { id: `a-${stamp}`, role: "assistant", body },
    ]);
    setText("");
  }

  function reset() {
    setMessages([]);
    setText("");
    setFlow(null);
  }

  const talking = flow || messages.length > 0;

  return (
    <section data-testid="home-chat" className="flex h-[calc(100vh-7.5rem)] flex-col">
      {talking ? (
        <div className="mb-2 flex justify-end">
          <button type="button" onClick={reset} className="text-xs text-slate-500 hover:text-slate-800">
            Nuevo chat
          </button>
        </div>
      ) : null}

      <div className={`flex min-h-0 flex-1 flex-col overflow-y-auto ${talking ? "" : "items-center justify-center"}`}>
        {flow === "factura" ? (
          <div className="mx-auto w-full max-w-2xl flex-1">
            <h1 className="sr-only">Conciliar una factura</h1>
            <InvoiceFlow />
          </div>
        ) : flow === "lote" ? (
          <div className="mx-auto w-full max-w-2xl flex-1">
            <h1 className="sr-only">Conciliar un lote</h1>
            <LoteFlow />
          </div>
        ) : flow === "duplicado" ? (
          <div className="mx-auto w-full max-w-2xl flex-1">
            <h1 className="sr-only">Revisar duplicados</h1>
            <DuplicateFlow />
          </div>
        ) : flow === "faltantes" ? (
          <div className="mx-auto w-full max-w-2xl flex-1">
            <h1 className="sr-only">Pedir comprobantes</h1>
            <MissingFlow />
          </div>
        ) : talking ? (
          <div className="mx-auto w-full max-w-2xl flex-1 space-y-6">
            <h1 className="sr-only">Buenos días, {greetingName(name)}.</h1>
            {messages.map((message) =>
              message.role === "user" ? (
                <p key={message.id} className="ml-auto w-fit max-w-[80%] rounded-3xl bg-white px-4 py-2.5 text-[15px] leading-6 text-slate-800 shadow-sm">
                  {message.body}
                </p>
              ) : (
                <p key={message.id} className="max-w-[42rem] text-[15px] leading-7 text-slate-800">
                  {message.body}
                </p>
              ),
            )}
          </div>
        ) : (
          <div className="w-full max-w-2xl text-center">
            <h1 className="text-4xl font-medium tracking-tight text-slate-900">
              Buenos días, {greetingName(name)}
            </h1>
            <p className="mt-3 text-[15px] text-slate-500">{briefing.companyName}. ¿Por dónde seguimos?</p>
            <div className="mt-8">
              <Composer text={text} setText={setText} onSubmit={() => ask(text)} />
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                data-testid="flow-factura"
                onClick={() => setFlow("factura")}
                className="rounded-full bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm hover:text-slate-950"
              >
                Conciliar una factura
              </button>
              <button
                type="button"
                data-testid="flow-lote"
                onClick={() => setFlow("lote")}
                className="rounded-full bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm hover:text-slate-950"
              >
                Conciliar un lote
              </button>
              <button
                type="button"
                data-testid="flow-duplicado"
                onClick={() => setFlow("duplicado")}
                className="rounded-full bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm hover:text-slate-950"
              >
                Revisar duplicados
              </button>
              <button
                type="button"
                data-testid="flow-faltantes"
                onClick={() => setFlow("faltantes")}
                className="rounded-full bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm hover:text-slate-950"
              >
                Pedir comprobantes
              </button>
              {PROMPTS.map(([label, prompt]) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => ask(prompt)}
                  className="rounded-full bg-white px-3 py-1.5 text-sm text-slate-600 shadow-sm hover:text-slate-950"
                >
                  {label}
                </button>
              ))}
            </div>
            {starts.length > 0 ? (
              <p className="mt-8 text-sm text-slate-500">
                También:{" "}
                {starts.slice(0, 3).map((start, index) => (
                  <span key={start.id}>
                    {index > 0 ? " · " : null}
                    <Link href={start.href} data-testid={`home-start-${start.id}`} className="text-slate-700 underline-offset-2 hover:underline">
                      {start.title.toLowerCase()}
                    </Link>
                  </span>
                ))}
              </p>
            ) : null}
          </div>
        )}
      </div>

      {talking ? (
        <div className="mx-auto mt-4 w-full max-w-2xl">
          <Composer text={text} setText={setText} onSubmit={() => ask(text)} />
        </div>
      ) : null}
    </section>
  );
}

function Composer({ text, setText, onSubmit }: { text: string; setText: (value: string) => void; onSubmit: () => void }) {
  return (
    <form
      className="flex items-end gap-2 rounded-3xl border border-white bg-white px-3 py-2 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <span className="mb-1.5 grid size-8 place-items-center rounded-full text-slate-400">
        <Plus className="size-4" />
      </span>
      <input
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Escribe a Serbell"
        aria-label="Mensaje para Serbell"
        className="mb-1 h-9 min-w-0 flex-1 bg-transparent text-[15px] outline-none"
      />
      <button type="submit" aria-label="Enviar" className="grid size-9 place-items-center rounded-full bg-slate-900 text-white">
        {text.trim() ? <ArrowUp className="size-4" /> : <Sparkles className="size-4" />}
      </button>
    </form>
  );
}
