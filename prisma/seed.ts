/**
 * Données de démonstration — ENTIÈREMENT FICTIVES.
 * Noms, codes, adresses et valeurs sont inventés ; toute ressemblance serait fortuite.
 *
 * Les réponses sont créées via les services métier (mêmes validations que l'application),
 * puis leurs dates sont réparties sur les dernières semaines pour alimenter les graphiques.
 *
 * Sécurité : refuse de s'exécuter si la base contient déjà des utilisateurs,
 * sauf avec SEED_RESET=1 (vide alors toutes les tables — opération destructive).
 *
 * Usage : npm run db:seed   (ou SEED_RESET=1 npm run db:seed)
 */
import "dotenv/config";
import { prisma } from "@/server/db";
import { hashPassword } from "@/server/auth/password";
import type { SessionUser } from "@/server/auth/permissions";
import { createForm, publishForm, saveFormDraft, setFormAssignments, setFormActive } from "@/server/services/forms";
import { reviewSubmission, saveSubmission } from "@/server/services/submissions";
import { ValidationError } from "@/server/errors";

const PASSWORD = process.env.SEED_PASSWORD || "Demo-Registre-2026";
const DOMAIN = "demo.registre.test"; // domaine réservé (.test), aucune adresse réelle

// Générateur pseudo-aléatoire déterministe (démo reproductible)
let seed = 20261021;
function rand() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;

async function main() {
  const existing = await prisma.user.count();
  if (existing > 0) {
    // Mode déploiement : la base est déjà initialisée, on ne touche à rien
    if (process.env.SEED_IF_EMPTY === "1") {
      console.log(`Base déjà initialisée (${existing} utilisateur(s)) : données de démonstration conservées.`);
      return;
    }
    if (process.env.SEED_RESET !== "1") {
      console.error(`La base contient déjà ${existing} utilisateur(s). Seed annulé pour ne rien écraser.`);
      console.error("Pour réinitialiser (DESTRUCTIF) : SEED_RESET=1 npm run db:seed");
      process.exit(1);
    }
    console.log("SEED_RESET=1 : vidage des tables…");
    await prisma.$executeRawUnsafe(
      `TRUNCATE "AuditLog","QualityIssue","SubmissionValue","Submission","FormAssignment","FormRule","FormField","FormVersion","Form","LoginAttempt","Session","User" RESTART IDENTITY CASCADE`,
    );
  }

  const hash = await hashPassword(PASSWORD);
  const mk = async (email: string, name: string, role: SessionUser["role"], isActive = true): Promise<SessionUser> => {
    const u = await prisma.user.create({ data: { email: `${email}@${DOMAIN}`, name, role, passwordHash: hash, isActive } });
    return { id: u.id, email: u.email, name: u.name, role: u.role, mustChangePassword: false };
  };

  const admin = await mk("admin", "Alexandre Démo", "ADMIN");
  const supNord = await mk("superviseur.nord", "Claire Exemple", "SUPERVISEUR");
  const supSud = await mk("superviseur.sud", "Bruno Fictif", "SUPERVISEUR");
  const agents = [
    await mk("agent1", "Amina Test", "AGENT"),
    await mk("agent2", "Lucas Essai", "AGENT"),
    await mk("agent3", "Fatou Modèle", "AGENT"),
    await mk("agent4", "Hugo Prototype", "AGENT"),
  ];
  await mk("agent.inactif", "Agent Désactivé", "AGENT", false);

  // ─── Formulaire 1 : enquête ménages (tous les types de champs) ───
  const f1 = await createForm(admin, { code: "ENQ-MEN-01", title: "Enquête ménages — vérification du Registre", description: "Contrôle sur le terrain des informations déclarées par les ménages (formulaire fictif)." });
  await saveFormDraft(admin, f1.id, {
    title: "Enquête ménages — vérification du Registre",
    description: "Contrôle sur le terrain des informations déclarées par les ménages (formulaire fictif).",
    duplicateFieldKeys: ["code_menage"],
    fields: [
      { key: "code_menage", label: "Code ménage", helpText: "Format MEN-0000, indiqué sur la fiche de visite.", type: "TEXTE", required: true, order: 0, validation: { pattern: "MEN-[0-9]{4}", patternMessage: "le code doit respecter le format MEN-0000" } },
      { key: "date_visite", label: "Date de la visite", type: "DATE", required: true, order: 1, validation: { minDate: "2026-01-01", notInFuture: true } },
      { key: "commune", label: "Commune", type: "LISTE", required: true, order: 2, options: [
        { value: "c01", label: "Commune A (fictive)" }, { value: "c02", label: "Commune B (fictive)" }, { value: "c03", label: "Commune C (fictive)" }, { value: "c04", label: "Commune D (fictive)" },
      ] },
      { key: "milieu", label: "Milieu de résidence", type: "CHOIX_UNIQUE", required: true, order: 3, options: [{ value: "urbain", label: "Urbain" }, { value: "rural", label: "Rural" }] },
      { key: "nb_personnes", label: "Nombre de personnes dans le ménage", type: "NOMBRE", required: true, order: 4, validation: { min: 1, max: 30, integer: true, warnMax: 15 } },
      { key: "nb_enfants", label: "Nombre d'enfants de moins de 15 ans", type: "NOMBRE", required: true, order: 5, validation: { min: 0, max: 25, integer: true } },
      { key: "revenu_mensuel", label: "Revenu mensuel déclaré", helpText: "Montant fictif, en unités monétaires.", type: "NOMBRE", required: false, order: 6, validation: { min: 0, warnMax: 5000 } },
      { key: "equipements", label: "Équipements du logement", type: "CHOIX_MULTIPLE", required: false, order: 7, options: [
        { value: "eau", label: "Eau courante" }, { value: "elec", label: "Électricité" }, { value: "sanitaires", label: "Sanitaires intérieurs" }, { value: "internet", label: "Accès internet" },
      ] },
      { key: "beneficiaire", label: "Le ménage bénéficie-t-il d'un programme ?", type: "OUI_NON", required: true, order: 8 },
      { key: "programme", label: "Programme concerné", type: "TEXTE", required: false, order: 9, validation: { maxLength: 120 } },
      { key: "telephone", label: "Téléphone de contact (fictif)", type: "TEXTE", required: false, order: 10, validation: { format: "telephone" } },
      { key: "conforme", label: "Les informations du Registre sont-elles conformes ?", type: "OUI_NON", required: true, order: 11 },
      { key: "observations", label: "Observations", type: "TEXTE", required: false, order: 12, validation: { maxLength: 1000 } },
    ],
    rules: [
      { definition: { kind: "COMPARAISON", left: "nb_enfants", op: "<", right: "nb_personnes" }, message: "Le nombre d'enfants doit être strictement inférieur au nombre de personnes du ménage.", severity: "ERREUR" },
      { definition: { kind: "OBLIGATOIRE_SI", target: "programme", when: { field: "beneficiaire", equals: "oui" } }, message: "Précisez le programme dont bénéficie le ménage.", severity: "ERREUR" },
      { definition: { kind: "OBLIGATOIRE_SI", target: "observations", when: { field: "conforme", equals: "non" } }, message: "Décrivez les écarts constatés avec le Registre (recommandé).", severity: "AVERTISSEMENT" },
    ],
  });
  await publishForm(admin, f1.id);
  await setFormAssignments(admin, f1.id, [supNord.id, agents[0].id, agents[1].id, agents[2].id]);

  // ─── Formulaire 2 : contrôle des adresses ───
  const f2 = await createForm(admin, { code: "CTRL-ADR-01", title: "Contrôle de cohérence des adresses", description: "Vérification de l'existence et de la localisation des logements enregistrés (fictif)." });
  await saveFormDraft(admin, f2.id, {
    title: "Contrôle de cohérence des adresses",
    description: "Vérification de l'existence et de la localisation des logements enregistrés (fictif).",
    duplicateFieldKeys: ["identifiant_logement", "date_controle"],
    fields: [
      { key: "identifiant_logement", label: "Identifiant du logement", type: "TEXTE", required: true, order: 0, validation: { format: "code", minLength: 6, maxLength: 12 } },
      { key: "date_controle", label: "Date du contrôle", type: "DATE", required: true, order: 1, validation: { notInFuture: true } },
      { key: "logement_trouve", label: "Logement trouvé à l'adresse indiquée", type: "OUI_NON", required: true, order: 2 },
      { key: "motif_absence", label: "Motif si non trouvé", type: "LISTE", required: false, order: 3, options: [
        { value: "demoli", label: "Logement démoli" }, { value: "adresse_erronee", label: "Adresse erronée" }, { value: "inaccessible", label: "Zone inaccessible" }, { value: "autre", label: "Autre" },
      ] },
      { key: "nb_logements_batiment", label: "Nombre de logements dans le bâtiment", type: "NOMBRE", required: false, order: 4, validation: { min: 1, max: 500, integer: true, warnMax: 200 } },
      { key: "date_derniere_maj", label: "Date de dernière mise à jour au Registre", type: "DATE", required: false, order: 5 },
    ],
    rules: [
      { definition: { kind: "OBLIGATOIRE_SI", target: "motif_absence", when: { field: "logement_trouve", equals: "non" } }, message: "Indiquez le motif lorsque le logement n'a pas été trouvé.", severity: "ERREUR" },
      { definition: { kind: "COMPARAISON", left: "date_derniere_maj", op: "<=", right: "date_controle" }, message: "La dernière mise à jour du Registre ne peut pas être postérieure à la date du contrôle.", severity: "ERREUR" },
    ],
  });
  await publishForm(admin, f2.id);
  await setFormAssignments(admin, f2.id, [supSud.id, agents[2].id, agents[3].id]);

  // ─── Formulaire 3 : brouillon jamais publié ───
  const f3 = await createForm(admin, { code: "SAT-BEN-01", title: "Satisfaction des bénéficiaires (en préparation)", description: "Questionnaire en cours de conception." });
  await saveFormDraft(admin, f3.id, {
    title: "Satisfaction des bénéficiaires (en préparation)",
    description: "Questionnaire en cours de conception.",
    duplicateFieldKeys: [],
    fields: [
      { key: "satisfaction", label: "Niveau de satisfaction global", type: "CHOIX_UNIQUE", required: true, order: 0, options: [{ value: "1", label: "Pas satisfait" }, { value: "2", label: "Moyennement" }, { value: "3", label: "Satisfait" }] },
      { key: "commentaire", label: "Commentaire", type: "TEXTE", required: false, order: 1 },
    ],
    rules: [],
  });

  // ─── Formulaire 4 : publié puis désactivé ───
  const f4 = await createForm(admin, { code: "PIL-2025", title: "Enquête pilote 2025 (clôturée)", description: "Ancienne enquête pilote, désactivée." });
  await saveFormDraft(admin, f4.id, {
    title: "Enquête pilote 2025 (clôturée)",
    description: "Ancienne enquête pilote, désactivée.",
    duplicateFieldKeys: [],
    fields: [
      { key: "zone", label: "Zone d'enquête", type: "TEXTE", required: true, order: 0 },
      { key: "nb_visites", label: "Nombre de visites", type: "NOMBRE", required: true, order: 1, validation: { min: 0, integer: true } },
    ],
    rules: [],
  });
  await publishForm(admin, f4.id);
  await setFormAssignments(admin, f4.id, [agents[0].id]);
  await saveSubmission(agents[0], { formId: f4.id, intent: "submit", values: { zone: "Zone pilote fictive", nb_visites: "12" } });
  await setFormActive(admin, f4.id, false);

  // ─── Réponses fictives ───
  const today = new Date();
  const daysAgo = (n: number) => new Date(today.getTime() - n * 86400_000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  let created = 0;
  let codeSeq = 1;

  async function backdate(id: string, d: Date, submitted: boolean) {
    await prisma.submission.update({ where: { id }, data: { createdAt: d, ...(submitted ? { submittedAt: new Date(d.getTime() + 3600_000) } : {}) } });
  }

  const f1Agents = [agents[0], agents[1], agents[2]];
  for (let i = 0; i < 95; i++) {
    const agent = pick(f1Agents);
    const ago = int(0, 40);
    const visit = daysAgo(ago);
    const nb = int(1, 9);
    const benef = rand() < 0.4;
    const conforme = rand() < 0.8;
    const values: Record<string, string | string[] | boolean> = {
      code_menage: `MEN-${String(codeSeq++).padStart(4, "0")}`,
      date_visite: iso(visit),
      commune: pick(["c01", "c02", "c03", "c04"]),
      milieu: rand() < 0.6 ? "urbain" : "rural",
      nb_personnes: String(nb),
      nb_enfants: String(int(0, Math.max(0, nb - 1))),
      equipements: ["eau", "elec", "sanitaires", "internet"].filter(() => rand() < 0.6),
      beneficiaire: benef ? "oui" : "non",
      conforme: conforme ? "oui" : "non",
    };
    if (rand() < 0.75) values.revenu_mensuel = String(int(150, 3200));
    if (benef) values.programme = pick(["Programme d'aide A (fictif)", "Programme B (fictif)", "Allocation C (fictive)"]);
    if (rand() < 0.5) values.telephone = `0${int(1, 9)} ${int(10, 99)} ${int(10, 99)} ${int(10, 99)} ${int(10, 99)}`;
    if (!conforme && rand() < 0.5) values.observations = pick(["Composition du ménage différente du Registre.", "Adresse à mettre à jour.", "Revenu déclaré différent."]);

    // Quelques cas particuliers pour illustrer le contrôle qualité
    if (i % 23 === 5) values.nb_personnes = String(int(16, 22)); // valeur inhabituelle (avertissement)
    if (i % 31 === 7) values.revenu_mensuel = "8500"; // revenu inhabituel (avertissement)
    if (i % 19 === 3 && codeSeq > 3) values.code_menage = `MEN-${String(codeSeq - 3).padStart(4, "0")}`; // doublon potentiel

    const isDraft = i % 12 === 0;
    try {
      const r = await saveSubmission(agent, { formId: f1.id, intent: isDraft ? "draft" : "submit", values: isDraft ? { code_menage: values.code_menage, date_visite: values.date_visite, commune: values.commune } : values });
      await backdate(r.submission.id, visit, !isDraft);
      created++;
      if (!isDraft) {
        const roll = rand();
        if (ago > 3 && roll < 0.6) await reviewSubmission(supNord, r.submission.id, { decision: "VALIDER" });
        else if (ago > 3 && roll < 0.68) await reviewSubmission(supNord, r.submission.id, { decision: "A_CORRIGER", comment: "Merci de vérifier le nombre d'enfants déclaré avec le ménage." });
        else if (ago > 3 && roll < 0.72) await reviewSubmission(supNord, r.submission.id, { decision: "REJETER", comment: "Visite non réalisée à l'adresse prévue (cas fictif)." });
      }
    } catch (e) {
      if (e instanceof ValidationError) console.warn("Réponse ignorée (invalide) :", e.message);
      else throw e;
    }
  }

  // Brouillon incomplet présentant une incohérence (visible dans le contrôle qualité)
  {
    const r = await saveSubmission(agents[1], {
      formId: f1.id,
      intent: "draft",
      values: { code_menage: "MEN-9001", date_visite: iso(daysAgo(1)), nb_personnes: "2", nb_enfants: "3", beneficiaire: "oui" },
    });
    await backdate(r.submission.id, daysAgo(1), false);
    created++;
  }

  for (let i = 0; i < 30; i++) {
    const agent = pick([agents[2], agents[3]]);
    const ago = int(0, 30);
    const d = daysAgo(ago);
    const found = rand() < 0.85;
    const values: Record<string, string | boolean> = {
      identifiant_logement: `LOG${String(int(1000, 9999))}`,
      date_controle: iso(d),
      logement_trouve: found ? "oui" : "non",
    };
    if (!found) values.motif_absence = pick(["demoli", "adresse_erronee", "inaccessible", "autre"]);
    if (rand() < 0.7) values.nb_logements_batiment = String(i % 13 === 4 ? int(210, 260) : int(1, 40));
    if (rand() < 0.6) values.date_derniere_maj = iso(daysAgo(ago + int(30, 600)));
    const r = await saveSubmission(agent, { formId: f2.id, intent: "submit", values });
    await backdate(r.submission.id, d, true);
    created++;
    if (ago > 2 && rand() < 0.55) await reviewSubmission(supSud, r.submission.id, { decision: "VALIDER" });
  }

  // Cohérence des dates : traitement et historique alignés sur les dates de saisie fictives
  const subs = await prisma.submission.findMany({ select: { id: true, createdAt: true, submittedAt: true, reviewedAt: true } });
  for (const s of subs) {
    const reviewedAt = s.reviewedAt && s.submittedAt ? new Date(Math.min(s.submittedAt.getTime() + 20 * 3600_000, Date.now())) : null;
    if (reviewedAt) await prisma.submission.update({ where: { id: s.id }, data: { reviewedAt } });
    await prisma.auditLog.updateMany({ where: { entityId: s.id, action: { in: ["submission.create", "submission.update"] } }, data: { createdAt: s.createdAt } });
    await prisma.auditLog.updateMany({ where: { entityId: s.id, action: "submission.submit" }, data: { createdAt: s.submittedAt ?? s.createdAt } });
    if (reviewedAt) await prisma.auditLog.updateMany({ where: { entityId: s.id, action: { in: ["submission.validate", "submission.reject", "submission.return"] } }, data: { createdAt: reviewedAt } });
  }

  console.log(`Seed terminé :${await prisma.user.count()} utilisateurs, 4 formulaires, ${created + 1} réponses fictives.`);
  console.log(`Mot de passe des comptes de démonstration : ${PASSWORD === "Demo-Registre-2026" ? "Demo-Registre-2026 (valeur par défaut)" : "valeur de SEED_PASSWORD"}`);
  console.log(`Comptes : admin@${DOMAIN}, superviseur.nord@${DOMAIN}, superviseur.sud@${DOMAIN}, agent1..agent4@${DOMAIN}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
