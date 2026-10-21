import { expect, type Page } from "@playwright/test";

export const PASSWORD = "Demo-Registre-2026";
export const USERS = {
  admin: "admin@demo.registre.test",
  supNord: "superviseur.nord@demo.registre.test",
  supSud: "superviseur.sud@demo.registre.test",
  agent1: "agent1@demo.registre.test",
  agent4: "agent4@demo.registre.test",
};

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto("/connexion");
  await page.getByLabel("Adresse électronique").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/tableau-de-bord/);
}

/** Lit la valeur numérique d'une carte d'indicateur du tableau de bord */
export async function statValue(page: Page, label: string): Promise<number> {
  const card = page.locator("section", { has: page.getByText(label, { exact: true }) }).first();
  const txt = await card.locator("p").nth(1).innerText();
  return Number(txt.replace(/\s/g, "").replace(",", "."));
}
