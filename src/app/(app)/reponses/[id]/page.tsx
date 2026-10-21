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
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT())("Détail de la réponse") };
}

export default async function ResponseDetailPage({ params }: PageProps<"/reponses/[id]">) {
  const user = await requireUser();
  const t = await getT();
  const L = t.locale;
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
  const show = (f: (typeof d.fields)[number], v: (typeof d.values)[string]) => {
    const out = displayValue(f, v);
    return f.type === "OUI_NON" ? t(out) : out;
  };

  return (
    <>
      <PageHeader
        t={t}
        title={t("Réponse {ref}", { ref: s.reference })}
        breadcrumb={[{ href: "/reponses", label: user.role === "AGENT" ? t("Mes réponses") : t("Réponses") }]}
        description={<span className="flex flex-wrap items-center gap-2"><SubmissionStatusBadge status={s.status} t={t} /><span>{d.form.title} · v{s.version.number}</span></span>}
        actions={d.canEdit && <ButtonLink href={`/reponses/${s.id}/modifier`}><Pencil className="h-4 w-4" aria-hidden />{s.status === "BROUILLON" ? t("Reprendre la saisie") : t("Corriger")}</ButtonLink>}
      />

      {s.status === "A_CORRIGER" && s.reviewComment && (
        <Alert tone="warning" className="mb-6" title={t("Correction demandée par le superviseur")}>{s.reviewComment}</Alert>
      )}
      {s.status === "REJETEE" && s.reviewComment && <Alert tone="danger" className="mb-6" title={t("Motif du rejet")}>{s.reviewComment}</Alert>}

      <div className="grid items-start gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title={t("Valeurs saisies")} description={t("Complétude : {n} %", { n: s.completeness })} />
          <dl className="divide-y divide-line">
            {d.fields.map((f) => {
              const v = d.values[f.key] ?? null;
              const iss = issuesByField.get(f.key) ?? [];
              return (
                <div key={f.key} className="grid gap-1 px-5 py-3 sm:grid-cols-5 sm:gap-4">
                  <dt className="text-sm text-muted sm:col-span-2">{f.label}{f.required && <span className="text-red-700" aria-hidden> *</span>}</dt>
                  <dd className="text-sm sm:col-span-3">
                    {v === null ? <span className="italic text-muted">{t("Non renseigné")}</span> : <span className="whitespace-pre-wrap break-words">{show(f, v)}</span>}
                    {iss.map((i) => (
                      <p key={i.id} className={i.severity === "ERREUR" ? "mt-1 text-red-700" : "mt-1 text-amber-800"}>{t.msg(i.message)}</p>
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
              <CardHeader title={t("Validation")} description={t("Décision du superviseur")} />
              <ReviewForm submissionId={s.id} warningCount={warnings} />
            </Card>
          )}

          <Card>
            <CardHeader title={t("Contrôle qualité")} />
            {s.issues.length === 0 ? (
              <p className="px-5 py-4 text-sm text-emerald-800">{t("Aucune anomalie détectée.")}</p>
            ) : (
              <ul className="divide-y divide-line">
                {s.issues.map((i) => (
                  <li key={i.id} className="px-5 py-3 text-sm">
                    <div className="mb-1 flex flex-wrap items-center gap-2"><SeverityBadge severity={i.severity} t={t} /><span className="text-xs text-muted">{t(ISSUE_TYPE_LABELS[i.type])}</span></div>
                    <p>{t.msg(i.message)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title={t("Informations")} />
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 px-5 py-4 text-sm">
              <dt className="text-muted">{t("Agent")}</dt><dd>{s.agent.name}</dd>
              <dt className="text-muted">{t("Créée le")}</dt><dd>{formatDateTime(s.createdAt, L)}</dd>
              <dt className="text-muted">{t("Soumise le")}</dt><dd>{formatDateTime(s.submittedAt, L)}</dd>
              <dt className="text-muted">{t("Traitée par")}</dt><dd>{s.reviewedBy?.name ?? "—"}</dd>
              <dt className="text-muted">{t("Traitée le")}</dt><dd>{formatDateTime(s.reviewedAt, L)}</dd>
            </dl>
          </Card>

          <Card>
            <CardHeader title={t("Historique")} />
            <ol className="space-y-3 px-5 py-4 text-sm">
              {d.history.map((h) => (
                <li key={h.id} className="border-s-2 border-primary-200 ps-3">
                  <p className="font-medium">{t(AUDIT_ACTION_LABELS[h.action] ?? h.action)}</p>
                  <p className="text-xs text-muted">{formatDateTime(h.createdAt, L)} · {h.actor?.name ?? t("Système")}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
