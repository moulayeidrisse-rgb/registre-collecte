"use client";

import type { FieldDef, RawValues, RuleDef, TypedValues } from "@/lib/validation/types";
import { SubmissionForm } from "./submission-form";
import { saveSubmissionAction } from "@/app/(app)/reponses/actions";

/** Formulaire de saisie relié à la Server Action d'enregistrement */
export function EntryForm({ formId, submissionId, fields, rules, initialValues, allowDraft }: { formId: string; submissionId?: string; fields: FieldDef[]; rules: RuleDef[]; initialValues?: TypedValues; allowDraft: boolean }) {
  return (
    <SubmissionForm
      fields={fields}
      rules={rules}
      mode="entry"
      allowDraft={allowDraft}
      initialValues={initialValues as RawValues}
      onSave={(intent, values) => saveSubmissionAction({ formId, submissionId, intent, values })}
    />
  );
}
