"use client";

import { useRef, useState } from "react";

export function DemoTicketGrab({ companyId, highlighted }: { companyId: string; highlighted: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const holding = useRef(false);
  const [over, setOver] = useState(false);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);

  function openTicket() {
    formRef.current?.requestSubmit();
  }

  function insideDrop(x: number, y: number) {
    const zone = dropRef.current?.getBoundingClientRect();
    if (!zone) return false;
    return x >= zone.left && x <= zone.right && y >= zone.top && y <= zone.bottom;
  }

  return (
    <form ref={formRef} action="/api/documents/use-demo" method="post" className="grid items-stretch gap-3 sm:grid-cols-[168px_minmax(0,1fr)]">
      <input type="hidden" name="companyId" value={companyId} />
      <button
        type="submit"
        data-testid="demo-ticket"
        className={`cursor-grab rounded-xl border border-border bg-white p-3 text-left text-[11px] leading-5 text-slate-500 shadow-md active:cursor-grabbing ${ghost ? "opacity-40" : "rotate-2"}`}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          holding.current = true;
          moved.current = false;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!holding.current) return;
          if (Math.abs(event.movementX) + Math.abs(event.movementY) > 2) moved.current = true;
          setGhost({ x: event.clientX - 72, y: event.clientY - 28 });
          setOver(insideDrop(event.clientX, event.clientY));
        }}
        onPointerUp={(event) => {
          if (!holding.current) return;
          holding.current = false;
          const landed = insideDrop(event.clientX, event.clientY);
          setGhost(null);
          setOver(false);
          if (moved.current && landed) openTicket();
        }}
        onClick={(event) => {
          if (!moved.current) return;
          event.preventDefault();
          moved.current = false;
        }}
      >
        <p className="font-semibold text-slate-800">FLEETSMARTS</p>
        <p>12 oct 2026</p>
        <p className="mt-2">Combustible</p>
        <p className="font-semibold text-slate-800">USD 203.94</p>
      </button>
      <div
        ref={dropRef}
        data-testid="chat-drop"
        className={`grid place-items-center rounded-2xl border border-dashed px-4 py-6 text-center ${over || highlighted ? "border-primary bg-blue-50" : "border-slate-300"}`}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          openTicket();
        }}
      >
        <p className="text-sm font-medium">{over ? "Soltando el ticket…" : "Suelta el ticket aquí"}</p>
        <p className="mt-1 text-xs text-slate-500">Tómalo y la conversación sigue con este comprobante de demostración.</p>
      </div>
      {ghost ? (
        <div className="pointer-events-none fixed z-[70] w-40 rotate-2 rounded-xl border border-border bg-white p-3 text-[11px] leading-5 text-slate-500 shadow-2xl" style={{ left: ghost.x, top: ghost.y }}>
          <p className="font-semibold text-slate-800">FLEETSMARTS</p>
          <p>USD 203.94</p>
        </div>
      ) : null}
    </form>
  );
}
