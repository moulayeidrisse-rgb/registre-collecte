import { NextResponse, type NextRequest } from "next/server";

// Redirection « optimiste » : sans cookie de session, inutile d'afficher une page protégée.
// Ce n'est PAS le contrôle d'accès : la session et les droits sont vérifiés côté serveur
// dans chaque page, Server Action et Route Handler.
const PUBLIC_PATHS = ["/connexion"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = request.cookies.has("rc_session");
  if (!hasSession && !PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = pathname !== "/" ? `?suite=${encodeURIComponent(pathname + search)}` : "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|ico|txt)$).*)"],
};
