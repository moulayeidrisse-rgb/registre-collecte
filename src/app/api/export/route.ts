import { NextResponse, type NextRequest } from "next/server";
import { getClientInfo, getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { AppError, NotFoundError } from "@/server/errors";
import { exportSubmissionsCsv } from "@/server/services/export";
import { audit } from "@/server/services/audit";

const p = (sp: URLSearchParams, k: string) => sp.get(k)?.slice(0, 100) || undefined;

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const { ipAddress } = await getClientInfo();
  if (!can(user, "export:csv")) {
    await audit({ actorId: user.id, action: "access.denied", entityType: "Export", metadata: { route: "/api/export" }, ipAddress });
    return NextResponse.json({ error: "Vous n'avez pas le droit d'exporter des données." }, { status: 403 });
  }
  const sp = req.nextUrl.searchParams;
  const formId = p(sp, "formId");
  if (!formId) return NextResponse.json({ error: "Paramètre formId obligatoire." }, { status: 400 });
  try {
    const { filename, content } = await exportSubmissionsCsv(user, { formId, status: p(sp, "status"), from: p(sp, "from"), to: p(sp, "to"), q: p(sp, "q") }, ipAddress);
    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename.replace(/[^A-Za-z0-9_.-]/g, "_")}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    if (e instanceof NotFoundError) return NextResponse.json({ error: e.message }, { status: 404 });
    if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[export]", e);
    return NextResponse.json({ error: "Erreur lors de l'export." }, { status: 500 });
  }
}
