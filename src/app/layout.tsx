import type { Metadata, Viewport } from "next";
import "@fontsource/noto-naskh-arabic/arabic-400.css";
import "@fontsource/noto-naskh-arabic/arabic-600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Registre Collecte", template: "%s · Registre Collecte" },
  description: "Prototype de démonstration de modules de collecte de données (données fictives).",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#006f3c",
};

// Applique la langue et le sens d'écriture (arabe : droite à gauche) avant le premier affichage
const LOCALE_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )lang=(fr|ar)/);var l=m?m[1]:"fr";var d=document.documentElement;d.lang=l;d.dir=l==="ar"?"rtl":"ltr";}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" dir="ltr" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: LOCALE_SCRIPT }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
