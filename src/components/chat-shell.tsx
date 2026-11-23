"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ChatPinProvider } from "@/components/chat-pin";
import { HomeChat } from "@/components/home-chat";
import type { Briefing } from "@/lib/briefing";
import type { HomeStart } from "@/lib/home-starts";
import type { Pulse } from "@/lib/pulse";

const PIN_KEY = "serbell-chat";
const FLOW_KEY = "serbell-flujo";
const FOLD_KEY = "serbell-chat-fold";

export function ChatShell({
  name,
  briefing,
  starts,
  pulse,
  children,
}: {
  name: string;
  briefing: Briefing;
  starts: HomeStart[];
  pulse: Pulse | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [pinned, setPinned] = useState(false);
  const [flujo, setFlujo] = useState<string | null>(null);
  const [fromUrl, setFromUrl] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const home = pathname === "/";
  const bank = pathname.startsWith("/movimientos") || pathname.startsWith("/cuentas") || pathname.startsWith("/por-cobrar") || pathname.startsWith("/por-pagar") || pathname.startsWith("/reportes") || pathname.startsWith("/categorias");

  useEffect(() => {
    if (sessionStorage.getItem(PIN_KEY) === "1") {
      setPinned(true);
      setFlujo((current) => current ?? sessionStorage.getItem(FLOW_KEY));
    }
    if (sessionStorage.getItem(FOLD_KEY) === "1") setCollapsed(true);
  }, []);

  useEffect(() => {
    function onReset() {
      sessionStorage.removeItem(FLOW_KEY);
      sessionStorage.setItem(PIN_KEY, "1");
      sessionStorage.setItem(FOLD_KEY, "0");
      const url = new URL(window.location.href);
      url.searchParams.delete("flujo");
      url.searchParams.delete("con");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
      setFlujo(null);
      setPinned(true);
      setCollapsed(false);
      setEpoch((value) => value + 1);
    }
    window.addEventListener("serbell-chat-reset", onReset);
    return () => window.removeEventListener("serbell-chat-reset", onReset);
  }, []);

  function pin(next?: string) {
    sessionStorage.setItem(PIN_KEY, "1");
    sessionStorage.setItem(FOLD_KEY, "0");
    setCollapsed(false);
    if (next) {
      sessionStorage.setItem(FLOW_KEY, next);
      setFlujo(next);
    }
    setPinned(true);
  }

  function toggleFold() {
    setCollapsed((value) => {
      const next = !value;
      sessionStorage.setItem(FOLD_KEY, next ? "1" : "0");
      return next;
    });
  }

  const show = home || ((pinned || fromUrl) && bank);
  const dock = show && !home;
  const folded = dock && (collapsed || drawer);

  return (
    <ChatPinProvider pin={pin}>
      <Suspense fallback={null}>
        <ChatQuery onQuery={(chat, flow, movementOpen) => {
          setFromUrl(chat);
          if (flow) setFlujo(flow);
          setDrawer(movementOpen);
        }} />
      </Suspense>
      <div className={dock ? "flex items-start gap-3" : show ? "space-y-8" : ""}>
        {dock ? (
          <button
            type="button"
            data-testid="chat-spine"
            aria-expanded={!folded}
            aria-label={folded ? "Abrir el chat" : "Ocultar el chat"}
            title={drawer && !collapsed ? "El chat vuelve cuando cierres el movimiento" : folded ? "Abrir el chat" : "Ocultar el chat"}
            onClick={() => {
              if (drawer && !collapsed) return;
              toggleFold();
            }}
            className="sticky top-0 flex h-[calc(100vh-5rem)] w-10 shrink-0 items-center justify-center rounded-2xl border border-[#e6e1d8] bg-white text-sm font-medium tracking-[0.2em] text-stone-700"
            style={{ writingMode: "vertical-rl" }}
          >
            Serbell
          </button>
        ) : null}
        {show && !folded ? (
          <div className={dock ? "sticky top-0 flex h-[calc(100vh-5rem)] w-[320px] shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-white p-3" : ""}>
            <HomeChat key={epoch} dock={dock} landed={dock ? flujo : null} name={name} briefing={briefing} starts={starts} pulse={pulse} onFresh={() => window.dispatchEvent(new Event("serbell-chat-reset"))} />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </ChatPinProvider>
  );
}

function ChatQuery({ onQuery }: { onQuery: (chat: boolean, flujo: string | null, drawer: boolean) => void }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const chat = params.get("con") === "chat";
  const flujo = params.get("flujo");
  const drawer = pathname.startsWith("/movimientos") && Boolean(params.get("movimiento") || params.get("fila") || params.get("recibo"));
  const onQueryRef = useRef(onQuery);
  onQueryRef.current = onQuery;
  useEffect(() => {
    onQueryRef.current(chat, flujo, drawer);
  }, [chat, flujo, drawer, pathname]);
  return null;
}
