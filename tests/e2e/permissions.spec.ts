import { expect, test } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("Contrôles d'accès côté serveur", () => {
  test("un agent n'accède pas aux pages d'administration par URL directe", async ({ page }) => {
    await login(page, USERS.agent1);
    for (const url of ["/utilisateurs", "/journal", "/qualite", "/rapports", "/formulaires/nouveau"]) {
      await page.goto(url);
      await expect(page, `accès à ${url}`).toHaveURL(/\/acces-refuse$/);
      await expect(page.getByRole("heading", { name: "Accès refusé" })).toBeVisible();
    }
    // le menu n'affiche pas ces entrées (simple confort : la sécurité est assurée ci-dessus)
    await expect(page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Utilisateurs" })).toHaveCount(0);
  });

  test("un agent ne peut pas exporter, même en appelant l'API directement", async ({ page }) => {
    await login(page, USERS.agent1);
    const r = await page.request.get("/api/export?formId=nimporte");
    expect(r.status()).toBe(403);
  });

  test("un superviseur ne voit pas les réponses d'un formulaire non affecté", async ({ page, browser }) => {
    // récupère l'URL d'une réponse de l'enquête ménages en tant qu'administrateur
    const admin = await browser.newPage();
    await login(admin, USERS.admin);
    await admin.goto("/reponses?status=SOUMISE");
    await admin.getByRole("combobox", { name: "Formulaire" }).selectOption({ label: "ENQ-MEN-01 — Enquête ménages — vérification du Registre" });
    await admin.getByRole("button", { name: "Appliquer les filtres" }).click();
    const href = await admin.getByRole("table", { name: "Liste des réponses" }).getByRole("link").first().getAttribute("href");
    await admin.close();

    await login(page, USERS.supSud);
    await page.goto(href!);
    await expect(page.getByText("Page introuvable")).toBeVisible();
    await page.goto("/reponses");
    await expect(page.getByRole("table", { name: "Liste des réponses" })).not.toContainText("ENQ-MEN-01");
    await expect(page.getByRole("table", { name: "Liste des réponses" })).toContainText("CTRL-ADR-01");
  });
});
