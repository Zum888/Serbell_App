import { describe, expect, it } from "vitest";
import { chatRoute } from "@/lib/chat-route";

describe("a dónde lleva una pregunta", () => {
  it("deja en Inicio lo que no corresponde a una sección", () => {
    expect(chatRoute("hola")).toBeNull();
    expect(chatRoute("estado de operaciones")).toBeNull();
  });

  it("abre el flujo cuando la pregunta es una tarea guiada", () => {
    expect(chatRoute("Revisar duplicados")).toEqual({ kind: "flow", flow: "duplicado" });
    expect(chatRoute("Conciliar una factura")).toEqual({ kind: "flow", flow: "factura" });
    expect(chatRoute("Pedir comprobantes")).toEqual({ kind: "flow", flow: "faltantes" });
  });

  it("lleva la misma plática a la sección", () => {
    expect(chatRoute("¿Quién debe?")).toMatchObject({ kind: "section", href: "/por-cobrar?con=chat&flujo=cobro" });
    expect(chatRoute("Analiza mis gastos")).toMatchObject({ kind: "section", flujo: "gastos" });
    expect(chatRoute("Rastréame este movimiento")).toMatchObject({ kind: "section", href: "/movimientos?con=chat&flujo=banco" });
    expect(chatRoute("los gastos fijos")).toMatchObject({ kind: "section", href: "/por-pagar?con=chat&flujo=pagar" });
  });
});
