import { Suspense } from "react";
import Link from "next/link";
import { UserCircle } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { AppFrame, NavList } from "@/components/layout/app-frame";
import { NAV_ITEMS } from "@/components/layout/nav";
import { ROLE_LABELS } from "@/lib/labels";
import { PageSkeleton, Skeleton } from "@/components/ui";
import { getLocale, getT } from "@/i18n/server";
import { I18nProvider } from "@/i18n/client";

// La session n'est lue que dans ces deux îlots (sous <Suspense>) ; chaque page vérifie
// elle-même l'authentification et les droits.
async function Nav() {
  const user = await getCurrentUser();
  if (!user) return null;
  const t = await getT();
  const items = NAV_ITEMS.filter((i) => (Array.isArray(i.permission) ? i.permission.some((p) => can(user, p)) : can(user, i.permission))).map(
    ({ href, label, icon }) => ({ href, label: t(label), icon }),
  );
  return <NavList items={items} />;
}

async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) return null;
  const t = await getT();
  return (
    <Link href="/mon-compte" className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface">
      <UserCircle className="h-7 w-7 text-primary-700" aria-hidden />
      <span className="hidden text-start leading-tight sm:block">
        <span className="block text-sm font-medium text-ink">{user.name}</span>
        <span className="block text-xs text-muted">{t(ROLE_LABELS[user.role])}</span>
      </span>
      <span className="sr-only sm:hidden">{t("Mon compte")} ({user.name})</span>
    </Link>
  );
}

/** La langue (cookie) est lue ici, sous <Suspense>, puis transmise aux composants clients */
async function Localized({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <I18nProvider locale={locale}>
      <AppFrame
        nav={<Suspense fallback={<div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-8 bg-white/10" />)}</div>}><Nav /></Suspense>}
        userMenu={<Suspense fallback={<Skeleton className="h-9 w-40" />}><UserMenu /></Suspense>}
      >
        {children}
      </AppFrame>
    </I18nProvider>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen lg:ps-64">
          <div className="fixed inset-y-0 start-0 hidden w-64 bg-primary-900 lg:block" />
          <div className="h-16 border-b border-line bg-white" />
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8"><PageSkeleton /></div>
        </div>
      }
    >
      <Localized>{children}</Localized>
    </Suspense>
  );
}
