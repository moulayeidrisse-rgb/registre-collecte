import { expect, test } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("Interface bilingue français / arabe", () => {
  test("bascule en arabe : sens droite-à-gauche, textes traduits, choix mémorisé", async ({ page }) => {
    await login(page, USERS.agent1);
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await page.getByRole("button", { name: "العربية" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.getByRole("heading", { level: 1, name: "لوحة القيادة" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "القائمة الرئيسية" }).getByRole("link", { name: "الجمع الميداني" })).toBeVisible();

    // la préférence est conservée au rechargement et sur les autres pages
    await page.goto("/reponses");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1, name: "ردودي" })).toBeVisible();

    await page.getByRole("button", { name: "Français" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByRole("heading", { level: 1, name: "Mes réponses" })).toBeVisible();
  });

  test("messages d'erreur serveur traduits en arabe", async ({ page, context }) => {
    await context.addCookies([{ name: "lang", value: "ar", url: "http://localhost:3100" }]);
    await page.goto("/connexion");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await page.getByLabel("البريد الإلكتروني").fill(USERS.agent4);
    await page.getByLabel("كلمة المرور").fill("mauvais-mot-de-passe-9");
    await page.getByRole("button", { name: "تسجيل الدخول" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "بيانات" })).toHaveText("بيانات الدخول غير صحيحة أو الحساب غير مفعّل.");
  });
});
