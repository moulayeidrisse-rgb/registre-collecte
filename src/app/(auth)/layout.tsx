import { Suspense } from "react";
import { getLocale } from "@/i18n/server";
import { I18nProvider } from "@/i18n/client";
import { Skeleton } from "@/components/ui";

async function Localized({ children }: { children: React.ReactNode }) {
  return <I18nProvider locale={await getLocale()}>{children}</I18nProvider>;
}

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Skeleton className="h-80 w-96 max-w-full" /></div>}>
      <Localized>{children}</Localized>
    </Suspense>
  );
}
