import Link from "next/link";
import { requirePagePermission } from "@/server/auth/session";
import { listForms } from "@/server/services/forms";
import { Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { FormStatusBadge } from "@/components/status";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT())("Rapports") };
}

export default async function ReportsPage() {
  const user = await requirePagePermission("report:view");
  const t = await getT();
  const forms = (await listForms(user)).filter((f) => f.publishedVersion);
  return (
    <>
      <PageHeader t={t} title={t("Rapports")} description={t("Synthèse par formulaire : statuts, complétude et statistiques par question. Imprimables ou exportables en PDF via le navigateur.")} />
      <Card>
        {forms.length === 0 ? <EmptyState title={t("Aucun formulaire publié")} /> : (
          <Table caption={t("Formulaires")}>
            <thead><tr><Th>{t("Formulaire")}</Th><Th>{t("Statut")}</Th><Th className="text-end">{t("Réponses enregistrées")}</Th></tr></thead>
            <tbody className="divide-y divide-line bg-white">
              {forms.map((f) => (
                <tr key={f.id}>
                  <Td><Link href={`/rapports/${f.id}`} className="font-medium text-primary-700 hover:underline">{f.title}</Link><span className="block text-xs text-muted">{f.code}</span></Td>
                  <Td><FormStatusBadge status={f.status} t={t} /></Td>
                  <Td className="text-end tabular-nums">{f.submissionCount}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
