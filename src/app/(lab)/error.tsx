"use client";

import { StateView } from "@/components/state-view";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="space-y-3">
      <StateView variant="error" title="No se pudo cargar esta pantalla." description="La página encontró un error al leer los datos." />
      <button className="rounded-full border border-border bg-white px-4 py-2 text-sm" onClick={reset} type="button">
        Reintentar
      </button>
    </div>
  );
}
