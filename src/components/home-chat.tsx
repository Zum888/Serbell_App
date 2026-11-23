"use client";

import { ArrowUp, Mic, Sparkles } from "lucide-react";
import { useState } from "react";
import { DuplicateFlow } from "@/components/duplicate-flow";
import { MissingFlow } from "@/components/missing-flow";
import { NarratedFlow } from "@/components/narrated-flow";
import { ProactiveHome } from "@/components/proactive-home";
import { LoteFlow } from "@/components/lote-flow";
import { InvoiceFlow } from "@/components/ticket-flow";
import { GUIDE_REPLY, isTalk, talkReply, type Briefing } from "@/lib/briefing";
import type { HomeStart } from "@/lib/home-starts";
import { UNSUPPORTED_REPLY, parseIntent } from "@/lib/intent";
import type { Pulse, PulseFlow } from "@/lib/pulse";
import { useChatPin } from "@/components/chat-pin";
import { greetingName } from "@/lib/labels";

type Bubble = { id: string; role: "user" | "assistant"; body: string };

const LANDED: Record<string, string> = {
  factura: "Te dejé en Bancos, en el movimiento de esa factura.",
  lote: "Te dejé en Bancos para seguir el lote.",
  duplicado: "Te dejé en Bancos para revisar los duplicados.",
  faltantes: "Te dejé en Bancos con los comprobantes que faltaban.",
  cobro: "Te dejé en Por cobrar, en el recordatorio.",
  clasificar: "Te dejé en los gastos para seguir la clasificación.",
  efectivo: "Te dejé en el flujo de efectivo.",
};

export function HomeChat({
  name,
  briefing,
  pulse,
  dock = false,
  landed = null,
  onFresh,
}: {
  name: string;
  briefing: Briefing;
  starts: HomeStart[];
  pulse: Pulse | null;
  dock?: boolean;
  landed?: string | null;
  onFresh?: () => void;
}) {
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [text, setText] = useState("");
  const [flow, setFlow] = useState<PulseFlow | null>(null);
  const pin = useChatPin();

  function openFlow(next: PulseFlow) {
    pin(next);
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
        ) : flow && pulse?.stories[flow] ? (
          <div className="mx-auto w-full max-w-2xl flex-1">
            <NarratedFlow testId={`${flow}-flow`} story={pulse.stories[flow]} />
          </div>
        ) : landedLine ? (
          <div className="mx-auto w-full max-w-2xl flex-1 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-[#3f6b4e]">Listo</p>
            <p className="text-[15px] leading-7 text-slate-800">{landedLine}</p>
            <button
              type="button"
              data-testid="empezar-otro"
              onClick={() => (onFresh ?? reset)()}
              className="rounded-full border border-[#e6e1d8] bg-white px-3 py-1.5 text-sm font-medium text-stone-800"
            >
              Empezar otro
            </button>
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
        ) : pulse ? (
          <ProactiveHome name={name} pulse={pulse} onFlow={openFlow} />
        ) : (
          <div className="mx-auto w-full max-w-2xl">
            <h1 className="text-4xl font-medium tracking-tight text-slate-900">Buenos días, {greetingName(name)}</h1>
            <p className="mt-3 text-[15px] text-slate-500">{briefing.companyName}. ¿Por dónde seguimos?</p>
          </div>
        )}
      </div>

      <div className="mx-auto mt-4 w-full max-w-3xl">
        <Composer text={text} setText={setText} onSubmit={() => ask(text)} wide={!dock && !talking} />
      </div>
      {!dock && !talking ? (
        <p className="mt-3 text-center text-xs text-slate-500">
          <span className="mr-1 inline-block size-1.5 rounded-full bg-emerald-500" />
          Serbell está monitoreando tus finanzas 24/7
        </p>
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

function Composer({ text, setText, onSubmit, wide = false }: { text: string; setText: (value: string) => void; onSubmit: () => void; wide?: boolean }) {
  return (
    <form
      className="flex items-center gap-2 rounded-full border border-[#e6e1d8] bg-white px-3 py-2 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <Sparkles className="ml-1 size-4 shrink-0 text-stone-900" />
      <input
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={wide ? "Escribe o pídele algo a Serbell..." : "Escribe a Serbell"}
        aria-label="Mensaje para Serbell"
        className="h-9 min-w-0 flex-1 bg-transparent text-[15px] outline-none"
      />
      <span className="grid size-8 place-items-center text-slate-400" aria-hidden>
        <Mic className="size-4" />
      </span>
      <button type="submit" aria-label="Enviar" className="grid size-9 place-items-center rounded-full bg-stone-900 text-[#f7f6f4]">
        <ArrowUp className="size-4" />
      </button>
    </form>
  );
}
