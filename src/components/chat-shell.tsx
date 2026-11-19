"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ChatPinProvider } from "@/components/chat-pin";
import { HomeChat } from "@/components/home-chat";
import type { Briefing } from "@/lib/briefing";
import type { HomeStart } from "@/lib/home-starts";
import type { Pulse } from "@/lib/pulse";

const PIN_KEY = "serbell-chat";
const FLOW_KEY = "serbell-flujo";

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
  const home = pathname === "/";
  const bank = pathname.startsWith("/movimientos") || pathname.startsWith("/cuentas") || pathname.startsWith("/por-cobrar") || pathname.startsWith("/por-pagar") || pathname.startsWith("/reportes") || pathname.startsWith("/categorias");

  useEffect(() => {
    if (sessionStorage.getItem(PIN_KEY) === "1") {
      setPinned(true);
      setFlujo((current) => current ?? sessionStorage.getItem(FLOW_KEY));
    }
  }, []);

  function pin(next?: string) {
    sessionStorage.setItem(PIN_KEY, "1");
    if (next) {
      sessionStorage.setItem(FLOW_KEY, next);
      setFlujo(next);
    }
    setPinned(true);
  }

  const show = home || ((pinned || fromUrl) && bank);
  const dock = show && !home;

  return (
    <ChatPinProvider pin={pin}>
      <Suspense fallback={null}>
        <ChatQuery onQuery={(chat, flow) => {
          setFromUrl(chat);
          if (flow) setFlujo(flow);
        }} />
      </Suspense>
      <div className={dock ? "flex items-start gap-4" : show ? "space-y-8" : ""}>
        {show ? (
          <div className={dock ? "sticky top-0 flex h-[calc(100vh-5rem)] w-[320px] shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-white p-3" : ""}>
            <HomeChat dock={dock} landed={dock ? flujo : null} name={name} briefing={briefing} starts={starts} pulse={pulse} />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </ChatPinProvider>
  );
}

function ChatQuery({ onQuery }: { onQuery: (chat: boolean, flujo: string | null) => void }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const chat = params.get("con") === "chat";
  const flujo = params.get("flujo");
  useEffect(() => {
    onQuery(chat, flujo);
  }, [chat, flujo, pathname, onQuery]);
  return null;
}
