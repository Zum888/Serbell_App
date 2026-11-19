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
import { useChatPin } from "@/components/chat-pin";
import { greetingName } from "@/lib/labels";

const PROMPTS = [
  ["Analizar mis gastos", "Analiza mis gastos"],
  ["¿Cuánto gané?", "¿Cuánto gané?"],
] as const;

type Bubble = { id: string; role: "user" | "assistant"; body: string };

const LANDED: Record<string, string> = {
  factura: "Te dejé en Bancos, en el movimiento de esa factura.",
  lote: "Te dejé en Bancos para seguir el lote.",
  duplicado: "Te dejé en Bancos para revisar los duplicados.",
  faltantes: "Te dejé en Bancos con los comprobantes que faltaban.",
};

export function HomeChat({
  name,
  briefing,
  starts,
  dock = false,
  landed = null,
}: {
  name: string;
  briefing: Briefing;
  starts: HomeStart[];
  dock?: boolean;
  landed?: string | null;
}) {
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [text, setText] = useState("");
  const [flow, setFlow] = useState<"factura" | "lote" | "duplicado" | "faltantes" | null>(null);
  const pin = useChatPin();

  function openFlow(next: "factura" | "lote" | "duplicado" | "faltantes") {
    pin();
    setMessages([]);
    setFlow(next);
    setText("");
  }

  function ask(raw: string) {
    const value = raw.trim();
    if (!value) return;
    if (/faltan comprobantes|comprobantes faltantes|pedir comprobantes/i.test(value)) {
      openFlow("faltantes");
      return;
    }
    if (/duplicad/i.test(value)) {
      openFlow("duplicado");
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

  const landedLine = dock && landed && !flow && messages.length === 0 ? LANDED[landed] : null;

  return (
    <section data-testid="home-chat" className={dock ? "flex h-full min-h-0 flex-col" : "flex h-[calc(100vh-7.5rem)] flex-col"}>
      {dock ? (
        <div className="mb-3 flex flex-wrap gap-1.5" data-testid="flow-shortcuts">
          <FlowChip label="Conciliar una factura" testId="flow-factura" onClick={() => openFlow("factura")} />
          <FlowChip label="Conciliar un lote" testId="flow-lote" onClick={() => openFlow("lote")} />
          <FlowChip label="Revisar duplicados" testId="flow-duplicado" onClick={() => openFlow("duplicado")} />
          <FlowChip label="Pedir comprobantes" testId="flow-faltantes" onClick={() => openFlow("faltantes")} />
        </div>
      ) : null}
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
        ) : landedLine ? (
          <div className="mx-auto w-full max-w-2xl flex-1">
            <p className="text-[15px] leading-7 text-slate-800">{landedLine}</p>
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
                onClick={() => openFlow("factura")}
                className="rounded-full bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm hover:text-slate-950"
              >
                Conciliar una factura
              </button>
              <button
                type="button"
                data-testid="flow-lote"
                onClick={() => openFlow("lote")}
                className="rounded-full bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm hover:text-slate-950"
              >
                Conciliar un lote
              </button>
              <button
                type="button"
                data-testid="flow-duplicado"
                onClick={() => openFlow("duplicado")}
                className="rounded-full bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm hover:text-slate-950"
              >
                Revisar duplicados
              </button>
              <button
                type="button"
                data-testid="flow-faltantes"
                onClick={() => openFlow("faltantes")}
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

      {talking || dock ? (
        <div className="mx-auto mt-4 w-full max-w-2xl">
          <Composer text={text} setText={setText} onSubmit={() => ask(text)} />
        </div>
      ) : null}
    </section>
  );
}

function FlowChip({ label, testId, onClick }: { label: string; testId: string; onClick: () => void }) {
  return (
    <button type="button" data-testid={testId} onClick={onClick} className="rounded-full bg-slate-50 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100">
      {label}
    </button>
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
