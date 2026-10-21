import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "../db";
import { assertCan, submissionScope, type SessionUser } from "../auth/permissions";

export async function listAuditLogs(actor: SessionUser, filters: { action?: string; q?: string } = {}, page = 1, pageSize = 50) {
  assertCan(actor, "audit:view");
  const where: Prisma.AuditLogWhereInput = {};
  if (filters.action) where.action = { startsWith: filters.action.slice(0, 50) };
  if (filters.q) where.actor = { name: { contains: filters.q.slice(0, 100), mode: "insensitive" } };
  const safePage = Math.max(1, Math.min(page, 10_000));
  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * pageSize,
      take: pageSize,
      include: { actor: { select: { name: true, email: true } } },
    }),
  ]);
  return { total, page: safePage, pageSize, rows };
}

export async function listQualityIssues(actor: SessionUser, filters: { type?: string; severity?: string; formId?: string }, page = 1, pageSize = 30) {
  assertCan(actor, "quality:view");
  const where: Prisma.QualityIssueWhereInput = {
    submission: { AND: [submissionScope(actor), { status: { notIn: ["REJETEE"] } }, ...(filters.formId ? [{ formId: filters.formId }] : [])] },
  };
  if (filters.type && ["MANQUANT", "HORS_PLAGE", "FORMAT", "DOUBLON", "INCOHERENCE"].includes(filters.type)) where.type = filters.type as "MANQUANT";
  if (filters.severity === "ERREUR" || filters.severity === "AVERTISSEMENT") where.severity = filters.severity;
  const safePage = Math.max(1, Math.min(page, 10_000));
  const [total, rows] = await Promise.all([
    prisma.qualityIssue.count({ where }),
    prisma.qualityIssue.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * pageSize,
      take: pageSize,
      include: {
        field: { select: { label: true } },
        submission: { select: { id: true, reference: true, status: true, agent: { select: { name: true } }, version: { select: { form: { select: { title: true } } } } } },
      },
    }),
  ]);
  return { total, page: safePage, pageSize, rows };
}
