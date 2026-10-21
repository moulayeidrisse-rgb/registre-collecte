"use server";

import { refresh } from "next/cache";
import { requireActor } from "@/server/auth/session";
import { toActionError } from "@/server/errors";
import { reviewSubmission, saveSubmission } from "@/server/services/submissions";
import type { RawValues } from "@/lib/validation/types";
import type { SaveResult } from "@/components/forms/submission-form";

export async function saveSubmissionAction(
  input: { formId: string; submissionId?: string; intent: "draft" | "submit"; values: RawValues },
): Promise<SaveResult> {
  try {
    // L'identité de l'agent est toujours celle de la session, jamais une valeur envoyée par le client
    const actor = await requireActor();
    const { submission, warnings } = await saveSubmission(actor, {
      formId: input.formId,
      submissionId: input.submissionId,
      intent: input.intent,
      values: input.values as Record<string, string | string[] | boolean | number | null>,
    });
    const msg =
      input.intent === "submit"
        ? `Réponse ${submission.reference} soumise${warnings.length ? ` avec ${warnings.length} point(s) à vérifier` : ""}.`
        : `Brouillon ${submission.reference} enregistré.`;
    return { ok: true, message: msg, redirectTo: `/reponses/${submission.id}`, warnings };
  } catch (e) {
    return toActionError(e);
  }
}

export type ReviewState = { ok: boolean; message?: string; fieldErrors?: Record<string, string[]> } | null;

export async function reviewAction(submissionId: string, _prev: ReviewState, fd: FormData): Promise<ReviewState> {
  try {
    const actor = await requireActor("submission:review");
    const decision = String(fd.get("decision") ?? "");
    const status = await reviewSubmission(actor, submissionId, { decision, comment: String(fd.get("comment") ?? "") || undefined });
    refresh();
    const labels: Record<string, string> = { VALIDEE: "Réponse validée.", REJETEE: "Réponse rejetée.", A_CORRIGER: "Réponse renvoyée à l'agent pour correction." };
    return { ok: true, message: labels[status] };
  } catch (e) {
    return toActionError(e);
  }
}
