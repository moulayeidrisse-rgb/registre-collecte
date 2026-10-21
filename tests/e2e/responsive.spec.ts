import { expect, test } from "@playwright/test";
import { login, USERS } from "./helpers";

test("navigation mobile : menu en tiroir, pas de défilement horizontal", async ({ page }) => {
  await login(page, USERS.agent1);
  const nav = page.getByRole("navigation", { name: "Navigation principale" });
  await expect(nav).toBeHidden();
  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  await page.getByRole("dialog", { name: "Menu" }).getByRole("link", { name: "Collecte" }).click();
  await expect(page).toHaveURL(/\/collecte$/);
  await expect(page.getByRole("dialog", { name: "Menu" })).toHaveCount(0);
  for (const url of ["/tableau-de-bord", "/collecte", "/reponses"]) {
    await page.goto(url);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `débordement horizontal sur ${url}`).toBeLessThanOrEqual(0);
  }
});
