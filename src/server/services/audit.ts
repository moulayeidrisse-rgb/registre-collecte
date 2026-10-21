import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma, type Tx } from "../db";

export type AuditInput = {
  actorId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
};

const FORBIDDEN_KEYS = /pass|token|secret|hash/i;

/** Retire toute clé ressemblant à un secret avant journalisation */
function scrub(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([k]) => !FORBIDDEN_KEYS.test(k))
        .map(([k, v]) => [k, scrub(v)]),
    );
  }
  return value;
}

export async function audit(input: AuditInput, tx: Tx | typeof prisma = prisma) {
  await tx.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata === undefined ? undefined : (scrub(input.metadata) as Prisma.InputJsonValue),
      ipAddress: input.ipAddress ?? null,
    },
  });
}
