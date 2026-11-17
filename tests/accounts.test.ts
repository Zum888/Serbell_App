import { expect, it } from "vitest";
import { accountInitials, movementRunningCents } from "@/lib/accounts";

it("arma las iniciales y la suma corrida de los movimientos", () => {
  expect(accountInitials("Bank of America")).toBe("BA");
  expect(accountInitials("Chase")).toBe("CH");
  const rows = [
    { id: "b", day: "2026-10-09", amountCents: -2340 },
    { id: "a", day: "2026-10-06", amountCents: -5120 },
    { id: "c", day: "2026-10-23", amountCents: 80000 },
  ];
  expect(movementRunningCents(rows, "a")).toBe(-5120);
  expect(movementRunningCents(rows, "b")).toBe(-7460);
  expect(movementRunningCents(rows, "c")).toBe(72540);
  expect(movementRunningCents(rows, "missing")).toBeNull();
});
