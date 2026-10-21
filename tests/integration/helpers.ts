import { prisma } from "@/server/db";
import { hashPassword } from "@/server/auth/password";
import type { SessionUser } from "@/server/auth/permissions";
import { createForm, publishForm, saveFormDraft, setFormAssignments } from "@/server/services/forms";

export const PASSWORD = "MotDePasse2026";

export async function makeUser(role: SessionUser["role"], name: string, opts: { isActive?: boolean } = {}): Promise<SessionUser> {
  const u = await prisma.user.create({
    data: {
      email: `${name.toLowerCase().replace(/\s+/g, ".")}@exemple.test`,
      name,
      role,
      passwordHash: await hashPassword(PASSWORD),
      isActive: opts.isActive ?? true,
    },
  });
  return { id: u.id, email: u.email, name: u.name, role: u.role, mustChangePassword: false };
}

export const SAMPLE_DRAFT = {
  title: "Enquête ménages (test)",
  description: "Formulaire fictif",
  duplicateFieldKeys: ["code_menage"],
  fields: [
    { key: "code_menage", label: "Code ménage", type: "TEXTE", required: true, order: 0, validation: { pattern: "MEN-[0-9]{4}", patternMessage: "format MEN-0000" } },
    { key: "date_visite", label: "Date de visite", type: "DATE", required: true, order: 1, validation: { notInFuture: true } },
    { key: "nb_personnes", label: "Nombre de personnes", type: "NOMBRE", required: true, order: 2, validation: { min: 1, max: 30, integer: true, warnMax: 15 } },
    { key: "nb_enfants", label: "Nombre d'enfants", type: "NOMBRE", required: false, order: 3, validation: { min: 0, integer: true } },
    { key: "region", label: "Région", type: "LISTE", required: true, order: 4, options: [{ value: "nord", label: "Nord" }, { value: "sud", label: "Sud" }] },
    { key: "logement", label: "Type de logement", type: "CHOIX_UNIQUE", required: false, order: 5, options: [{ value: "maison", label: "Maison" }, { value: "appartement", label: "Appartement" }] },
    { key: "equipements", label: "Équipements", type: "CHOIX_MULTIPLE", required: false, order: 6, options: [{ value: "eau", label: "Eau courante" }, { value: "elec", label: "Électricité" }] },
    { key: "beneficiaire", label: "Bénéficiaire d'un programme", type: "OUI_NON", required: true, order: 7 },
    { key: "programme", label: "Nom du programme", type: "TEXTE", required: false, order: 8 },
  ],
  rules: [
    { definition: { kind: "COMPARAISON", left: "nb_enfants", op: "<", right: "nb_personnes" }, message: "Le nombre d'enfants doit être inférieur au nombre de personnes.", severity: "ERREUR" },
    { definition: { kind: "OBLIGATOIRE_SI", target: "programme", when: { field: "beneficiaire", equals: "oui" } }, message: "Indiquez le nom du programme.", severity: "ERREUR" },
  ],
};

export const VALID_VALUES = {
  code_menage: "MEN-0001",
  date_visite: "2026-01-15",
  nb_personnes: "4",
  nb_enfants: "2",
  region: "nord",
  logement: "maison",
  equipements: ["eau", "elec"],
  beneficiaire: "oui",
  programme: "Programme fictif A",
};

export async function makePublishedForm(admin: SessionUser, code = "TEST-01", assignees: SessionUser[] = []) {
  const form = await createForm(admin, { code, title: "Enquête ménages (test)" });
  await saveFormDraft(admin, form.id, SAMPLE_DRAFT);
  await publishForm(admin, form.id);
  if (assignees.length) await setFormAssignments(admin, form.id, assignees.map((a) => a.id));
  return form;
}
