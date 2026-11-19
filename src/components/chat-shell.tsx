"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChatPinProvider } from "@/components/chat-pin";
import { HomeChat } from "@/components/home-chat";
import type { Briefing } from "@/lib/briefing";
import type { HomeStart } from "@/lib/home-starts";

export function ChatShell({
  name,
  briefing,
  starts,
  children,
}: {
  name: string;
  briefing: Briefing;
  starts: HomeStart[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [pinned, setPinned] = useState(false);
  const [fromUrl, setFromUrl] = useState(false);
  const [flujo, setFlujo] = useState<string | null>(null);
  const home = pathname === "/";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setFromUrl(params.get("con") === "chat");
    setFlujo(params.get("flujo"));
  }, [pathname]);

  const bank = pathname.startsWith("/movimientos") || pathname.startsWith("/cuentas");
  const show = home || ((pinned || fromUrl) && bank);
  const dock = show && !home;

  return (
    <ChatPinProvider pin={() => setPinned(true)}>
      <div className={dock ? "flex items-start gap-4" : show ? "space-y-8" : ""}>
        {show ? (
          <div className={dock ? "sticky top-0 flex h-[calc(100vh-5rem)] w-[320px] shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-white p-3" : ""}>
            <HomeChat dock={dock} landed={dock ? flujo : null} name={name} briefing={briefing} starts={starts} />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </ChatPinProvider>
  );
}
