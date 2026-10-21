"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  BarChart3, ClipboardList, FileText, Inbox, LayoutDashboard, LogOut, Menu, PenSquare, ScrollText, ShieldCheck, Users, X,
} from "lucide-react";
import { cn } from "@/components/ui";
import { logoutAction } from "@/app/(app)/actions";
import { ToastProvider } from "@/components/toast";

const ICONS: Record<string, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  collect: PenSquare,
  responses: Inbox,
  quality: ShieldCheck,
  forms: FileText,
  reports: BarChart3,
  users: Users,
  audit: ScrollText,
};

/** Liens du menu (liste déjà filtrée côté serveur selon les permissions) */
export function NavList({ items }: { items: { href: string; label: string; icon: string }[] }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const Icon = ICONS[item.icon] ?? FileText;
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-white/15 text-white" : "text-primary-100 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button type="submit" className="flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm text-muted hover:bg-surface hover:text-ink">
        <LogOut className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">Se déconnecter</span>
        <span className="sr-only sm:hidden">Se déconnecter</span>
      </button>
    </form>
  );
}

type Props = {
  /** Menu (composant serveur sous Suspense : lit la session) */
  nav: ReactNode;
  /** Encart utilisateur de la barre supérieure (idem) */
  userMenu: ReactNode;
  children: ReactNode;
};

export function AppFrame({ nav, userMenu, children }: Props) {
  const [open, setOpen] = useState(false);

  const sidebar = (
    <nav aria-label="Navigation principale" className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 border-b border-white/10 px-5">
        <ClipboardList className="h-6 w-6 text-primary-200" aria-hidden />
        <div className="leading-tight">
          <p className="text-sm font-semibold text-white">Registre Collecte</p>
          <p className="text-[11px] text-primary-200">Prototype de démonstration</p>
        </div>
      </div>
      {/* un clic sur un lien du menu referme le tiroir mobile */}
      <div className="flex-1 overflow-y-auto px-3 py-4" onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}>{nav}</div>
      <p className="border-t border-white/10 px-5 py-3 text-[11px] leading-snug text-primary-200">
        Données fictives — prototype non contractuel
      </p>
    </nav>
  );

  return (
    <ToastProvider>
      <div className="min-h-screen lg:pl-64">
        <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">Aller au contenu</a>
        {/* Menu latéral : fixe sur grand écran, tiroir sur mobile/tablette */}
        <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 bg-primary-900 lg:block">{sidebar}</aside>
        {open && (
          <div className="no-print fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <button className="absolute inset-0 bg-black/40" aria-label="Fermer le menu" onClick={() => setOpen(false)} />
            <aside className="relative h-full w-72 max-w-[85%] bg-primary-900 shadow-xl">
              <button onClick={() => setOpen(false)} className="absolute right-3 top-4 rounded p-1 text-primary-100 hover:bg-white/10" aria-label="Fermer le menu">
                <X className="h-5 w-5" />
              </button>
              {sidebar}
            </aside>
          </div>
        )}

        <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur sm:px-6">
          <button onClick={() => setOpen(true)} className="rounded-md p-2 text-ink hover:bg-surface lg:hidden" aria-label="Ouvrir le menu" aria-expanded={open}>
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          {userMenu}
          <LogoutButton />
        </header>

        <main id="contenu" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </ToastProvider>
  );
}
