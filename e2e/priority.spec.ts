import { expect, test } from "@playwright/test";
import { CAT, TX } from "../src/lib/ids";

test("Padrino vincula el ticket y Carlos lo sella", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Buenos días, Padrino/ })).toBeVisible();
  await expect(page.getByTestId("bank-balance")).toContainText("33,366.24");

  await page.getByTestId("nav-chat").click();
  await page.getByTestId("chat-file-input").setInputFiles("fixtures/FleetSmarts_ticket.jpg");
  await page.getByTestId("upload-submit").click();
  await page.waitForURL(/\/chat\?documento=/);
  await expect(page.getByTestId("extraction-demo-badge")).toBeVisible();
  await expect(page.getByTestId("extraction-merchant")).toContainText("FleetSmarts");
  await expect(page.getByTestId("extraction-amount")).toContainText("203.94");
  await expect(page.getByTestId("extraction-date")).toContainText("2026");

  await page.getByTestId("confirm-extraction").click();
  await expect(page.getByTestId("match-reasons")).toContainText("203.94");
  await expect(page.getByTestId("match-reasons")).toContainText("FleetSmarts");
  await page.getByTestId("confirm-link").click();
  await expect(page.getByTestId("link-success")).toBeVisible();

  await page.getByTestId("nav-movimientos").click();
  const row = page.getByTestId(`movement-row-${TX.fs20394}`);
  await expect(row.getByTestId("doc-state")).toHaveText("Vinculado");

  await page.getByTestId("profile-switcher").click();
  await page.getByTestId("profile-option-usr_carlos").click();
  await expect(page.getByRole("heading", { name: /Buenos días, Carlos/ })).toBeVisible();
  await page.getByTestId("company-open-co_qpl").click();
  await page.waitForURL(/\/movimientos/);
  await page.getByTestId(`movement-row-${TX.fs20394}`).getByRole("link", { name: "Ver" }).click();
  await expect(page.getByTestId("drawer-document")).toContainText("FleetSmarts");
  await expect(page.getByTestId("drawer-classification")).toContainText("Combustible");
  await expect(page.getByTestId("drawer-conversation")).toContainText("Vínculo confirmado");
  await expect(page.getByTestId("drawer-history")).toContainText("Vínculo confirmado");
  await page.getByTestId("approve-seal").click();
  await expect(page.getByTestId("drawer").getByText("Autorizado y bloqueado")).toBeVisible();

  await page.getByTestId("profile-switcher").click();
  await page.getByTestId("profile-option-usr_padrino").click();
  await expect(page.getByRole("heading", { name: /Buenos días, Padrino/ })).toBeVisible();
  await page.getByTestId("nav-movimientos").click();
  const sealed = page.getByTestId(`movement-row-${TX.fs20394}`);
  await expect(sealed.getByTestId("review-state")).toHaveText("Aprobado");
  await expect(sealed.getByTestId("seal-lock")).toHaveAttribute("data-locked", "true");
  await page.reload();
  await expect(page.getByTestId(`movement-row-${TX.fs20394}`).getByTestId("seal-lock")).toHaveAttribute("data-locked", "true");

  await page.getByTestId(`movement-row-${TX.fs20394}`).getByRole("link", { name: "Ver" }).click();
  await page.getByTestId("save-classification").click();
  await expect(page.getByTestId("server-error")).toContainText("rechazó la edición");

  const denied = await page.request.post(`/api/transactions/${TX.fs20394}/classification`, {
    form: { subcategoryId: CAT.qpl.peajes, justification: "no debe aplicar" },
    maxRedirects: 0,
  });
  expect(denied.status()).toBe(303);
  expect(denied.headers().location ?? "").toContain("rechaz");

  const isolated = await page.request.get("/api/companies/co_rivera");
  expect(isolated.status()).toBe(403);
});
