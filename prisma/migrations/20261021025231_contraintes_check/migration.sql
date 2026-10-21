-- Contraintes d'intégrité complémentaires (non exprimables dans le schéma Prisma)
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_completeness_range" CHECK ("completeness" BETWEEN 0 AND 100);
ALTER TABLE "FormVersion" ADD CONSTRAINT "FormVersion_number_positive" CHECK ("number" > 0);
ALTER TABLE "FormField" ADD CONSTRAINT "FormField_key_format" CHECK ("key" ~ '^[a-z][a-z0-9_]{0,62}$');
ALTER TABLE "User" ADD CONSTRAINT "User_email_lowercase" CHECK ("email" = lower("email"));
-- Une réponse soumise a forcément une date de soumission
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_submitted_at_required"
  CHECK ("status" = 'BROUILLON' OR "submittedAt" IS NOT NULL);
-- Un formulaire n'a qu'une seule version brouillon et une seule version publiée à la fois
CREATE UNIQUE INDEX "FormVersion_one_draft_per_form" ON "FormVersion" ("formId") WHERE "status" = 'BROUILLON';
CREATE UNIQUE INDEX "FormVersion_one_published_per_form" ON "FormVersion" ("formId") WHERE "status" = 'PUBLIEE';
