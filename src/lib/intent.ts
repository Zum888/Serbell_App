export type Intent =
  | { type: "operation_status" }
  | { type: "confirm_extraction" }
  | { type: "search_matches" }
  | { type: "confirm_link" }
  | { type: "reject_link" }
  | { type: "change_category"; category: string; subcategory: string }
  | { type: "answer_request"; body: string }
  | { type: "unsupported" }
  | { type: "note" };

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function parseIntent(text: string): Intent {
  const value = normalize(text);
  const answer = value.match(/^responder\b[:\s-]+(.+)$/);
  if (answer?.[1]) return { type: "answer_request", body: answer[1].trim() };

  const category = value.match(/categoria(?:\s+a)?\s+(.+?)\s*\/\s*(.+)$/);
  if (category?.[1] && category[2]) {
    return { type: "change_category", category: category[1].trim(), subcategory: category[2].trim() };
  }

  if (/(confirmar datos|datos correctos|los datos estan bien|verificar datos)/.test(value)) {
    return { type: "confirm_extraction" };
  }
  if (/(buscar coincidencia|buscar movimiento|buscar en el banco)/.test(value)) {
    return { type: "search_matches" };
  }
  if (/(confirmar vinculo|vincular movimiento)/.test(value)) {
    return { type: "confirm_link" };
  }
  if (/(rechazar vinculo|revisar despues)/.test(value)) {
    return { type: "reject_link" };
  }
  if (value === "estado" || /(estado de operaciones|como vamos|estado de la operacion)/.test(value)) {
    return { type: "operation_status" };
  }
  if (
    /(plaid|whatsapp|cerrar el mes|cierre de periodo|cierre del mes|conciliar el extracto|conectar banco|nominas|correr nomina)/.test(
      value,
    )
  ) {
    return { type: "unsupported" };
  }
  return { type: "note" };
}

export const UNSUPPORTED_REPLY = "Esta acción no está implementada.";

export const NOTE_REPLY =
  "Guardé tu mensaje. No ejecuté ninguna acción. Puedes confirmar datos, buscar coincidencias, confirmar o rechazar un vínculo, cambiar la categoría, responder una solicitud o pedir el estado de operaciones.";
