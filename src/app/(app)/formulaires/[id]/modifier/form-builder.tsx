"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Copy, Eye, Plus, Trash2 } from "lucide-react";
import type { FieldDef, FieldOption, FieldType, FieldValidation, RuleDef, RuleDefinition, ComparisonOperator } from "@/lib/validation/types";
import { COMPARISON_OPERATORS } from "@/lib/validation/types";
import { FIELD_TYPE_LABELS } from "@/lib/labels";
import { Alert, Button, Card, CardHeader, buttonClass, cn, inputClass } from "@/components/ui";
import { useToast } from "@/components/toast";
import { publishFormAction, saveFormDraftAction } from "../../actions";
import { useT } from "@/i18n/client";

type DraftField = FieldDef & { uid: string; keyEdited: boolean; options: FieldOption[]; validation: FieldValidation };
type DraftRule = RuleDef & { uid: string };

const FIELD_TYPES = Object.keys(FIELD_TYPE_LABELS) as FieldType[];
const OP_LABELS: Record<ComparisonOperator, string> = { "<": "est inférieur à", "<=": "est inférieur ou égal à", ">": "est supérieur à", ">=": "est supérieur ou égal à", "=": "est égal à", "!=": "est différent de" };
const hasOptions = (t: FieldType) => t === "LISTE" || t === "CHOIX_UNIQUE" || t === "CHOIX_MULTIPLE";

// identifiants stables pour les éléments initiaux (identiques serveur/navigateur) ; uid() seulement pour les ajouts
let counter = 0;
const uid = () => `u${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Génère un identifiant technique à partir du libellé */
export function slugify(label: string): string {
  const s = label
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return /^[a-z]/.test(s) ? s : `q_${s}`.replace(/_$/, "");
}

type Props = {
  formId: string;
  versionNumber: number;
  initial: { title: string; description: string | null; fields: FieldDef[]; rules: RuleDef[]; duplicateFieldKeys: string[] };
};

export function FormBuilder({ formId, versionNumber, initial }: Props) {
  const toast = useToast();
  const router = useRouter();
  const t = useT();
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description ?? "");
  const [fields, setFields] = useState<DraftField[]>(() =>
    initial.fields.map((f, i) => ({ ...f, uid: `f${i}`, keyEdited: true, options: f.options ?? [], validation: f.validation ?? {} })),
  );
  const [rules, setRules] = useState<DraftRule[]>(() => initial.rules.map((r, i) => ({ ...r, uid: `r${i}` })));
  const [dupKeys, setDupKeys] = useState<string[]>(initial.duplicateFieldKeys);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();

  const touch = () => { setDirty(true); setMessage(null); };
  const updateField = (i: number, patch: Partial<DraftField>) => {
    touch();
    setFields((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  };
  const updateValidation = (i: number, patch: Partial<FieldValidation>) => {
    touch();
    setFields((fs) => fs.map((f, j) => {
      if (j !== i) return f;
      const v = { ...f.validation, ...patch };
      for (const k of Object.keys(v) as (keyof FieldValidation)[]) if (v[k] === undefined || v[k] === "" || v[k] === false) delete v[k];
      return { ...f, validation: v };
    }));
  };
  const addField = (type: FieldType = "TEXTE") => {
    touch();
    const n = fields.length + 1;
    setFields((fs) => [...fs, { uid: uid(), key: `question_${n}`, keyEdited: false, label: "", type, required: false, order: fs.length, options: hasOptions(type) ? [{ value: "option_1", label: t("Option {n}", { n: 1 }) }, { value: "option_2", label: t("Option {n}", { n: 2 }) }] : [], validation: {}, helpText: "" }]);
  };
  const move = (i: number, d: -1 | 1) => {
    touch();
    setFields((fs) => {
      const j = i + d;
      if (j < 0 || j >= fs.length) return fs;
      const c = [...fs];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
  };
  const removeField = (i: number) => {
    const f = fields[i];
    if (!window.confirm(t("Supprimer la question « {q} » ?", { q: f.label || f.key }))) return;
    touch();
    setFields((fs) => fs.filter((_, j) => j !== i));
    setDupKeys((k) => k.filter((x) => x !== f.key));
  };

  const payload = () => ({
    title,
    description: description || null,
    duplicateFieldKeys: dupKeys.filter((k) => fields.some((f) => f.key === k)),
    fields: fields.map((f, i) => ({
      key: f.key,
      label: f.label,
      helpText: f.helpText || null,
      type: f.type,
      required: f.required,
      order: i,
      options: hasOptions(f.type) ? f.options : null,
      validation: Object.keys(f.validation).length ? f.validation : null,
    })),
    rules: rules.map((r) => ({ definition: r.definition, message: r.message, severity: r.severity })),
  });

  const save = (then?: "publish") =>
    start(async () => {
      const r = await saveFormDraftAction(formId, payload());
      if (!r?.ok) {
        setErrors(r?.fieldErrors ?? {});
        setMessage({ ok: false, text: t.msg(r?.message ?? "Erreur") });
        toast("danger", t.msg(r?.message ?? "Erreur"));
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setErrors({});
      setDirty(false);
      if (then === "publish") {
        const p = await publishFormAction(formId);
        setMessage({ ok: Boolean(p?.ok), text: t.msg(p?.message ?? "") });
        toast(p?.ok ? "success" : "danger", t.msg(p?.message ?? ""));
        if (p?.ok) router.push(`/formulaires/${formId}`);
        return;
      }
      setMessage({ ok: true, text: t.msg(r.message ?? "Enregistré.") });
      toast("success", t.msg(r.message ?? "Enregistré."));
    });

  const errFor = (prefix: string) => Object.entries(errors).filter(([k]) => k === prefix || k.startsWith(prefix + ".")).flatMap(([, v]) => v).map(t.msg);
  const allErrors = Object.values(errors).flat().map(t.msg);
  const comparable = fields.filter((f) => f.type === "NOMBRE" || f.type === "DATE");

  return (
    <div className="space-y-6">
      {message && (
        <Alert tone={message.ok ? "success" : "danger"} title={message.text}>
          {!message.ok && allErrors.length > 0 && <ul className="list-disc ps-4">{[...new Set(allErrors)].map((m, i) => <li key={i}>{m}</li>)}</ul>}
        </Alert>
      )}

      <Card>
        <CardHeader title={t("Informations générales")} description={t("Version {n} — brouillon", { n: versionNumber })} />
        <div className="grid gap-4 p-5">
          <div>
            <label htmlFor="title" className="mb-1 block text-sm font-medium">{t("Titre")} <span className="text-red-700" aria-hidden>*</span></label>
            <input id="title" value={title} onChange={(e) => { touch(); setTitle(e.target.value); }} className={inputClass} aria-invalid={errFor("title").length > 0} />
            {errFor("title").map((m, i) => <p key={i} className="mt-1 text-sm text-red-700">{m}</p>)}
          </div>
          <div>
            <label htmlFor="description" className="mb-1 block text-sm font-medium">{t("Description")}</label>
            <textarea id="description" rows={2} value={description} onChange={(e) => { touch(); setDescription(e.target.value); }} className={inputClass} />
          </div>
        </div>
      </Card>

      <section aria-labelledby="questions-title" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="questions-title" className="text-lg font-semibold">{t("Questions ({n})", { n: fields.length })}</h2>
        </div>
        {fields.length === 0 && <Card className="p-8 text-center text-sm text-muted">{t("Aucune question. Ajoutez-en une ci-dessous.")}</Card>}
        {fields.map((f, i) => {
          const fe = errFor(`fields.${i}`);
          const id = (s: string) => `${f.uid}-${s}`;
          return (
            <Card key={f.uid} className={cn(fe.length > 0 && "border-red-300")}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
                <p className="text-sm font-semibold">{t("Question {n}", { n: i + 1 })}<span className="ms-2 font-normal text-muted">{t(FIELD_TYPE_LABELS[f.type])}</span></p>
                <div className="flex gap-1">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1.5 text-muted hover:bg-surface disabled:opacity-30" aria-label={t("Monter la question {n}", { n: i + 1 })}><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === fields.length - 1} className="rounded p-1.5 text-muted hover:bg-surface disabled:opacity-30" aria-label={t("Descendre la question {n}", { n: i + 1 })}><ArrowDown className="h-4 w-4" /></button>
                  <button type="button" onClick={() => { touch(); setFields((fs) => [...fs.slice(0, i + 1), { ...f, uid: uid(), key: `${f.key}_copie`.slice(0, 60), label: `${f.label} ${t("(copie)")}` }, ...fs.slice(i + 1)]); }} className="rounded p-1.5 text-muted hover:bg-surface" aria-label={t("Dupliquer la question {n}", { n: i + 1 })}><Copy className="h-4 w-4" /></button>
                  <button type="button" onClick={() => removeField(i)} className="rounded p-1.5 text-red-700 hover:bg-red-50" aria-label={t("Supprimer la question {n}", { n: i + 1 })}><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="grid gap-4 p-4 md:grid-cols-6">
                <div className="md:col-span-4">
                  <label htmlFor={id("label")} className="mb-1 block text-sm font-medium">{t("Libellé de la question")} <span className="text-red-700" aria-hidden>*</span></label>
                  <input id={id("label")} value={f.label} onChange={(e) => updateField(i, { label: e.target.value, ...(f.keyEdited ? {} : { key: slugify(e.target.value) || f.key }) })} className={inputClass} />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor={id("type")} className="mb-1 block text-sm font-medium">{t("Type de champ")}</label>
                  <select id={id("type")} value={f.type} onChange={(e) => {
                    const nt = e.target.value as FieldType;
                    updateField(i, { type: nt, validation: {}, options: hasOptions(nt) ? (f.options.length ? f.options : [{ value: "option_1", label: t("Option {n}", { n: 1 }) }, { value: "option_2", label: t("Option {n}", { n: 2 }) }]) : [] });
                  }} className={inputClass}>
                    {FIELD_TYPES.map((ft) => <option key={ft} value={ft}>{t(FIELD_TYPE_LABELS[ft])}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label htmlFor={id("key")} className="mb-1 block text-sm font-medium">{t("Identifiant technique")}</label>
                  <input id={id("key")} value={f.key} onChange={(e) => updateField(i, { key: e.target.value, keyEdited: true })} className={cn(inputClass, "font-mono text-xs")} />
                  <p className="mt-1 text-xs text-muted">{t("Utilisé dans les exports et les règles.")}</p>
                </div>
                <div className="md:col-span-3">
                  <label htmlFor={id("help")} className="mb-1 block text-sm font-medium">{t("Aide à la saisie")}</label>
                  <input id={id("help")} value={f.helpText ?? ""} onChange={(e) => updateField(i, { helpText: e.target.value })} className={inputClass} />
                </div>
                <div className="flex items-end md:col-span-1">
                  <label className="flex items-center gap-2 pb-2 text-sm font-medium">
                    <input type="checkbox" checked={f.required} onChange={(e) => updateField(i, { required: e.target.checked })} /> {t("Obligatoire")}
                  </label>
                </div>

                {hasOptions(f.type) && (
                  <fieldset className="md:col-span-6">
                    <legend className="mb-2 text-sm font-medium">{t("Options")}</legend>
                    <div className="space-y-2">
                      {f.options.map((o, oi) => (
                        <div key={oi} className="flex gap-2">
                          <input aria-label={t("Libellé de l'option {n}", { n: oi + 1 })} value={o.label} placeholder={t("Libellé affiché")} onChange={(e) => updateField(i, { options: f.options.map((x, k) => (k === oi ? { ...x, label: e.target.value } : x)) })} className={inputClass} />
                          <input aria-label={t("Valeur enregistrée de l'option {n}", { n: oi + 1 })} value={o.value} placeholder={t("valeur")} onChange={(e) => updateField(i, { options: f.options.map((x, k) => (k === oi ? { ...x, value: e.target.value } : x)) })} className={cn(inputClass, "max-w-40 font-mono text-xs")} />
                          <button type="button" onClick={() => updateField(i, { options: f.options.filter((_, k) => k !== oi) })} className="rounded p-2 text-red-700 hover:bg-red-50" aria-label={t("Retirer l'option {n}", { n: oi + 1 })}><Trash2 className="h-4 w-4" /></button>
                        </div>
                      ))}
                      <Button type="button" size="sm" variant="ghost" onClick={() => updateField(i, { options: [...f.options, { value: `option_${f.options.length + 1}`, label: t("Option {n}", { n: f.options.length + 1 }) }] })}><Plus className="h-4 w-4" aria-hidden />{t("Ajouter une option")}</Button>
                    </div>
                  </fieldset>
                )}

                <ValidationEditor f={f} onChange={(p) => updateValidation(i, p)} idp={f.uid} />

                {fe.length > 0 && <div className="space-y-0.5 text-sm text-red-700 md:col-span-6" role="alert">{[...new Set(fe)].map((m, k) => <p key={k}>{m}</p>)}</div>}
              </div>
            </Card>
          );
        })}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => addField("TEXTE")}><Plus className="h-4 w-4" aria-hidden />{t("Ajouter une question")}</Button>
        </div>
      </section>

      <Card>
        <CardHeader title={t("Règles de cohérence entre champs")} description={t("Comparaisons entre deux champs Nombre ou Date, et obligations conditionnelles.")} />
        <div className="space-y-3 p-4">
          {rules.length === 0 && <p className="text-sm text-muted">{t("Aucune règle définie.")}</p>}
          {rules.map((r, ri) => {
            const d = r.definition;
            const re = errFor(`rules.${ri}`);
            const setDef = (def: RuleDefinition) => { touch(); setRules((rs) => rs.map((x, k) => (k === ri ? { ...x, definition: def } : x))); };
            const setR = (p: Partial<DraftRule>) => { touch(); setRules((rs) => rs.map((x, k) => (k === ri ? { ...x, ...p } : x))); };
            const condField = d.kind === "OBLIGATOIRE_SI" ? fields.find((f) => f.key === d.when.field) : undefined;
            const condOptions = condField ? (condField.type === "OUI_NON" ? [{ value: "oui", label: t("Oui") }, { value: "non", label: t("Non") }] : hasOptions(condField.type) ? condField.options : null) : null;
            return (
              <div key={r.uid} className={cn("rounded-md border border-line p-3", re.length && "border-red-300")}>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{t("Règle {n} :", { n: ri + 1 })}</span>
                  {d.kind === "COMPARAISON" ? (
                    <>
                      <select aria-label={t("Premier champ")} value={d.left} onChange={(e) => setDef({ ...d, left: e.target.value })} className={cn(inputClass, "w-auto")}>
                        {comparable.map((f) => <option key={f.key} value={f.key}>{f.label || f.key}</option>)}
                      </select>
                      <select aria-label={t("Opérateur")} value={d.op} onChange={(e) => setDef({ ...d, op: e.target.value as ComparisonOperator })} className={cn(inputClass, "w-auto")}>
                        {COMPARISON_OPERATORS.map((o) => <option key={o} value={o}>{t(OP_LABELS[o])}</option>)}
                      </select>
                      <select aria-label={t("Second champ")} value={d.right} onChange={(e) => setDef({ ...d, right: e.target.value })} className={cn(inputClass, "w-auto")}>
                        {comparable.map((f) => <option key={f.key} value={f.key}>{f.label || f.key}</option>)}
                      </select>
                    </>
                  ) : (
                    <>
                      <select aria-label={t("Champ rendu obligatoire")} value={d.target} onChange={(e) => setDef({ ...d, target: e.target.value })} className={cn(inputClass, "w-auto")}>
                        {fields.map((f) => <option key={f.key} value={f.key}>{f.label || f.key}</option>)}
                      </select>
                      <span>{t("est obligatoire si")}</span>
                      <select aria-label={t("Champ de condition")} value={d.when.field} onChange={(e) => setDef({ ...d, when: { field: e.target.value, equals: "" } })} className={cn(inputClass, "w-auto")}>
                        {fields.map((f) => <option key={f.key} value={f.key}>{f.label || f.key}</option>)}
                      </select>
                      <span>{t("vaut")}</span>
                      {condOptions ? (
                        <select aria-label={t("Valeur de condition")} value={d.when.equals} onChange={(e) => setDef({ ...d, when: { ...d.when, equals: e.target.value } })} className={cn(inputClass, "w-auto")}>
                          <option value="">—</option>
                          {condOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      ) : (
                        <input aria-label={t("Valeur de condition")} value={d.when.equals} onChange={(e) => setDef({ ...d, when: { ...d.when, equals: e.target.value } })} className={cn(inputClass, "w-40")} />
                      )}
                    </>
                  )}
                  <button type="button" onClick={() => { touch(); setRules((rs) => rs.filter((_, k) => k !== ri)); }} className="ms-auto rounded p-1.5 text-red-700 hover:bg-red-50" aria-label={t("Supprimer la règle {n}", { n: ri + 1 })}><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-4">
                  <input aria-label={t("Message affiché à l'agent")} placeholder={t("Message affiché à l'agent")} value={r.message} onChange={(e) => setR({ message: e.target.value })} className={cn(inputClass, "sm:col-span-3")} />
                  <select aria-label={t("Gravité")} value={r.severity} onChange={(e) => setR({ severity: e.target.value as DraftRule["severity"] })} className={inputClass}>
                    <option value="ERREUR">{t("Erreur (bloquante)")}</option>
                    <option value="AVERTISSEMENT">{t("Avertissement")}</option>
                  </select>
                </div>
                {re.length > 0 && <div className="mt-2 text-sm text-red-700" role="alert">{[...new Set(re)].map((m, k) => <p key={k}>{m}</p>)}</div>}
              </div>
            );
          })}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" disabled={comparable.length < 2} onClick={() => { touch(); setRules((rs) => [...rs, { uid: uid(), definition: { kind: "COMPARAISON", left: comparable[0].key, op: "<=", right: comparable[1].key }, message: "", severity: "ERREUR" }]); }}>
              <Plus className="h-4 w-4" aria-hidden />{t("Comparaison entre deux champs")}
            </Button>
            <Button type="button" size="sm" variant="secondary" disabled={fields.length < 2} onClick={() => { touch(); setRules((rs) => [...rs, { uid: uid(), definition: { kind: "OBLIGATOIRE_SI", target: fields[1].key, when: { field: fields[0].key, equals: "" } }, message: "", severity: "ERREUR" }]); }}>
              <Plus className="h-4 w-4" aria-hidden />{t("Obligation conditionnelle")}
            </Button>
          </div>
          {comparable.length < 2 && <p className="text-xs text-muted">{t("Il faut au moins deux champs Nombre ou Date pour créer une comparaison.")}</p>}
        </div>
      </Card>

      <Card>
        <CardHeader title={t("Détection des doublons")} description={t("Deux réponses ayant les mêmes valeurs (casse, accents et espaces ignorés) sur tous les champs cochés sont signalées comme doublons potentiels.")} />
        <div className="flex flex-wrap gap-2 p-4">
          {fields.length === 0 && <p className="text-sm text-muted">{t("Ajoutez des questions pour choisir les critères.")}</p>}
          {fields.map((f) => (
            <label key={f.uid} className="flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-sm">
              <input type="checkbox" checked={dupKeys.includes(f.key)} onChange={(e) => { touch(); setDupKeys((k) => (e.target.checked ? [...k, f.key] : k.filter((x) => x !== f.key))); }} />
              {f.label || f.key}
            </label>
          ))}
          {errFor("duplicateFieldKeys").map((m, i) => <p key={i} className="w-full text-sm text-red-700">{m}</p>)}
        </div>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-t border-line bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <Button type="button" onClick={() => save()} disabled={pending}>{pending ? t("Enregistrement…") : t("Enregistrer le brouillon")}</Button>
        <Button type="button" variant="success" disabled={pending || fields.length === 0} onClick={() => { if (window.confirm(t("Enregistrer puis publier la version {n} ?", { n: versionNumber }))) save("publish"); }}>{t("Enregistrer et publier")}</Button>
        <Link href={`/formulaires/${formId}/apercu`} className={buttonClass("secondary")} onClick={(e) => { if (dirty && !window.confirm(t("Des modifications ne sont pas enregistrées. L'aperçu montre la dernière version enregistrée. Continuer ?"))) e.preventDefault(); }}>
          <Eye className="h-4 w-4" aria-hidden />{t("Aperçu")}
        </Link>
        {dirty && <span className="text-xs text-amber-800">{t("Modifications non enregistrées")}</span>}
      </div>
    </div>
  );
}

function num(v: string): number | undefined {
  if (v.trim() === "") return undefined;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

function ValidationEditor({ f, onChange, idp }: { f: DraftField; onChange: (p: Partial<FieldValidation>) => void; idp: string }) {
  const t = useT();
  const v = f.validation;
  const small = (key: keyof FieldValidation, label: string, type: "number" | "date" = "number") => (
    <div>
      <label htmlFor={`${idp}-${key}`} className="mb-1 block text-xs font-medium text-muted">{t(label)}</label>
      <input
        id={`${idp}-${key}`}
        type={type === "date" ? "date" : "text"}
        inputMode={type === "number" ? "decimal" : undefined}
        defaultValue={v[key] === undefined ? "" : String(v[key])}
        onChange={(e) => onChange({ [key]: type === "date" ? e.target.value || undefined : num(e.target.value) } as Partial<FieldValidation>)}
        className={inputClass}
      />
    </div>
  );
  const check = (key: "integer" | "notInFuture", label: string) => (
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(v[key])} onChange={(e) => onChange({ [key]: e.target.checked } as Partial<FieldValidation>)} />{t(label)}</label>
  );

  if (f.type === "OUI_NON" || f.type === "LISTE" || f.type === "CHOIX_UNIQUE") return null;
  return (
    <fieldset className="rounded-md bg-surface p-3 md:col-span-6">
      <legend className="sr-only">{t("Règles de validation")}</legend>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("Règles de validation")}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {f.type === "TEXTE" && (
          <>
            {small("minLength", "Longueur minimale")}
            {small("maxLength", "Longueur maximale")}
            <div>
              <label htmlFor={`${idp}-format`} className="mb-1 block text-xs font-medium text-muted">{t("Format")}</label>
              <select id={`${idp}-format`} value={v.format ?? ""} onChange={(e) => onChange({ format: (e.target.value || undefined) as FieldValidation["format"] })} className={inputClass}>
                <option value="">{t("Libre")}</option>
                <option value="email">{t("Adresse électronique")}</option>
                <option value="telephone">{t("Téléphone")}</option>
                <option value="alphanumerique">{t("Lettres et chiffres")}</option>
                <option value="code">{t("Code (sans espace)")}</option>
              </select>
            </div>
            <div>
              <label htmlFor={`${idp}-pattern`} className="mb-1 block text-xs font-medium text-muted">Motif (expression régulière)</label>
              <input id={`${idp}-pattern`} defaultValue={v.pattern ?? ""} placeholder="ex. MEN-[0-9]{4}" onChange={(e) => onChange({ pattern: e.target.value || undefined })} className={cn(inputClass, "font-mono text-xs")} />
            </div>
            {v.pattern && (
              <div className="sm:col-span-2">
                <label htmlFor={`${idp}-pm`} className="mb-1 block text-xs font-medium text-muted">Message si le motif n&apos;est pas respecté</label>
                <input id={`${idp}-pm`} defaultValue={v.patternMessage ?? ""} onChange={(e) => onChange({ patternMessage: e.target.value || undefined })} className={inputClass} />
              </div>
            )}
          </>
        )}
        {f.type === "NOMBRE" && (
          <>
            {small("min", "Minimum (bloquant)")}
            {small("max", "Maximum (bloquant)")}
            {small("warnMin", "Seuil bas d'alerte")}
            {small("warnMax", "Seuil haut d'alerte")}
            {check("integer", "Nombre entier uniquement")}
          </>
        )}
        {f.type === "DATE" && (
          <>
            {small("minDate", "Date minimale", "date")}
            {small("maxDate", "Date maximale", "date")}
            <div className="flex items-end pb-2">{check("notInFuture", "Pas de date future")}</div>
          </>
        )}
        {f.type === "CHOIX_MULTIPLE" && (
          <>
            {small("minSelected", "Nombre minimal de choix")}
            {small("maxSelected", "Nombre maximal de choix")}
          </>
        )}
      </div>
    </fieldset>
  );
}
