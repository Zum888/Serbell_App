import { expect, it } from "vitest";
import { agingKey } from "@/lib/aging";

it("clasifica el atraso contra la fecha de hoy", () => {
  expect(agingKey("2026-11-20", "2026-11-17")).toBe("current");
  expect(agingKey("2026-11-17", "2026-11-17")).toBe("current");
  expect(agingKey("2026-11-05", "2026-11-17")).toBe("d30");
  expect(agingKey("2026-10-18", "2026-11-17")).toBe("d30");
  expect(agingKey("2026-10-10", "2026-11-17")).toBe("d60");
  expect(agingKey("2026-09-01", "2026-11-17")).toBe("d60plus");
});
