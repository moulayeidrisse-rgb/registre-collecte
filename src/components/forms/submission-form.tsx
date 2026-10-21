"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import type { FieldDef, RawValue, RawValues, RuleDef, ValidationIssue } from "@/lib/validation/types";
import { issuesByField, validateSubmission } from "@/lib/validation/engine";
import { Alert, Button, Label, cn, inputClass } from "@/components/ui";
import { useToast } from "@/components/toast";

export type SaveResult =
  | { ok: true; message?: string; redirectTo?: string; warnings?: ValidationIssue[] }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]>; issues?: ValidationIssue[] };

type Props = {
  fields: FieldDef[];
  rules: RuleDef[];
  initialValues?: RawValues;
  mode: "entry" | "preview";
  /** autorise l'enregistrement en brouillon */
  allowDraft?: boolean;
  submitLabel?: string;
  onSave?: (intent: "draft" | "submit", values: RawValues) => Promise<SaveResult>;
};

function toRaw(v: unknown): RawValue {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "oui" : "non";
  if (typeof v === "number") return String(v);
  return v as RawValue;
}

export function SubmissionForm({ fields, rules, initialValues = {}, mode, allowDraft = true, submitLabel = "Soumettre", onSave }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState<RawValues>(() => Object.fromEntries(fields.map((f) => [f.key, toRaw(initialValues[f.key])])));
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showAll, setShowAll] = useState(false);
  const [serverResult, setServerResult] = useState<SaveResult | null>(null);
  const [pending, start] = useTransition();
  const summaryRef = useRef<HTMLDivElement>(null);

  // Validation immédiate dans le navigateur (le serveur revalide systématiquement)
  const client = useMemo(() => validateSubmission(fields, rules, values), [fields, rules, values]);
  const byField = useMemo(() => issuesByField(client.issues), [client.issues]);
  const serverErrors = serverResult && !serverResult.ok ? serverResult.fieldErrors ?? {} : {};

  const set = (key: string, v: RawValue) => {
    setValues((s) => ({ ...s, [key]: v }));
    setServerResult(null);
  };
  const touch = (key: string) => setTouched((t) => (t[key] ? t : { ...t, [key]: true }));
  // Au départ d'un champ, l'erreur s'affiche avec un léger délai : sinon le message qui apparaît
  // décale la page pendant le clic en cours (bouton, case à cocher) et le clic est perdu.
  const touchLater = (key: string) => window.setTimeout(() => touch(key), 250);

  const visibleIssues = (key: string) => (showAll || touched[key] ? byField[key] ?? [] : []);

  async function save(intent: "draft" | "submit") {
    if (intent === "submit") setShowAll(true);
    if (mode === "preview") {
      setShowAll(true);
      toast(client.hasBlockingErrors ? "danger" : "success", client.hasBlockingErrors ? "Aperçu : la réponse serait refusée (voir les erreurs)." : "Aperçu : la réponse serait acceptée. Rien n'a été enregistré.");
      return;
    }
    if (intent === "submit" && client.hasBlockingErrors) {
      summaryRef.current?.focus();
      summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    start(async () => {
      const r = await onSave!(intent, values);
      setServerResult(r);
      if (r.ok) {
        toast("success", r.message ?? "Enregistré.");
        if (r.redirectTo) router.push(r.redirectTo);
      } else {
        setShowAll(true);
        toast("danger", r.message);
        setTimeout(() => summaryRef.current?.focus(), 50);
      }
    });
  }

  const blocking = client.issues.filter((i) => i.severity === "ERREUR");
  const warnings = client.issues.filter((i) => i.severity === "AVERTISSEMENT");

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        save("submit");
      }}
      className="space-y-6"
    >
      <div ref={summaryRef} tabIndex={-1} className="space-y-3 outline-none">
        {serverResult && !serverResult.ok && (
          <Alert tone="danger" title={serverResult.message}>
            {serverResult.issues && serverResult.issues.filter((i) => i.severity === "ERREUR").length > 0 && (
              <ul className="list-disc space-y-0.5 pl-4">
                {serverResult.issues.filter((i) => i.severity === "ERREUR").map((i, n) => <li key={n}>{i.message}</li>)}
              </ul>
            )}
          </Alert>
        )}
        {showAll && blocking.length > 0 && !(serverResult && !serverResult.ok) && (
          <Alert tone="danger" title={`${blocking.length} erreur${blocking.length > 1 ? "s" : ""} à corriger avant de soumettre`}>
            <ul className="list-disc space-y-0.5 pl-4">
              {blocking.map((i, n) => (
                <li key={n}>
                  {i.fieldKey ? <a href={`#champ-${i.fieldKey}`} className="underline">{i.message}</a> : i.message}
                </li>
              ))}
            </ul>
          </Alert>
        )}
        {showAll && warnings.length > 0 && (
          <Alert tone="warning" title="Points à vérifier (non bloquants)">
            <ul className="list-disc space-y-0.5 pl-4">{warnings.map((i, n) => <li key={n}>{i.message}</li>)}</ul>
          </Alert>
        )}
      </div>

      {fields.map((f, idx) => {
        const issues = visibleIssues(f.key);
        const srvMsgs = serverErrors[f.key] ?? [];
        const errMsgs = [...new Set([...issues.filter((i) => i.severity === "ERREUR").map((i) => i.message), ...srvMsgs])];
        const warnMsgs = issues.filter((i) => i.severity === "AVERTISSEMENT").map((i) => i.message);
        const invalid = errMsgs.length > 0;
        const id = `champ-${f.key}`;
        const describedBy = [f.helpText ? `${id}-aide` : "", invalid ? `${id}-err` : "", warnMsgs.length ? `${id}-warn` : ""].filter(Boolean).join(" ") || undefined;
        const common = { id, "aria-invalid": invalid, "aria-describedby": describedBy, onBlur: () => touchLater(f.key) };
        const v = values[f.key];

        return (
          <div key={f.key} className="scroll-mt-24">
            {["CHOIX_UNIQUE", "CHOIX_MULTIPLE", "OUI_NON"].includes(f.type) ? (
              <fieldset aria-describedby={describedBy} aria-invalid={invalid} id={id} tabIndex={-1} onBlur={() => touchLater(f.key)}>
                <legend className="mb-1 block text-sm font-medium text-ink">
                  <span className="mr-1 text-muted">{idx + 1}.</span>{f.label}
                  {f.required && <span className="ml-0.5 text-red-700" aria-hidden> *</span>}
                  {f.required && <span className="sr-only"> (obligatoire)</span>}
                </legend>
                {f.helpText && <p id={`${id}-aide`} className="mb-2 text-xs text-muted">{f.helpText}</p>}
                <div className={cn("flex flex-wrap gap-2", f.type === "CHOIX_MULTIPLE" && "flex-col sm:flex-row")}>
                  {(f.type === "OUI_NON" ? [{ value: "oui", label: "Oui" }, { value: "non", label: "Non" }] : f.options ?? []).map((o) => {
                    const checked = f.type === "CHOIX_MULTIPLE" ? Array.isArray(v) && v.includes(o.value) : v === o.value;
                    return (
                      <label key={o.value} className={cn("flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm", checked ? "border-primary-500 bg-primary-50" : "border-line bg-white hover:bg-surface", invalid && "border-red-300")}>
                        <input
                          type={f.type === "CHOIX_MULTIPLE" ? "checkbox" : "radio"}
                          name={f.key}
                          value={o.value}
                          checked={checked}
                          onChange={(e) => {
                            touch(f.key);
                            if (f.type === "CHOIX_MULTIPLE") {
                              const cur = Array.isArray(v) ? v : [];
                              set(f.key, e.target.checked ? [...cur, o.value] : cur.filter((x) => x !== o.value));
                            } else set(f.key, o.value);
                          }}
                        />
                        {o.label}
                      </label>
                    );
                  })}
                  {f.type !== "CHOIX_MULTIPLE" && !f.required && v && (
                    <button type="button" className="text-xs text-primary-700 underline" onClick={() => set(f.key, "")}>Effacer</button>
                  )}
                </div>
              </fieldset>
            ) : (
              <>
                <Label htmlFor={id} required={f.required}><span className="mr-1 text-muted">{idx + 1}.</span>{f.label}</Label>
                {f.helpText && <p id={`${id}-aide`} className="mb-1.5 text-xs text-muted">{f.helpText}</p>}
                {f.type === "LISTE" ? (
                  <select {...common} value={String(v ?? "")} onChange={(e) => { touch(f.key); set(f.key, e.target.value); }} className={inputClass}>
                    <option value="">— Sélectionner —</option>
                    {(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : f.type === "DATE" ? (
                  <input {...common} type="date" value={String(v ?? "")} min={f.validation?.minDate} max={f.validation?.maxDate} onChange={(e) => set(f.key, e.target.value)} className={cn(inputClass, "max-w-xs")} />
                ) : f.type === "NOMBRE" ? (
                  <input {...common} type="text" inputMode="decimal" value={String(v ?? "")} onChange={(e) => set(f.key, e.target.value)} className={cn(inputClass, "max-w-xs")} />
                ) : (f.validation?.maxLength ?? 0) > 200 ? (
                  <textarea {...common} rows={3} value={String(v ?? "")} maxLength={f.validation?.maxLength} onChange={(e) => set(f.key, e.target.value)} className={inputClass} />
                ) : (
                  <input {...common} type={f.validation?.format === "email" ? "email" : f.validation?.format === "telephone" ? "tel" : "text"} value={String(v ?? "")} maxLength={f.validation?.maxLength} onChange={(e) => set(f.key, e.target.value)} className={inputClass} />
                )}
                {f.type === "NOMBRE" && (f.validation?.min !== undefined || f.validation?.max !== undefined) && (
                  <p className="mt-1 text-xs text-muted">
                    Valeur attendue{f.validation?.min !== undefined ? ` ≥ ${f.validation.min}` : ""}{f.validation?.max !== undefined ? ` et ≤ ${f.validation.max}` : ""}{f.validation?.integer ? " (nombre entier)" : ""}.
                  </p>
                )}
              </>
            )}
            {invalid && (
              <div id={`${id}-err`} className="mt-1 space-y-0.5 text-sm text-red-700">
                {errMsgs.map((m, n) => <p key={n}>{m}</p>)}
              </div>
            )}
            {warnMsgs.length > 0 && (
              <div id={`${id}-warn`} className="mt-1 flex gap-1.5 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <div>{warnMsgs.map((m, n) => <p key={n}>{m}</p>)}</div>
              </div>
            )}
          </div>
        );
      })}

      {/* mousedown sans perte de focus : évite que l'apparition d'un message d'erreur (au blur)
          ne déplace le bouton entre l'appui et le relâchement du clic */}
      <div
        className="sticky bottom-0 -mx-5 flex flex-wrap items-center gap-3 border-t border-line bg-white/95 px-5 py-3 backdrop-blur"
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) e.preventDefault();
        }}
      >
        <Button type="submit" disabled={pending}>{pending ? "Envoi…" : mode === "preview" ? "Tester la validation" : submitLabel}</Button>
        {allowDraft && mode === "entry" && (
          <Button type="button" variant="secondary" disabled={pending} onClick={() => save("draft")}>Enregistrer le brouillon</Button>
        )}
        <span className="text-xs text-muted">
          Complétude : <strong className="tabular-nums">{client.completeness} %</strong>
          {blocking.length > 0 && <> · {blocking.length} point(s) à compléter ou corriger</>}
        </span>
      </div>
    </form>
  );
}
