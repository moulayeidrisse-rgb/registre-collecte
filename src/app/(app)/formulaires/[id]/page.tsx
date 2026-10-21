import { notFound } from "next/navigation";
import { Download, Eye, BarChart3, Pencil } from "lucide-react";
import { requirePagePermission } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { NotFoundError } from "@/server/errors";
import { getFormOverview } from "@/server/services/forms";
import { listAssignableUsers } from "@/server/services/users";
import { Alert, Badge, ButtonLink, Card, CardHeader, PageHeader, Table, Td, Th } from "@/components/ui";
import { FormStatusBadge, RoleBadge } from "@/components/status";
import { ActionButton } from "@/components/action-button";
import { VERSION_STATUS_LABELS } from "@/lib/labels";
import { formatDateTime } from "@/lib/format";
import { publishFormAction, rescanAction, setFormActiveAction, startNewVersionAction } from "../actions";
import { AssignmentsForm } from "./assignments-form";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT())("Formulaire") };
}

export default async function FormOverviewPage({ params }: PageProps<"/formulaires/[id]">) {
  const user = await requirePagePermission("form:view");
  const t = await getT();
  const L = t.locale;
  const { id } = await params;
  const form = await getFormOverview(user, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const manage = can(user, "form:manage");
  const draft = form.versions.find((v) => v.status === "BROUILLON");
  const published = form.versions.find((v) => v.status === "PUBLIEE");
  const assignable = manage ? await listAssignableUsers(user) : [];

  return (
    <>
      <PageHeader
        t={t}
        title={form.title}
        breadcrumb={[{ href: "/formulaires", label: t("Formulaires") }]}
        description={<span className="flex flex-wrap items-center gap-2"><span>{form.code}</span><FormStatusBadge status={form.status} t={t} />{published && <span>{t("Version publiée : v{n}", { n: published.number })}</span>}</span>}
        actions={
          <>
            <ButtonLink href={`/formulaires/${form.id}/apercu`} variant="secondary"><Eye className="h-4 w-4" aria-hidden />{t("Aperçu")}</ButtonLink>
            {can(user, "report:view") && published && <ButtonLink href={`/rapports/${form.id}`} variant="secondary"><BarChart3 className="h-4 w-4" aria-hidden />{t("Rapport")}</ButtonLink>}
            {can(user, "export:csv") && published && <ButtonLink href={`/api/export?formId=${form.id}`} variant="secondary" prefetch={false}><Download className="h-4 w-4" aria-hidden />{t("Export CSV")}</ButtonLink>}
          </>
        }
      />

      {form.description && <p className="mb-6 max-w-3xl text-sm text-ink">{form.description}</p>}

      {manage && (
        <Card className="mb-6">
          <CardHeader title={t("Cycle de vie")} description={t("Une version publiée est figée : la modifier crée une nouvelle version, sans affecter les réponses déjà saisies.")} />
          <div className="space-y-4 p-5">
            {draft ? (
              <Alert tone="info" title={t("Version {n} en préparation ({f} question(s), {r} règle(s))", { n: draft.number, f: draft._count.fields, r: draft._count.rules })}>
                {published ? t("Modifiez-la puis publiez-la pour la rendre disponible aux agents à la place de la v{n}.", { n: published.number }) : t("Modifiez-la puis publiez-la pour la rendre disponible aux agents.")}
              </Alert>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {draft ? (
                <>
                  <ButtonLink href={`/formulaires/${form.id}/modifier`}><Pencil className="h-4 w-4" aria-hidden />{t("Modifier le brouillon")}</ButtonLink>
                  <ActionButton action={publishFormAction.bind(null, form.id)} variant="success" confirmMessage={t("Publier la version {n} ? Elle deviendra la version utilisée pour toute nouvelle saisie.", { n: draft.number })}>{t("Publier la version {n}", { n: draft.number })}</ActionButton>
                </>
              ) : (
                <ActionButton action={startNewVersionAction.bind(null, form.id)} variant="primary">{t("Modifier (nouvelle version)")}</ActionButton>
              )}
              {form.status === "PUBLIE" && <ActionButton action={setFormActiveAction.bind(null, form.id, false)} variant="danger" confirmMessage={t("Désactiver ce formulaire ? Les agents ne pourront plus saisir ni modifier de réponses.")}>{t("Désactiver")}</ActionButton>}
              {form.status === "DESACTIVE" && <ActionButton action={setFormActiveAction.bind(null, form.id, true)}>{t("Réactiver")}</ActionButton>}
              {published && can(user, "quality:rescan") && <ActionButton action={rescanAction.bind(null, form.id)} confirmMessage={t("Recalculer les anomalies de toutes les réponses de ce formulaire ?")}>{t("Relancer le contrôle qualité")}</ActionButton>}
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title={t("Versions")} />
          <Table caption={t("Versions du formulaire")}>
            <thead><tr><Th>{t("Version")}</Th><Th>{t("Statut")}</Th><Th className="text-end">{t("Questions")}</Th><Th className="text-end">{t("Réponses")}</Th><Th>{t("Publiée le")}</Th></tr></thead>
            <tbody className="divide-y divide-line">
              {form.versions.map((v) => (
                <tr key={v.id}>
                  <Td className="font-medium">v{v.number}</Td>
                  <Td><Badge tone={v.status === "PUBLIEE" ? "success" : v.status === "BROUILLON" ? "info" : "neutral"}>{t(VERSION_STATUS_LABELS[v.status])}</Badge></Td>
                  <Td className="text-end tabular-nums">{v._count.fields}</Td>
                  <Td className="text-end tabular-nums">{v._count.submissions}</Td>
                  <Td className="text-muted">{formatDateTime(v.publishedAt, L)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="border-t border-line px-5 py-3 text-xs text-muted">
            {t("Créé par {name} le {date}. Critères de doublon : {keys}.", { name: form.createdBy.name, date: formatDateTime(form.createdAt, L), keys: form.duplicateFieldKeys.length ? form.duplicateFieldKeys.join(", ") : t("aucun") })}
          </p>
        </Card>

        <Card>
          <CardHeader title={t("Utilisateurs affectés")} description={t("Les agents affectés peuvent saisir ; les superviseurs affectés suivent et valident les réponses.")} />
          {manage ? (
            <AssignmentsForm formId={form.id} users={assignable} assigned={form.assignments.map((a) => a.userId)} />
          ) : (
            <ul className="divide-y divide-line">
              {form.assignments.map((a) => (
                <li key={a.id} className="flex items-center justify-between px-5 py-2.5 text-sm"><span>{a.user.name}</span><RoleBadge role={a.user.role} t={t} /></li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
