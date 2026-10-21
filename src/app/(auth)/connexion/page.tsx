import { Suspense } from "react";
import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { LoginForm } from "./login-form";
import { Skeleton } from "@/components/ui";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 rounded-lg bg-primary-700 p-3 text-white">
            <ClipboardList className="h-7 w-7" aria-hidden />
          </div>
          <h1 className="text-xl font-semibold">Registre Collecte</h1>
          <p className="mt-1 text-sm text-muted">Modules de collecte de données — prototype de démonstration</p>
        </div>
        <div className="rounded-lg border border-line bg-white p-6 shadow-sm">
          <Suspense fallback={<Skeleton className="h-56" />}>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-xs text-muted">
          Prototype générique non contractuel. Toutes les données affichées sont fictives.
        </p>
      </div>
    </div>
  );
}
