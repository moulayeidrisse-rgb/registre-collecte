import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { NotFoundError } from "@/server/errors";
import { getSubmissionDetail } from "@/server/services/submissions";
import { displayValue } from "@/server/services/mappers";
import { Alert, ButtonLink, Card, CardHeader, PageHeader } from "@/components/ui";
import { SeverityBadge, SubmissionStatusBadge } from "@/components/status";
import { AUDIT_ACTION_LABELS, ISSUE_TYPE_LABELS } from "@/lib/labels";
import { formatDateTime } from "@/lib/format";
import { ReviewForm } from "./review-form";

export const metadata = { title: "Détail de la réponse" };

export default async function ResponseDetailPage({ params }: PageProps<"/reponses/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const d = await getSubmissionDetail(user, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const s = d.submission;
  const issuesByField = new Map<string, typeof s.issues>();
  for (const i of s.issues) {
    const k = i.field?.key ?? "_";
    issuesByField.set(k, [...(issuesByField.get(k) ?? []), i]);
  }
  const warnings = s.issues.filter((i) => i.severity === "AVERTISSEMENT").length;

  return (
    <>
      <PageHeader
        title={`Réponse ${s.reference}`}
        breadcrumb={[{ href: "/reponses", label: user.role === "AGENT" ? "Mes réponses" : "Réponses" }]}
        description={<span className="flex flex-wrap items-center gap-2"><SubmissionStatusBadge status={s.status} /><span>{d.form.title} · v{s.version.number}</span></span>}
        actions={d.canEdit && <ButtonLink href={`/reponses/${s.id}/modifier`}><Pencil className="h-4 w-4" aria-hidden />{s.status === "BROUILLON" ? "Reprendre la saisie" : "Corriger"}</ButtonLink>}
      />

      {s.status === "A_CORRIGER" && s.reviewComment && (
        <Alert tone="warning" className="mb-6" title="Correction demandée par le superviseur">{s.reviewComment}</Alert>
      )}
      {s.status === "REJETEE" && s.reviewComment && <Alert tone="danger" className="mb-6" title="Motif du rejet">{s.reviewComment}</Alert>}

      <div className="grid items-start gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Valeurs saisies" description={`Complétude : ${s.completeness} %`} />
          <dl className="divide-y divide-line">
            {d.fields.map((f) => {
              const v = d.values[f.key] ?? null;
              const iss = issuesByField.get(f.key) ?? [];
              return (
                <div key={f.key} className="grid gap-1 px-5 py-3 sm:grid-cols-5 sm:gap-4">
                  <dt className="text-sm text-muted sm:col-span-2">{f.label}{f.required && <span className="text-red-700" aria-hidden> *</span>}</dt>
                  <dd className="text-sm sm:col-span-3">
                    {v === null ? <span className="italic text-muted">Non renseigné</span> : <span className="whitespace-pre-wrap break-words">{displayValue(f, v)}</span>}
                    {iss.map((i) => (
                      <p key={i.id} className={i.severity === "ERREUR" ? "mt-1 text-red-700" : "mt-1 text-amber-800"}>{i.message}</p>
                    ))}
                  </dd>
                </div>
              );
            })}
          </dl>
        </Card>

        <div className="space-y-6">
          {d.canReview && (
            <Card>
              <CardHeader title="Validation" description="Décision du superviseur" />
              <ReviewForm submissionId={s.id} warningCount={warnings} />
            </Card>
          )}

          <Card>
            <CardHeader title="Contrôle qualité" />
            {s.issues.length === 0 ? (
              <p className="px-5 py-4 text-sm text-emerald-800">Aucune anomalie détectée.</p>
            ) : (
              <ul className="divide-y divide-line">
                {s.issues.map((i) => (
                  <li key={i.id} className="px-5 py-3 text-sm">
                    <div className="mb-1 flex flex-wrap items-center gap-2"><SeverityBadge severity={i.severity} /><span className="text-xs text-muted">{ISSUE_TYPE_LABELS[i.type]}</span></div>
                    <p>{i.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Informations" />
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 px-5 py-4 text-sm">
              <dt className="text-muted">Agent</dt><dd>{s.agent.name}</dd>
              <dt className="text-muted">Créée le</dt><dd>{formatDateTime(s.createdAt)}</dd>
              <dt className="text-muted">Soumise le</dt><dd>{formatDateTime(s.submittedAt)}</dd>
              <dt className="text-muted">Traitée par</dt><dd>{s.reviewedBy?.name ?? "—"}</dd>
              <dt className="text-muted">Traitée le</dt><dd>{formatDateTime(s.reviewedAt)}</dd>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Historique" />
            <ol className="space-y-3 px-5 py-4 text-sm">
              {d.history.map((h) => (
                <li key={h.id} className="border-l-2 border-primary-200 pl-3">
                  <p className="font-medium">{AUDIT_ACTION_LABELS[h.action] ?? h.action}</p>
                  <p className="text-xs text-muted">{formatDateTime(h.createdAt)} · {h.actor?.name ?? "Système"}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
