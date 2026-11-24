import { expect, test } from "@playwright/test";

test("los gastos fijos quedan arriba de la gráfica, a la derecha", async ({ page }) => {
  await page.goto("/por-pagar");
  const slot = page.getByTestId("fixed-slot");
  const chart = page.getByTestId("desk-chart");
  await expect(slot).toBeVisible();
  await expect(slot).toContainText("Ya pagados");
  await expect(slot).toContainText("Por pagar");
  await expect(slot.getByTestId("fixed-paid-pct")).toBeVisible();
  const fixed = await slot.boundingBox();
  const graph = await chart.boundingBox();
  expect(fixed && graph && fixed.y < graph.y && fixed.x + 40 > graph.x).toBeTruthy();

  await page.getByTestId("fixed-open").click();
  await expect(page.getByTestId("fixed-list")).toBeVisible();
});
