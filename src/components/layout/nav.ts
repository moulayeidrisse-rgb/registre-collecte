import type { Permission } from "@/server/auth/permissions";

export type NavItem = { href: string; label: string; icon: string; permission: Permission | Permission[] };

/** Entrées du menu. L'affichage dépend des permissions, mais chaque page revérifie côté serveur. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/tableau-de-bord", label: "Tableau de bord", icon: "dashboard", permission: "dashboard:view" },
  { href: "/collecte", label: "Collecte", icon: "collect", permission: "submission:create" },
  { href: "/reponses", label: "Réponses", icon: "responses", permission: ["submission:view_all", "submission:view_scope", "submission:view_own"] },
  { href: "/qualite", label: "Qualité des données", icon: "quality", permission: "quality:view" },
  { href: "/formulaires", label: "Formulaires", icon: "forms", permission: "form:view" },
  { href: "/rapports", label: "Rapports", icon: "reports", permission: "report:view" },
  { href: "/utilisateurs", label: "Utilisateurs", icon: "users", permission: "user:manage" },
  { href: "/journal", label: "Journal d'audit", icon: "audit", permission: "audit:view" },
];
