import { expect, it } from "vitest";
import { findFixedPayment, fixedStatus, monthName } from "@/lib/fixed";
import { cashDays, change, headline, waterfall, weekly } from "@/lib/insights";

it("la cascada va del saldo inicial al saldo final guardado", () => {
  const steps = waterfall({
    closingCents: 10_000,
    inflows: 5_000,
    categories: [
      { category: "A", totalCents: 1_000 },
      { category: "B", totalCents: 2_000 },
      { category: "C", totalCents: 300 },
      { category: "D", totalCents: 200 },
      { category: "E", totalCents: 100 },
    ],
  });
  expect(steps[0]).toMatchObject({ label: "Saldo inicial", end: 8_600 });
  expect(steps.at(-1)).toMatchObject({ label: "Saldo final", end: 10_000 });
  expect(steps.find((step) => step.label === "Otros")?.value).toBe(-100);
  expect(steps[2].label).toBe("B");
});

it("el titular compara el neto contra el mes anterior", () => {
  const text = headline({ month: "2026-10", inflows: 300, outflows: 100, net: 200 }, { month: "2026-09", inflows: 200, outflows: 100, net: 100 });
  expect(text).toContain("Octubre");
  expect(text).toContain("100% mejor que sep");
  expect(change(50, 0)).toBeNull();
});

it("agrupa por semana y calcula días de caja", () => {
  const weeks = weekly([
    { day: "2026-10-01", inflows: 10, outflows: 0 },
    { day: "2026-10-08", inflows: 0, outflows: 5 },
    { day: "2026-10-31", inflows: 0, outflows: 7 },
  ]);
  expect(weeks.map((week) => week.label)).toEqual(["1–7", "8–14", "29–31"]);
  expect(cashDays(3000, 3000, 30)).toBe(30);
  expect(cashDays(3000, 0, 30)).toBeNull();
});

it("un gasto fijo se marca pagado solo con un movimiento del mes, del comercio y de monto parecido", () => {
  const expense = { matchHint: "state farm", amountCents: 98_000 };
  const movements = [
    { id: "sep", day: "2026-09-04", merchant: "State Farm", amountCents: -98_000 },
    { id: "far", day: "2026-10-04", merchant: "State Farm", amountCents: -50_000 },
    { id: "ok", day: "2026-10-05", merchant: "STATE FARM INS", amountCents: -101_000 },
  ];
  expect(findFixedPayment(expense, "2026-10", movements)?.id).toBe("ok");
  expect(findFixedPayment(expense, "2026-11", movements)).toBeNull();
  expect(fixedStatus({ paid: false, dueDay: 5, referenceDay: 20 })).toBe("vencido");
  expect(fixedStatus({ paid: false, dueDay: 25, referenceDay: 20 })).toBe("pendiente");
  expect(monthName("2026-10")).toBe("Octubre 2026");
});
