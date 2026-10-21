import type { FormStatus, IssueSeverity, Role, SubmissionStatus } from "@/generated/prisma/enums";
import { FORM_STATUS_LABELS, ROLE_LABELS, SEVERITY_LABELS, STATUS_TONE, SUBMISSION_STATUS_LABELS } from "@/lib/labels";
import { Badge } from "./ui";

export function SubmissionStatusBadge({ status }: { status: SubmissionStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{SUBMISSION_STATUS_LABELS[status]}</Badge>;
}

export function FormStatusBadge({ status }: { status: FormStatus }) {
  const tone = status === "PUBLIE" ? "success" : status === "DESACTIVE" ? "danger" : "neutral";
  return <Badge tone={tone}>{FORM_STATUS_LABELS[status]}</Badge>;
}

export function RoleBadge({ role }: { role: Role }) {
  const tone = role === "ADMIN" ? "info" : role === "SUPERVISEUR" ? "warning" : "neutral";
  return <Badge tone={tone}>{ROLE_LABELS[role]}</Badge>;
}

export function SeverityBadge({ severity }: { severity: IssueSeverity }) {
  return <Badge tone={severity === "ERREUR" ? "danger" : "warning"}>{SEVERITY_LABELS[severity]}</Badge>;
}
