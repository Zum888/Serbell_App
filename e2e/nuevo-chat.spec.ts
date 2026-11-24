import { expect, test } from "@playwright/test";

test("Nuevo chat vuelve al inicio y la pregunta sigue en la sección", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Buenos días/ })).toBeVisible();
  await expect(page.getByText("Lo que hice por ti")).toBeVisible();
  const nuevo = page.getByTestId("nav-inicio");
  await expect(nuevo).toContainText("Nuevo chat");
  const plus = nuevo.locator("svg");
  await expect(plus).toBeVisible();
  const row = await nuevo.boundingBox();
  const mark = await plus.boundingBox();
  expect(row && mark && mark.x > row.x + row.width / 2).toBeTruthy();

  await page.getByLabel("Mensaje para Serbell").fill("¿Quién debe?");
  await page.getByRole("button", { name: "Enviar" }).click();
  await page.waitForURL(/\/por-cobrar\?/);
  const chat = page.getByTestId("home-chat");
  await expect(chat).toBeVisible();
  await expect(chat).toContainText("¿Quién debe?");
  await expect(chat).toContainText("Seguimos en Por cobrar.");
  await expect(page.getByTestId("chat-close")).toBeVisible();

  await nuevo.click();
  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.getByRole("heading", { name: /Buenos días/ })).toBeVisible();
  await expect(page.getByText("Lo que hice por ti")).toBeVisible();
  await expect(page.getByText("Seguimos en Por cobrar.")).toHaveCount(0);

  await page.getByTestId("nav-movimientos").click();
  await page.waitForURL(/\/movimientos/);
  await expect(page.getByTestId("home-chat")).toHaveCount(0);

  await nuevo.click();
  await page.waitForURL((url) => url.pathname === "/");
  await page.getByLabel("Mensaje para Serbell").fill("hola");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByTestId("home-chat")).toContainText("hola");
  await expect(page.getByText("Lo que hice por ti")).toHaveCount(0);
  await nuevo.click();
  await expect(page.getByText("Lo que hice por ti")).toBeVisible();
  await expect(page.getByText("hola")).toHaveCount(0);
});
