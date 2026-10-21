"use client";

import { useTransition } from "react";
import { Languages } from "lucide-react";
import { setLocaleAction } from "@/app/locale-actions";
import { dirOf, type Locale } from "@/i18n/config";
import { useLocale } from "@/i18n/client";
import { cn } from "./ui";

const OPTIONS: { value: Locale; label: string; lang: string }[] = [
  { value: "fr", label: "Français", lang: "fr" },
  { value: "ar", label: "العربية", lang: "ar" },
];

export function LanguageSwitcher({ className }: { className?: string }) {
  const current = useLocale();
  const [pending, start] = useTransition();
  return (
    <div role="group" aria-label={current === "ar" ? "اللغة" : "Langue"} className={cn("flex items-center gap-1 rounded-md border border-line bg-white p-0.5 text-sm", className)}>
      <Languages className="mx-1 h-4 w-4 text-muted" aria-hidden />
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          lang={o.lang}
          disabled={pending}
          aria-pressed={current === o.value}
          onClick={() => {
            if (o.value === current) return;
            document.documentElement.lang = o.value;
            document.documentElement.dir = dirOf(o.value);
            start(() => setLocaleAction(o.value));
          }}
          className={cn(
            "rounded px-2 py-1 font-medium transition-colors",
            current === o.value ? "bg-primary-700 text-white" : "text-ink hover:bg-surface",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
