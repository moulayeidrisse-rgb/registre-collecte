import { expect, test } from "@playwright/test";
import { USERS } from "./helpers";

test.describe("Authentification", () => {
  test("une page protégée redirige vers la connexion", async ({ page }) => {
    await page.goto("/reponses");
    await expect(page).toHaveURL(/\/connexion\?suite=%2Freponses/);
    await expect(page.getByRole("heading", { name: "Registre Collecte" })).toBeVisible();
  });

  test("message générique en cas d'identifiants incorrects", async ({ page }) => {
    await page.goto("/connexion");
    await page.getByLabel("Adresse électronique").fill(USERS.agent1);
    await page.getByLabel("Mot de passe").fill("mauvais-mot-de-passe-1");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Identifiants" })).toHaveText("Identifiants incorrects ou compte inactif.");
  });

  test("un compte désactivé ne peut pas se connecter", async ({ page }) => {
    await page.goto("/connexion");
    await page.getByLabel("Adresse électronique").fill("agent.inactif@demo.registre.test");
    await page.getByLabel("Mot de passe").fill("Demo-Registre-2026");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Identifiants" })).toHaveText("Identifiants incorrects ou compte inactif.");
  });

  test("connexion, cookie httpOnly, retour à la page demandée et déconnexion", async ({ page, context }) => {
    await page.goto("/qualite");
    await page.getByLabel("Adresse électronique").fill(USERS.admin);
    await page.getByLabel("Mot de passe").fill("Demo-Registre-2026");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/qualite$/);
    const cookie = (await context.cookies()).find((c) => c.name === "rc_session");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
    expect(await page.evaluate(() => document.cookie)).not.toContain("rc_session");

    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(page).toHaveURL(/\/connexion\?deconnecte=1/);
    await page.goto("/tableau-de-bord");
    await expect(page).toHaveURL(/\/connexion/);
  });

  test("un jeton de session inventé est refusé", async ({ page, context }) => {
    await context.addCookies([{ name: "rc_session", value: "jeton-forge-par-un-attaquant", url: "http://localhost:3100" }]);
    await page.goto("/tableau-de-bord");
    await expect(page).toHaveURL(/\/connexion/);
  });

  test("l'export sans session renvoie 401", async ({ request }) => {
    const r = await request.get("/api/export?formId=x");
    expect(r.status()).toBe(401);
  });

  test("redirection ouverte impossible après connexion", async ({ page }) => {
    await page.goto("/connexion?suite=//site-externe.example/piege");
    await page.getByLabel("Adresse électronique").fill(USERS.agent1);
    await page.getByLabel("Mot de passe").fill("Demo-Registre-2026");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/localhost:3100\/tableau-de-bord/);
  });
});
