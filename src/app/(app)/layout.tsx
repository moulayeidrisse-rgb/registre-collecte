import { Suspense } from "react";
import Link from "next/link";
import { UserCircle } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { AppFrame, NavList } from "@/components/layout/app-frame";
import { NAV_ITEMS } from "@/components/layout/nav";
import { ROLE_LABELS } from "@/lib/labels";
import { Skeleton } from "@/components/ui";

// La session n'est lue que dans ces deux îlots (sous <Suspense>) : le cadre de la page
// s'affiche immédiatement et chaque page vérifie elle-même l'authentification et les droits.
async function Nav() {
  const user = await getCurrentUser();
  if (!user) return null;
  const items = NAV_ITEMS.filter((i) => (Array.isArray(i.permission) ? i.permission.some((p) => can(user, p)) : can(user, i.permission))).map(
    ({ href, label, icon }) => ({ href, label, icon }),
  );
  return <NavList items={items} />;
}

async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) return null;
  return (
    <Link href="/mon-compte" className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface">
      <UserCircle className="h-7 w-7 text-primary-700" aria-hidden />
      <span className="hidden text-left leading-tight sm:block">
        <span className="block text-sm font-medium text-ink">{user.name}</span>
        <span className="block text-xs text-muted">{ROLE_LABELS[user.role]}</span>
      </span>
      <span className="sr-only sm:hidden">Mon compte ({user.name})</span>
    </Link>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AppFrame
      nav={<Suspense fallback={<div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-8 bg-white/10" />)}</div>}><Nav /></Suspense>}
      userMenu={<Suspense fallback={<Skeleton className="h-9 w-40" />}><UserMenu /></Suspense>}
    >
      {children}
    </AppFrame>
  );
}
