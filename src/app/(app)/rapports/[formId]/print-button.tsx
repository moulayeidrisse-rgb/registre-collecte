"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui";
import { useT } from "@/i18n/client";

export function PrintButton() {
  const t = useT();
  return <Button variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" aria-hidden />{t("Imprimer / PDF")}</Button>;
}
