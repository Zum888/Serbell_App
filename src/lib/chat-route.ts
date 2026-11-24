import type { PulseFlow } from "@/lib/pulse";

export type ChatRoute =
  | { kind: "flow"; flow: PulseFlow }
  | { kind: "section"; href: string; flujo: string; handoff: string };

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function chatRoute(text: string): ChatRoute | null {
  const value = normalize(text);
  if (!value) return null;
  if (/faltan comprobantes|comprobantes faltantes|pedir comprobantes/.test(value)) {
    return { kind: "flow", flow: "faltantes" };
  }
  if (/duplicad/.test(value)) return { kind: "flow", flow: "duplicado" };
  if (/conciliar (una )?factura|\bfactura\b|\bticket\b/.test(value)) return { kind: "flow", flow: "factura" };
  if (/conciliar (un )?lote|\blote\b/.test(value)) return { kind: "flow", flow: "lote" };
  if (/por cobrar|quien(es)? debe|clientes que deben/.test(value)) {
    return { kind: "section", href: "/por-cobrar?con=chat&flujo=cobro", flujo: "cobro", handoff: "Seguimos en Por cobrar." };
  }
  if (/por pagar|cuentas por pagar|gastos fijos/.test(value)) {
    return { kind: "section", href: "/por-pagar?con=chat&flujo=pagar", flujo: "pagar", handoff: "Seguimos en Por pagar." };
  }
  if (/(analiza|analizar|analisis).{0,24}(gasto|gastos)|mis gastos/.test(value)) {
    return { kind: "section", href: "/reportes?con=chat&flujo=gastos", flujo: "gastos", handoff: "Seguimos en Reportes." };
  }
  if (/cuanto gane|cuanto ingrese|cuanto entre|mis ingresos|cuanto vendi|flujo de efectivo/.test(value)) {
    return { kind: "section", href: "/reportes?con=chat&flujo=efectivo", flujo: "efectivo", handoff: "Seguimos en Reportes." };
  }
  if (/categor/.test(value)) {
    return { kind: "section", href: "/categorias?con=chat&flujo=clasificar", flujo: "clasificar", handoff: "Seguimos en Categorías." };
  }
  if (/reporte/.test(value)) {
    return { kind: "section", href: "/reportes?con=chat&flujo=efectivo", flujo: "efectivo", handoff: "Seguimos en Reportes." };
  }
  if (/rastre|\bbancos?\b|\bmovimiento\b/.test(value)) {
    return { kind: "section", href: "/movimientos?con=chat&flujo=banco", flujo: "banco", handoff: "Seguimos en Bancos." };
  }
  return null;
}
