"use client";

import { createContext, useContext } from "react";

const PinContext = createContext<() => void>(() => {});

export function ChatPinProvider({ pin, children }: { pin: () => void; children: React.ReactNode }) {
  return <PinContext.Provider value={pin}>{children}</PinContext.Provider>;
}

export function useChatPin() {
  return useContext(PinContext);
}
