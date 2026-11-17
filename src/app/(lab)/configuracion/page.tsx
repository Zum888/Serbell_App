import Link from "next/link";
import { StateView } from "@/components/state-view";

export default function SettingsPage() {
  return (
    <div className="space-y-3">
      <StateView variant="empty" title="La configuración general no está implementada." description="El catálogo de categorías sí se puede editar." />
      <Link href="/categorias" className="text-sm font-medium text-primary">Ir a categorías</Link>
    </div>
  );
}
