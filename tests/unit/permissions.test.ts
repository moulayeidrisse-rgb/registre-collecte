import { describe, expect, it } from "vitest";
import { can, assertCan, ROLE_PERMISSIONS, submissionScope, formScope, type SessionUser } from "@/server/auth/permissions";
import { ForbiddenError } from "@/server/errors";

const u = (role: SessionUser["role"]): SessionUser => ({ id: `u-${role}`, email: "x@exemple.org", name: "X", role, mustChangePassword: false });

describe("matrice des permissions", () => {
  it("l'administrateur a toutes les permissions", () => {
    expect(can(u("ADMIN"), "user:manage")).toBe(true);
    expect(can(u("ADMIN"), "form:manage")).toBe(true);
  });
  it("le superviseur valide et exporte mais ne gère ni formulaires ni utilisateurs", () => {
    const s = u("SUPERVISEUR");
    expect(can(s, "submission:review")).toBe(true);
    expect(can(s, "export:csv")).toBe(true);
    expect(can(s, "form:manage")).toBe(false);
    expect(can(s, "user:manage")).toBe(false);
    expect(can(s, "submission:create")).toBe(false);
  });
  it("l'agent saisit mais ne valide, n'exporte ni ne consulte l'audit", () => {
    const a = u("AGENT");
    expect(can(a, "submission:create")).toBe(true);
    for (const p of ["submission:review", "export:csv", "audit:view", "form:manage", "submission:view_scope", "report:view"] as const) {
      expect(can(a, p)).toBe(false);
    }
  });
  it("assertCan lève ForbiddenError ; can(null) est faux", () => {
    expect(() => assertCan(u("AGENT"), "user:manage")).toThrow(ForbiddenError);
    expect(can(null, "dashboard:view")).toBe(false);
  });
  it("périmètres de données", () => {
    expect(submissionScope(u("ADMIN"))).toEqual({});
    expect(submissionScope(u("AGENT"))).toEqual({ agentId: "u-AGENT" });
    expect(submissionScope(u("SUPERVISEUR"))).toMatchObject({ status: { not: "BROUILLON" } });
    expect(formScope(u("AGENT"))).toEqual({ assignments: { some: { userId: "u-AGENT" } } });
  });
  it("chaque rôle a au moins la consultation du tableau de bord", () => {
    for (const r of Object.keys(ROLE_PERMISSIONS) as SessionUser["role"][]) expect(can(u(r), "dashboard:view")).toBe(true);
  });
});
