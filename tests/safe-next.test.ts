import { expect, it } from "vitest";
import { safeNext } from "@/lib/utils";

it("keeps an ordinary path", () => {
  expect(safeNext("/movimientos?fila=1", "/")).toBe("/movimientos?fila=1");
  expect(safeNext("/", "/firma")).toBe("/");
});

it("rejects a tab and the other open-redirect tricks", () => {
  const fallback = "/firma";
  expect(safeNext("/\t/evil.com", fallback)).toBe(fallback);
  expect(safeNext("/\n/evil.com", fallback)).toBe(fallback);
  expect(safeNext("/\r/evil.com", fallback)).toBe(fallback);
  expect(safeNext("/%09/evil.com", fallback)).toBe(fallback);
  expect(safeNext("/%2f%2fevil.com", fallback)).toBe(fallback);
  expect(safeNext("//evil.com", fallback)).toBe(fallback);
  expect(safeNext("/\\evil.com", fallback)).toBe(fallback);
  expect(safeNext("https://evil.com", fallback)).toBe(fallback);
  expect(safeNext(null, fallback)).toBe(fallback);
});
