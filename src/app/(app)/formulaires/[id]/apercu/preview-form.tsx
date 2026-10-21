"use client";

import type { FieldDef, RuleDef } from "@/lib/validation/types";
import { SubmissionForm } from "@/components/forms/submission-form";

export function PreviewForm({ fields, rules }: { fields: FieldDef[]; rules: RuleDef[] }) {
  return <SubmissionForm fields={fields} rules={rules} mode="preview" allowDraft={false} />;
}
