import { expect, test, type Browser } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { login, statValue, USERS } from "./helpers";

// Scénario complet : création d'un formulaire → saisie → validation → indicateurs → export.
test.describe.configure({ mode: "serial" });

let formUrl = "";
let responseUrl = "";
let reference = "";
let enregistreesAvant = 0;

async function asUser(browser: Browser, email: string) {
  const page = await (await browser.newContext({ locale: "fr-FR" })).newPage();
  await login(page, email);
  return page;
}

test("l'administrateur crée, configure et publie un formulaire", async ({ browser }) => {
  const page = await asUser(browser, USERS.admin);
  enregistreesAvant = await statValue(page, "Réponses enregistrées");

  await page.goto("/formulaires/nouveau");
  await page.getByLabel("Code").fill("e2e-01");
  await page.getByLabel("Titre").fill("Formulaire E2E fictif");
  await page.getByRole("button", { name: "Créer et ajouter des questions" }).click();
  await expect(page).toHaveURL(/\/modifier\?cree=1/);
  await expect(page.getByText("Formulaire créé. Ajoutez maintenant ses questions.")).toBeVisible();

  const add = page.getByRole("button", { name: "Ajouter une question" });
  // Q1 : texte obligatoire
  await add.click();
  await page.getByLabel("Libellé de la question").nth(0).fill("Nom du village");
  await page.getByLabel("Obligatoire", { exact: true }).nth(0).check();
  // Q2 : nombre obligatoire entre 1 et 1000
  await add.click();
  await page.getByLabel("Libellé de la question").nth(1).fill("Population");
  await page.getByLabel("Type de champ").nth(1).selectOption("NOMBRE");
  await page.getByLabel("Obligatoire", { exact: true }).nth(1).check();
  await page.getByLabel("Minimum (bloquant)").fill("1");
  await page.getByLabel("Maximum (bloquant)").fill("1000");
  // Q3 : oui/non obligatoire
  await add.click();
  await page.getByLabel("Libellé de la question").nth(2).fill("Accès à l'eau potable");
  await page.getByLabel("Type de champ").nth(2).selectOption("OUI_NON");
  await page.getByLabel("Obligatoire", { exact: true }).nth(2).check();
  // identifiants générés automatiquement à partir des libellés
  await expect(page.getByLabel("Identifiant technique").nth(1)).toHaveValue("population");

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Enregistrer et publier" }).click();
  await expect(page).toHaveURL(/\/formulaires\/[a-z0-9]+$/);
  await expect(page.getByText("Publié", { exact: true }).first()).toBeVisible();
  formUrl = page.url();

  await page.getByLabel(/Amina Test/).check();
  await page.getByLabel(/Claire Exemple/).check();
  await page.getByRole("button", { name: "Enregistrer les affectations" }).click();
  await expect(page.getByText("Affectations enregistrées.")).toBeVisible();
  await page.context().close();
});

test("l'agent saisit : erreurs explicites, puis soumission valide enregistrée", async ({ browser }) => {
  const page = await asUser(browser, USERS.agent1);
  await page.goto("/collecte");
  const card = page.locator("section", { hasText: "Formulaire E2E fictif" });
  await card.getByRole("link", { name: "Nouvelle réponse" }).click();

  await page.getByLabel(/Population/).fill("5000");
  await page.getByRole("button", { name: "Soumettre" }).click();
  const summary = page.getByRole("alert").filter({ hasText: "à corriger avant de soumettre" });
  await expect(summary).toContainText("Le champ « Nom du village » est obligatoire.");
  await expect(summary).toContainText(/« Population » doit être inférieur ou égal à 1\s000 \(valeur saisie : 5\s000\)/);
  await expect(summary).toContainText("Le champ « Accès à l'eau potable » est obligatoire.");
  await expect(page.getByLabel(/Population/)).toHaveAttribute("aria-invalid", "true");

  await page.getByLabel(/Nom du village/).fill("Village fictif des tests");
  await page.getByLabel(/Population/).fill("250");
  await page.getByRole("radio", { name: "Oui" }).check();
  await page.getByRole("button", { name: "Soumettre" }).click();

  await expect(page).toHaveURL(/\/reponses\/[a-z0-9]+$/);
  await expect(page.getByText("En attente de validation").first()).toBeVisible();
  await expect(page.getByText("Village fictif des tests")).toBeVisible();
  responseUrl = page.url();
  reference = (await page.getByRole("heading", { level: 1 }).innerText()).replace("Réponse ", "").trim();
  expect(reference).toMatch(/^R-\d{4}-[0-9A-F]{8}$/);
  await page.context().close();
});

test("l'agent enregistre un brouillon incomplet et le retrouve", async ({ browser }) => {
  const page = await asUser(browser, USERS.agent1);
  await page.goto("/collecte");
  await page.locator("section", { hasText: "Formulaire E2E fictif" }).getByRole("link", { name: "Nouvelle réponse" }).click();
  await page.getByLabel(/Nom du village/).fill("Brouillon fictif");
  await page.getByRole("button", { name: "Enregistrer le brouillon" }).click();
  await expect(page).toHaveURL(/\/reponses\/[a-z0-9]+$/);
  await expect(page.getByText("Brouillon", { exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: "Reprendre la saisie" }).click();
  await expect(page.getByLabel(/Nom du village/)).toHaveValue("Brouillon fictif");
  await page.context().close();
});

test("le superviseur affecté valide la réponse (commentaire exigé pour un renvoi)", async ({ browser }) => {
  const page = await asUser(browser, USERS.supNord);
  await page.goto(responseUrl);
  await page.getByRole("button", { name: "Renvoyer pour correction" }).click();
  await expect(page.getByText("Un commentaire est obligatoire pour rejeter ou renvoyer une réponse.")).toBeVisible();
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page.getByText("Validée", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Valider" })).toHaveCount(0);
  await page.context().close();
});

test("une réponse validée n'est plus modifiable par l'agent (contrôle serveur)", async ({ browser }) => {
  const page = await asUser(browser, USERS.agent1);
  await page.goto(responseUrl);
  await expect(page.getByRole("link", { name: "Corriger" })).toHaveCount(0);
  await page.goto(responseUrl + "/modifier");
  await expect(page).toHaveURL(responseUrl);
  await page.context().close();
});

test("les indicateurs et l'export CSV reflètent les données enregistrées", async ({ browser }) => {
  const page = await asUser(browser, USERS.admin);
  expect(await statValue(page, "Réponses enregistrées")).toBe(enregistreesAvant + 1);

  const formId = formUrl.split("/").pop();
  await page.goto(`/reponses?formId=${formId}`);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Exporter en CSV" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^export_E2E-01_\d{4}-\d{2}-\d{2}\.csv$/);
  const csv = await readFile((await download.path())!, "utf8");
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  expect(csv).toContain("Nom du village [nom_du_village]");
  expect(csv).toContain(reference);
  expect(csv).toContain("Village fictif des tests");
  expect(csv).toContain("Validée");

  await page.goto("/journal?action=export.");
  await expect(page.getByRole("table", { name: "Événements d'audit" })).toContainText("Export CSV");
  await page.context().close();
});
