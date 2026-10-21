import Link from "next/link";
import { requirePagePermission } from "@/server/auth/session";
import { listForms } from "@/server/services/forms";
import { Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { FormStatusBadge } from "@/components/status";

export const metadata = { title: "Rapports" };

export default async function ReportsPage() {
  const user = await requirePagePermission("report:view");
  const forms = (await listForms(user)).filter((f) => f.publishedVersion);
  return (
    <>
      <PageHeader title="Rapports" description="Synthèse par formulaire : statuts, complétude et statistiques par question. Imprimables ou exportables en PDF via le navigateur." />
      <Card>
        {forms.length === 0 ? <EmptyState title="Aucun formulaire publié" /> : (
          <Table caption="Formulaires">
            <thead><tr><Th>Formulaire</Th><Th>Statut</Th><Th className="text-right">Réponses enregistrées</Th></tr></thead>
            <tbody className="divide-y divide-line bg-white">
              {forms.map((f) => (
                <tr key={f.id}>
                  <Td><Link href={`/rapports/${f.id}`} className="font-medium text-primary-700 hover:underline">{f.title}</Link><span className="block text-xs text-muted">{f.code}</span></Td>
                  <Td><FormStatusBadge status={f.status} /></Td>
                  <Td className="text-right tabular-nums">{f.submissionCount}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
