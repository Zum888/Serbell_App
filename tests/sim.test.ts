import { describe, expect, it } from "vitest";
import { BRIDGE, CASH_GAP, CASH_WITH_COLLECTION, PROJECTS } from "@/sim/model";
import { FLOWS, play } from "@/sim/flows";

const flow = (id: string) => {
  const found = FLOWS.find((item) => item.id === id);
  if (!found) throw new Error(id);
  return found;
};

describe("simulador", () => {
  it("cierra el puente de utilidad y efectivo", () => {
    const parts = BRIDGE.filter((line) => line.id !== "banco").reduce((sum, line) => sum + line.cents, 0);
    const bank = BRIDGE.find((line) => line.id === "banco");
    expect(parts).toBe(bank?.cents);
    expect(bank?.cents).toBe(-480_000);
  });

  it("muestra el viernes en rojo y lo levanta si entra el cobro", () => {
    expect(CASH_GAP.find((day) => day.day.startsWith("Vie"))?.cents).toBeLessThan(0);
    expect(CASH_WITH_COLLECTION.find((day) => day.day.startsWith("Vie"))?.cents).toBe(230_000);
  });

  it("registra el ticket una sola vez y lo deja revisado", () => {
    const frames = play(flow("ticket"));
    const last = frames.at(-1);
    if (!last) throw new Error("sin escena");
    expect(last.documents).toHaveLength(1);
    expect(last.movements).toHaveLength(3);
    expect(last.movements.filter((move) => move.receipt)).toHaveLength(1);
    expect(last.movements.find((move) => move.receipt)?.review).toBe("Revisado");
    expect(last.documents[0]?.status).toBe("Revisado");
    expect(last.banner).toMatch(/vinculada/i);
  });

  it("no guarda el ticket si se rechaza", () => {
    const last = play(flow("ticket"), { elegir: "reject", rechazo: "importe" }).at(-1);
    expect(last?.documents).toHaveLength(0);
    expect(last?.messages.at(-1)?.body).toMatch(/No guardé/);
    expect(last?.movements.every((move) => move.receipt === null)).toBe(true);
  });

  it("guarda el proveedor editado sin duplicar el movimiento", () => {
    const frames = play(flow("ticket"), { elegir: "edit" });
    const edited = frames.find((frame) => frame.decision === "edited");
    expect(edited).toBeTruthy();
    const last = frames.at(-1);
    expect(last?.documents[0]?.merchant).toBe("Home Depot");
    expect(last?.movements).toHaveLength(3);
  });

  it("no borra los cargos duplicados", () => {
    for (const choice of ["distintos", "investigar", "reclamo"]) {
      const last = play(flow("duplicados"), { elegir: choice }).at(-1);
      expect(last?.movements).toHaveLength(2);
      expect(last?.duplicateNote).toBeTruthy();
    }
  });

  it("prepara los tres comprobantes faltantes", () => {
    const last = play(flow("faltantes")).at(-1);
    expect(last?.documents).toHaveLength(3);
    expect(last?.movements.every((move) => move.receipt)).toBe(true);
    expect(last?.person).toBe("carlos");
  });

  it("marca la factura cobrada solo después del depósito de demostración", () => {
    const last = play(flow("cobrar")).at(-1);
    expect(last?.sent).toBe(true);
    expect(last?.ar[0]?.status).toBe("Pagado");
    expect(last?.movements).toHaveLength(1);
  });

  it("no ejecuta el pago al proveedor", () => {
    const last = play(flow("pagar")).at(-1);
    expect(last?.simulatedPayment).toBe(true);
    expect(last?.ap[0]?.note).toMatch(/no se ejecutó/i);
    expect(last?.movements).toHaveLength(0);
  });

  it("deja a Rivera sin excepciones y sin cerrar el periodo", () => {
    const last = play(flow("cierre")).at(-1);
    const rivera = last?.firm.find((row) => row.id === "rivera");
    expect(rivera?.exceptions).toHaveLength(0);
    expect(rivera?.progress).toBe(100);
    expect(last?.messages.at(-1)?.body).toMatch(/no se cerró solo/i);
  });

  it("señala la obra que pierde", () => {
    const sol = PROJECTS.find((item) => item.id === "sol");
    expect((sol?.income ?? 0) - (sol?.cost ?? 0)).toBe(-180_000);
    const last = play(flow("proyectos")).at(-1);
    expect(last?.openProject).toBe("sol");
    expect(last?.suggestion).toMatch(/Obra Sol/);
  });

  it("cierra la mañana con los tres asuntos resueltos", () => {
    const last = play(flow("manana")).at(-1);
    expect(last?.banner).toMatch(/Todo está en orden/);
    expect(last?.documents).toHaveLength(1);
    expect(last?.reminder).toBeTruthy();
  });

  it("recorre los diez flujos sin tirar la escena inicial", () => {
    expect(FLOWS).toHaveLength(10);
    for (const item of FLOWS) {
      const first = item.opening();
      const frames = play(item);
      expect(frames.length).toBeGreaterThan(1);
      expect(item.opening()).toEqual(first);
    }
  });
});
