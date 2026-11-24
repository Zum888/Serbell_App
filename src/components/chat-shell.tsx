"use client";

import { X } from "lucide-react";
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
  const [overDrawer, setOverDrawer] = useState(false);
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
      sessionStorage.removeItem(PIN_KEY);
      sessionStorage.setItem(FOLD_KEY, "0");
      setFlujo(null);
      setPinned(false);
      setFromUrl(false);
      setCollapsed(false);
      setOverDrawer(false);
      setEpoch((value) => value + 1);
    }
    window.addEventListener("serbell-chat-reset", onReset);
    return () => window.removeEventListener("serbell-chat-reset", onReset);
  }, []);

  function pin(next?: string) {
    sessionStorage.setItem(PIN_KEY, "1");
    sessionStorage.setItem(FOLD_KEY, "0");
    setCollapsed(false);
    setOverDrawer(true);
    if (next) {
      sessionStorage.setItem(FLOW_KEY, next);
      setFlujo(next);
    }
    setPinned(true);
  }

  function closeTab() {
    sessionStorage.setItem(FOLD_KEY, "1");
    setOverDrawer(false);
    setCollapsed(true);
  }

  function openTab() {
    sessionStorage.setItem(FOLD_KEY, "0");
    setCollapsed(false);
    setOverDrawer(true);
  }

  useEffect(() => {
    setOverDrawer(false);
  }, [drawer]);

  const show = home || ((pinned || fromUrl) && bank);
  const dock = show && !home;
  const folded = dock && !overDrawer && (collapsed || drawer);

  return (
    <ChatPinProvider pin={pin}>
      <Suspense fallback={null}>
        <ChatQuery onQuery={(chat, flow, movementOpen) => {
          setFromUrl(chat);
          if (flow) setFlujo(flow);
          setDrawer(movementOpen);
        }} />
      </Suspense>
      <div className={dock && !folded ? "flex items-start gap-3" : show && !folded ? "space-y-8" : ""}>
        {show ? (
          <div className={folded ? "hidden" : dock ? "sticky top-0 flex h-[calc(100vh-5rem)] w-[320px] shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-white" : ""}>
            {dock ? (
              <div className="flex items-center justify-between border-b border-[#e6e1d8] px-3 py-2">
                <span className="text-sm font-medium text-stone-800">Chat</span>
                <button
                  type="button"
                  data-testid="chat-close"
                  aria-label="Cerrar el chat"
                  title="Cerrar el chat"
                  onClick={closeTab}
                  className="grid size-7 place-items-center rounded-md text-stone-500 hover:bg-[#efede8] hover:text-stone-900"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : null}
            <div className={dock ? "flex min-h-0 flex-1 flex-col p-3" : ""}>
              <HomeChat key={epoch} dock={dock} landed={dock ? flujo : null} name={name} briefing={briefing} starts={starts} pulse={pulse} />
            </div>
          </div>
        ) : null}
        <div className={dock && !folded ? "min-w-0 flex-1" : ""}>
          {folded ? (
            <button
              type="button"
              data-testid="chat-open"
              onClick={openTab}
              className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#e6e1d8] bg-white px-3 py-1.5 text-sm font-medium text-stone-800"
            >
              Chat
            </button>
          ) : null}
          {children}
        </div>
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
