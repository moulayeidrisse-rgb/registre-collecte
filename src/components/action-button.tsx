"use client";

import { useTransition, type ReactNode } from "react";
import { Button } from "./ui";
import { useToast } from "./toast";
import { useT } from "@/i18n/client";

type Result = { ok: boolean; message?: string } | null | void;

/** Bouton qui déclenche une Server Action (déjà liée à ses arguments) et affiche le résultat */
export function ActionButton({
  action,
  children,
  variant = "secondary",
  size = "md",
  confirmMessage,
  pendingLabel,
}: {
  action: () => Promise<Result>;
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "success" | "ghost";
  size?: "sm" | "md";
  confirmMessage?: string;
  pendingLabel?: string;
}) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const t = useT();
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={pending}
      onClick={() => {
        if (confirmMessage && !window.confirm(confirmMessage)) return;
        start(async () => {
          const r = await action();
          if (r && r.message) toast(r.ok ? "success" : "danger", t.msg(r.message));
        });
      }}
    >
      {pending ? pendingLabel ?? t("Traitement…") : children}
    </Button>
  );
}
