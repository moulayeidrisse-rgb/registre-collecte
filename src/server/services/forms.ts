import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "../db";
import { assertCan, formScope, type SessionUser } from "../auth/permissions";
import { AppError, NotFoundError, ValidationError } from "../errors";
import { formCodeSchema, formDraftSchema, formMetaSchema, type FormDraftInput } from "@/lib/validation/form-schema";
import { audit } from "./audit";
import { toFieldDef, toRuleDefs } from "./mappers";
import { z } from "zod";

function zodToFieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const k = issue.path.join(".") || "_form";
    (out[k] ??= []).push(issue.message);
  }
  return out;
}

export async function listForms(actor: SessionUser, filters: { q?: string; status?: string } = {}) {
  assertCan(actor, "form:view");
  const where: Prisma.FormWhereInput = { AND: [formScope(actor)] };
  // Les agents et superviseurs ne voient pas les formulaires jamais publiés
  if (actor.role !== "ADMIN") (where.AND as Prisma.FormWhereInput[]).push({ status: { not: "BROUILLON" } });
  if (filters.q) {
    (where.AND as Prisma.FormWhereInput[]).push({
      OR: [{ title: { contains: filters.q, mode: "insensitive" } }, { code: { contains: filters.q, mode: "insensitive" } }],
    });
  }
  if (filters.status && ["BROUILLON", "PUBLIE", "DESACTIVE"].includes(filters.status)) {
    (where.AND as Prisma.FormWhereInput[]).push({ status: filters.status as "BROUILLON" });
  }
  const forms = await prisma.form.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      versions: { select: { id: true, number: true, status: true, _count: { select: { fields: true } } }, orderBy: { number: "desc" } },
      _count: { select: { assignments: true } },
    },
  });
  const counts = await prisma.submission.groupBy({
    by: ["formId"],
    where: { formId: { in: forms.map((f) => f.id) }, status: { not: "BROUILLON" } },
    _count: { _all: true },
  });
  const countMap = new Map(counts.map((c) => [c.formId, c._count._all]));
  return forms.map((f) => {
    const published = f.versions.find((v) => v.status === "PUBLIEE");
    const draft = f.versions.find((v) => v.status === "BROUILLON");
    return {
      id: f.id,
      code: f.code,
      title: f.title,
      status: f.status,
      updatedAt: f.updatedAt,
      publishedVersion: published?.number ?? null,
      hasDraft: Boolean(draft),
      fieldCount: (published ?? draft)?._count.fields ?? 0,
      assignmentCount: f._count.assignments,
      submissionCount: countMap.get(f.id) ?? 0,
    };
  });
}

/** Charge un formulaire visible par l'acteur, sinon NotFound (sans révéler son existence) */
async function loadFormInScope(actor: SessionUser, formId: string) {
  const form = await prisma.form.findFirst({ where: { AND: [{ id: formId }, formScope(actor)] } });
  if (!form) throw new NotFoundError("Formulaire introuvable ou inaccessible.");
  if (actor.role !== "ADMIN" && form.status === "BROUILLON") throw new NotFoundError("Formulaire introuvable ou inaccessible.");
  return form;
}

export async function getFormOverview(actor: SessionUser, formId: string) {
  assertCan(actor, "form:view");
  await loadFormInScope(actor, formId);
  const form = await prisma.form.findUniqueOrThrow({
    where: { id: formId },
    include: {
      createdBy: { select: { name: true } },
      versions: {
        orderBy: { number: "desc" },
        include: { _count: { select: { fields: true, rules: true, submissions: true } } },
      },
      assignments: { include: { user: { select: { id: true, name: true, email: true, role: true, isActive: true } } } },
    },
  });
  return form;
}

/** Version à afficher : brouillon (ADMIN) ou version publiée, avec champs et règles */
export async function getFormVersionForDisplay(actor: SessionUser, formId: string, which: "draft" | "published" | "latest") {
  assertCan(actor, "form:view");
  const form = await loadFormInScope(actor, formId);
  const statuses: ("BROUILLON" | "PUBLIEE")[] =
    which === "draft" ? ["BROUILLON"] : which === "published" ? ["PUBLIEE"] : ["BROUILLON", "PUBLIEE"];
  // seuls les administrateurs accèdent aux versions brouillon
  const allowed = actor.role === "ADMIN" ? statuses : statuses.filter((s) => s === "PUBLIEE");
  if (allowed.length === 0) throw new NotFoundError();
  const version = await prisma.formVersion.findFirst({
    where: { formId, status: { in: allowed } },
    orderBy: { number: "desc" },
    include: { fields: { orderBy: { order: "asc" } }, rules: { orderBy: { order: "asc" } } },
  });
  if (!version) return { form, version: null, fields: [], rules: [] };
  return { form, version, fields: version.fields.map(toFieldDef), rules: toRuleDefs(version.rules) };
}

export async function createForm(actor: SessionUser, input: { code: string; title: string; description?: string | null }) {
  assertCan(actor, "form:manage");
  const code = formCodeSchema.safeParse(input.code);
  const meta = formMetaSchema.safeParse({ title: input.title, description: input.description || null });
  const fieldErrors: Record<string, string[]> = {};
  if (!code.success) fieldErrors.code = code.error.issues.map((i) => i.message);
  if (!meta.success) Object.assign(fieldErrors, zodToFieldErrors(meta.error));
  if (!code.success || !meta.success) throw new ValidationError("Veuillez corriger les champs signalés.", fieldErrors);

  try {
    const form = await prisma.$transaction(async (tx) => {
      const f = await tx.form.create({
        data: { code: code.data, title: meta.data.title, description: meta.data.description ?? null, createdById: actor.id },
      });
      await tx.formVersion.create({ data: { formId: f.id, number: 1, status: "BROUILLON" } });
      await audit({ actorId: actor.id, action: "form.create", entityType: "Form", entityId: f.id, metadata: { code: f.code } }, tx);
      return f;
    });
    return form;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ValidationError("Ce code de formulaire existe déjà.", { code: ["Ce code est déjà utilisé."] });
    }
    throw e;
  }
}

/** Crée une version brouillon à partir de la version publiée (pour modifier un formulaire publié) */
export async function startNewVersion(actor: SessionUser, formId: string) {
  assertCan(actor, "form:manage");
  return prisma.$transaction(async (tx) => {
    const existingDraft = await tx.formVersion.findFirst({ where: { formId, status: "BROUILLON" } });
    if (existingDraft) return existingDraft;
    const latest = await tx.formVersion.findFirst({
      where: { formId },
      orderBy: { number: "desc" },
      include: { fields: true, rules: true },
    });
    if (!latest) throw new NotFoundError();
    const draft = await tx.formVersion.create({ data: { formId, number: latest.number + 1, status: "BROUILLON" } });
    if (latest.fields.length) {
      await tx.formField.createMany({
        data: latest.fields.map((f) => ({
          versionId: draft.id,
          key: f.key,
          label: f.label,
          helpText: f.helpText,
          type: f.type,
          required: f.required,
          order: f.order,
          options: f.options ?? Prisma.JsonNull,
          validation: f.validation ?? Prisma.JsonNull,
        })),
      });
    }
    if (latest.rules.length) {
      await tx.formRule.createMany({
        data: latest.rules.map((r) => ({ versionId: draft.id, definition: r.definition as Prisma.InputJsonValue, message: r.message, severity: r.severity, order: r.order })),
      });
    }
    await audit({ actorId: actor.id, action: "form.new_version", entityType: "Form", entityId: formId, metadata: { version: draft.number } }, tx);
    return draft;
  });
}

/** Enregistre la définition complète de la version brouillon */
export async function saveFormDraft(actor: SessionUser, formId: string, input: unknown) {
  assertCan(actor, "form:manage");
  const parsed = formDraftSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("La définition du formulaire contient des erreurs.", zodToFieldErrors(parsed.error));
  }
  const data: FormDraftInput = parsed.data;

  return prisma.$transaction(async (tx) => {
    const draft = await tx.formVersion.findFirst({ where: { formId, status: "BROUILLON" } });
    if (!draft) throw new AppError("Aucune version brouillon à modifier. Créez d'abord une nouvelle version.");

    await tx.form.update({
      where: { id: formId },
      data: { title: data.title, description: data.description ?? null, duplicateFieldKeys: data.duplicateFieldKeys },
    });
    // Une version brouillon n'a jamais de réponses : on peut remplacer ses champs
    await tx.formRule.deleteMany({ where: { versionId: draft.id } });
    await tx.formField.deleteMany({ where: { versionId: draft.id } });
    if (data.fields.length) {
      await tx.formField.createMany({
        data: data.fields.map((f, i) => ({
          versionId: draft.id,
          key: f.key,
          label: f.label,
          helpText: f.helpText || null,
          type: f.type,
          required: f.required,
          order: i,
          options: f.options && ["LISTE", "CHOIX_UNIQUE", "CHOIX_MULTIPLE"].includes(f.type) ? f.options : Prisma.JsonNull,
          validation: f.validation && Object.keys(f.validation).length ? f.validation : Prisma.JsonNull,
        })),
      });
    }
    if (data.rules.length) {
      await tx.formRule.createMany({
        data: data.rules.map((r, i) => ({ versionId: draft.id, definition: r.definition, message: r.message, severity: r.severity, order: i })),
      });
    }
    await tx.formVersion.update({ where: { id: draft.id }, data: { updatedAt: new Date() } });
    await audit({ actorId: actor.id, action: "form.update", entityType: "Form", entityId: formId, metadata: { version: draft.number, fields: data.fields.length, rules: data.rules.length } }, tx);
    return draft;
  });
}

export async function publishForm(actor: SessionUser, formId: string) {
  assertCan(actor, "form:manage");
  return prisma.$transaction(async (tx) => {
    const draft = await tx.formVersion.findFirst({ where: { formId, status: "BROUILLON" }, include: { _count: { select: { fields: true } } } });
    if (!draft) throw new AppError("Aucune version brouillon à publier.");
    if (draft._count.fields === 0) throw new AppError("Impossible de publier un formulaire sans question.");
    await tx.formVersion.updateMany({ where: { formId, status: "PUBLIEE" }, data: { status: "ARCHIVEE" } });
    await tx.formVersion.update({ where: { id: draft.id }, data: { status: "PUBLIEE", publishedAt: new Date() } });
    await tx.form.update({ where: { id: formId }, data: { status: "PUBLIE" } });
    await audit({ actorId: actor.id, action: "form.publish", entityType: "Form", entityId: formId, metadata: { version: draft.number } }, tx);
    return draft;
  });
}

export async function setFormActive(actor: SessionUser, formId: string, active: boolean) {
  assertCan(actor, "form:manage");
  const form = await prisma.form.findUnique({ where: { id: formId }, include: { versions: { where: { status: "PUBLIEE" } } } });
  if (!form) throw new NotFoundError();
  if (form.versions.length === 0) throw new AppError("Le formulaire n'a jamais été publié.");
  await prisma.form.update({ where: { id: formId }, data: { status: active ? "PUBLIE" : "DESACTIVE" } });
  await audit({ actorId: actor.id, action: active ? "form.enable" : "form.disable", entityType: "Form", entityId: formId });
}

export async function setFormAssignments(actor: SessionUser, formId: string, userIds: string[]) {
  assertCan(actor, "form:manage");
  const form = await prisma.form.findUnique({ where: { id: formId } });
  if (!form) throw new NotFoundError();
  const ids = [...new Set(userIds)];
  const users = await prisma.user.findMany({ where: { id: { in: ids }, role: { in: ["AGENT", "SUPERVISEUR"] } }, select: { id: true } });
  await prisma.$transaction([
    prisma.formAssignment.deleteMany({ where: { formId, userId: { notIn: users.map((u) => u.id) } } }),
    prisma.formAssignment.createMany({ data: users.map((u) => ({ formId, userId: u.id })), skipDuplicates: true }),
  ]);
  await audit({ actorId: actor.id, action: "form.assignments", entityType: "Form", entityId: formId, metadata: { count: users.length } });
}
