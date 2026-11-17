import { StateView } from "@/components/state-view";

const copy: Record<string, string> = {
  gastos: "Analizar mis gastos no está implementado. No se calculó ningún informe.",
  cobros: "Revisar mis cobros no está implementado. No se registró ningún cobro.",
  cobrar: "Cobrar no está implementado. No se creó ningún movimiento.",
  pagar: "Pagar no está implementado. No se creó ningún movimiento.",
};

export default async function NotDonePage({ searchParams }: { searchParams: Promise<{ tema?: string }> }) {
  const { tema } = await searchParams;
  return (
    <StateView
      variant="empty"
      title="Esta acción no está implementada."
      description={copy[tema ?? ""] ?? "Esta parte del laboratorio no está construida."}
    />
  );
}
