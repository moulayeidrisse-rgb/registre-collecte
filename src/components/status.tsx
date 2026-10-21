import type { FormStatus, IssueSeverity, Role, SubmissionStatus } from "@/generated/prisma/enums";
import { FORM_STATUS_LABELS, ROLE_LABELS, SEVERITY_LABELS, STATUS_TONE, SUBMISSION_STATUS_LABELS } from "@/lib/labels";
import { Badge } from "./ui";
import type { TFunction } from "@/i18n/translate";

const id: TFunction = (k) => k;

export function SubmissionStatusBadge({ status, t = id }: { status: SubmissionStatus; t?: TFunction }) {
  return <Badge tone={STATUS_TONE[status]}>{t(SUBMISSION_STATUS_LABELS[status])}</Badge>;
}

export function FormStatusBadge({ status, t = id }: { status: FormStatus; t?: TFunction }) {
  const tone = status === "PUBLIE" ? "success" : status === "DESACTIVE" ? "danger" : "neutral";
  return <Badge tone={tone}>{t(FORM_STATUS_LABELS[status])}</Badge>;
}

export function RoleBadge({ role, t = id }: { role: Role; t?: TFunction }) {
  const tone = role === "ADMIN" ? "info" : role === "SUPERVISEUR" ? "warning" : "neutral";
  return <Badge tone={tone}>{t(ROLE_LABELS[role])}</Badge>;
}

export function SeverityBadge({ severity, t = id }: { severity: IssueSeverity; t?: TFunction }) {
  return <Badge tone={severity === "ERREUR" ? "danger" : "warning"}>{t(SEVERITY_LABELS[severity])}</Badge>;
}
