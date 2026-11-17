import { StateView } from "@/components/state-view";

const copy: Record<string, string> = {
  cobrar: "Esta cifra es de demostración. No hay facturas vencidas en la base y no se cobró nada.",
  pagar: "Pagar no está implementado. No se creó ningún movimiento.",
};

export default async function NotDonePage({ searchParams }: { searchParams: Promise<{ tema?: string }> }) {
  const { tema } = await searchParams;
  const specific = copy[tema ?? ""];
  return (
    <StateView
      variant="empty"
      title={specific ?? "Esta acción no está implementada."}
      description={specific ? "No se creó ningún movimiento ni ninguna factura." : "Esta parte del laboratorio no está construida."}
    />
  );
}
