import { beforeEach, afterAll } from "vitest";
import { prisma } from "@/server/db";

if (!process.env.DATABASE_URL?.includes("registre_test")) {
  // Garde-fou : ces tests vident les tables, ils ne doivent jamais viser une autre base
  throw new Error("Les tests d'intégration doivent utiliser la base registre_test (voir .env.test)");
}

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE "AuditLog","QualityIssue","SubmissionValue","Submission","FormAssignment","FormRule","FormField","FormVersion","Form","LoginAttempt","Session","User" RESTART IDENTITY CASCADE`,
  );
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});
