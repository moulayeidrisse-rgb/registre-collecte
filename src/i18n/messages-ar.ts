/**
 * Traduction arabe des messages dynamiques produits en français par le moteur de validation,
 * le contrôle qualité et les services (y compris ceux déjà enregistrés en base).
 * Chaque motif reconnaît un message français et reconstruit la phrase arabe avec les mêmes valeurs.
 * Un message inconnu (ex. message de règle saisi par un administrateur) est affiché tel quel.
 */

const L = "« (.+?) »"; // libellé de champ entre guillemets

const FORMAT_AR: Record<string, string> = {
  "doit être une adresse électronique valide (ex. nom@exemple.org)": "يجب أن يكون عنوان بريد إلكتروني صالحًا (مثال: nom@exemple.org)",
  "doit être un numéro de téléphone valide (chiffres, espaces, +, -, parenthèses)": "يجب أن يكون رقم هاتف صالحًا (أرقام، مسافات، +، -، أقواس)",
  "ne doit contenir que des lettres, des chiffres et des espaces": "يجب ألا يحتوي إلا على حروف وأرقام ومسافات",
  "ne doit contenir que des lettres, chiffres, tirets ou soulignés, sans espace": "يجب ألا يحتوي إلا على حروف أو أرقام أو شرطات، بدون مسافات",
};

const q = (s: string) => `« ${s} »`;
const plural = (n: string, one: string, many: string) => (Number(n) > 1 ? many : one);

const PATTERNS: [RegExp, (...g: string[]) => string][] = [
  // ── Moteur de validation ──
  [new RegExp(`^Le champ ${L} est obligatoire\\.$`), (l) => `الحقل ${q(l)} إلزامي.`],
  [new RegExp(`^Le champ ${L} doit être un texte\\.$`), (l) => `يجب أن يكون الحقل ${q(l)} نصًا.`],
  [new RegExp(`^Le champ ${L} dépasse (\\d+) caractères\\.$`), (l, n) => `يتجاوز الحقل ${q(l)} ${n} حرفًا.`],
  [new RegExp(`^Le champ ${L} doit contenir au moins (\\d+) caractères \\(actuellement (\\d+)\\)\\.$`), (l, n, c) => `يجب أن يحتوي الحقل ${q(l)} على ${n} أحرف على الأقل (حاليًا ${c}).`],
  [new RegExp(`^Le champ ${L} doit contenir au plus (\\d+) caractères \\(actuellement (\\d+)\\)\\.$`), (l, n, c) => `يجب ألا يتجاوز الحقل ${q(l)} ${n} حرفًا (حاليًا ${c}).`],
  [new RegExp(`^Le champ ${L} n'a pas le format attendu\\.$`), (l) => `الحقل ${q(l)} لا يطابق الصيغة المطلوبة.`],
  [new RegExp(`^Le champ ${L} doit être un nombre \\(ex\\. 12 ou 12,5\\)\\.$`), (l) => `يجب أن يكون الحقل ${q(l)} رقمًا (مثال: 12 أو 12,5).`],
  [new RegExp(`^Le champ ${L} doit être un nombre entier\\.$`), (l) => `يجب أن يكون الحقل ${q(l)} عددًا صحيحًا.`],
  [new RegExp(`^Le champ ${L} doit être supérieur ou égal à (.+?) \\(valeur saisie : (.+?)\\)\\.$`), (l, a, b) => `يجب أن تكون قيمة الحقل ${q(l)} أكبر من أو تساوي ${a} (القيمة المُدخلة: ${b}).`],
  [new RegExp(`^Le champ ${L} doit être inférieur ou égal à (.+?) \\(valeur saisie : (.+?)\\)\\.$`), (l, a, b) => `يجب أن تكون قيمة الحقل ${q(l)} أصغر من أو تساوي ${a} (القيمة المُدخلة: ${b}).`],
  [new RegExp(`^Valeur inhabituelle pour ${L} : (.+?) \\(en dessous de (.+?)\\)\\. Vérifiez la saisie\\.$`), (l, v, a) => `قيمة غير معتادة للحقل ${q(l)}: ${v} (أقل من ${a}). يرجى التحقق من الإدخال.`],
  [new RegExp(`^Valeur inhabituelle pour ${L} : (.+?) \\(au-dessus de (.+?)\\)\\. Vérifiez la saisie\\.$`), (l, v, a) => `قيمة غير معتادة للحقل ${q(l)}: ${v} (أكبر من ${a}). يرجى التحقق من الإدخال.`],
  [new RegExp(`^Le champ ${L} doit être une date valide \\(JJ/MM/AAAA\\)\\.$`), (l) => `يجب أن يكون الحقل ${q(l)} تاريخًا صالحًا (يوم/شهر/سنة).`],
  [new RegExp(`^Le champ ${L} doit être postérieur ou égal au (.+?)\\.$`), (l, d) => `يجب أن يكون الحقل ${q(l)} في ${d} أو بعده.`],
  [new RegExp(`^Le champ ${L} doit être antérieur ou égal au (.+?)\\.$`), (l, d) => `يجب أن يكون الحقل ${q(l)} في ${d} أو قبله.`],
  [new RegExp(`^Le champ ${L} ne peut pas être une date future\\.$`), (l) => `لا يمكن أن يكون الحقل ${q(l)} تاريخًا مستقبليًا.`],
  [new RegExp(`^Le champ ${L} attend une seule valeur\\.$`), (l) => `الحقل ${q(l)} يقبل قيمة واحدة فقط.`],
  [new RegExp(`^La valeur choisie pour ${L} n'est pas autorisée\\.$`), (l) => `القيمة المختارة للحقل ${q(l)} غير مسموح بها.`],
  [new RegExp(`^Le champ ${L} attend une liste de valeurs\\.$`), (l) => `الحقل ${q(l)} يتطلب قائمة من القيم.`],
  [new RegExp(`^Une des valeurs choisies pour ${L} n'est pas autorisée\\.$`), (l) => `إحدى القيم المختارة للحقل ${q(l)} غير مسموح بها.`],
  [new RegExp(`^Sélectionnez au moins (\\d+) choix pour ${L}\\.$`), (n, l) => `اختر ${n} خيارات على الأقل للحقل ${q(l)}.`],
  [new RegExp(`^Sélectionnez au plus (\\d+) choix pour ${L}\\.$`), (n, l) => `اختر ${n} خيارات على الأكثر للحقل ${q(l)}.`],
  [new RegExp(`^Le champ ${L} attend « Oui » ou « Non »\\.$`), (l) => `الحقل ${q(l)} يتطلب « نعم » أو « لا ».`],
  [new RegExp(`^Le champ ${L} (doit être .+|ne doit contenir .+)\\.$`), (l, f) => (FORMAT_AR[f] ? `الحقل ${q(l)} ${FORMAT_AR[f]}.` : `الحقل ${q(l)}: ${f}.`)],
  // ── Contrôle qualité ──
  [/^Doublon potentiel : mêmes valeurs que la réponse (\S+) sur les critères de dédoublonnage\.$/, (r) => `تكرار محتمل: نفس القيم الموجودة في الرد ${r} حسب معايير كشف التكرار.`],
  // ── Services ──
  [/^La réponse ne peut pas être soumise : (\d+) erreurs? à corriger\.$/, (n) => `لا يمكن إرسال الرد: ${n} ${plural(n, "خطأ يجب تصحيحه", "أخطاء يجب تصحيحها")}.`],
  [/^Trop de tentatives de connexion\. Réessayez dans (\d+) minutes\.$/, (n) => `محاولات تسجيل دخول كثيرة جدًا. حاول مرة أخرى بعد ${n} دقيقة.`],
  // ── Confirmations des actions ──
  [/^Réponse (\S+) soumise avec (\d+) point\(s\) à vérifier\.$/, (r, n) => `تم إرسال الرد ${r} مع ${n} نقطة للتحقق.`],
  [/^Réponse (\S+) soumise\.$/, (r) => `تم إرسال الرد ${r}.`],
  [/^Brouillon (\S+) enregistré\.$/, (r) => `تم حفظ المسودة ${r}.`],
  [/^Version (\d+) publiée : le formulaire est disponible pour la collecte\.$/, (n) => `تم نشر النسخة ${n}: الاستمارة متاحة للجمع.`],
  [/^Contrôle qualité relancé sur (\d+) réponse\(s\)\.$/, (n) => `أُعيد تشغيل مراقبة الجودة على ${n} رد.`],
  // ── Définition de formulaire ──
  [new RegExp(`^${L} : au moins 2 options sont nécessaires$`), (l) => `${q(l)}: يلزم خياران على الأقل`],
  [new RegExp(`^${L} : valeurs d'options en double$`), (l) => `${q(l)}: قيم خيارات مكررة`],
  [new RegExp(`^${L} : le minimum est supérieur au maximum$`), (l) => `${q(l)}: الحد الأدنى أكبر من الحد الأقصى`],
  [new RegExp(`^${L} : plage de vraisemblance incohérente$`), (l) => `${q(l)}: نطاق التنبيه غير متسق`],
  [new RegExp(`^${L} : longueur minimale supérieure à la longueur maximale$`), (l) => `${q(l)}: الطول الأدنى أكبر من الطول الأقصى`],
  [new RegExp(`^${L} : date minimale postérieure à la date maximale$`), (l) => `${q(l)}: التاريخ الأدنى بعد التاريخ الأقصى`],
  [new RegExp(`^${L} : nombre de choix minimal supérieur au maximal$`), (l) => `${q(l)}: الحد الأدنى للخيارات أكبر من الحد الأقصى`],
  [new RegExp(`^${L} : expression régulière invalide$`), (l) => `${q(l)}: تعبير نمطي غير صالح`],
  [/^Identifiant « (.+?) » utilisé plusieurs fois$/, (k) => `المعرّف « ${k} » مستعمل أكثر من مرة`],
  [/^Règle (\d+) : champ inconnu$/, (n) => `القاعدة ${n}: حقل غير معروف`],
  [/^Règle (\d+) : seuls deux champs Nombre ou deux champs Date peuvent être comparés$/, (n) => `القاعدة ${n}: لا يمكن مقارنة إلا حقلين رقميين أو حقلي تاريخ`],
  [/^Règle (\d+) : un champ ne peut pas être comparé à lui-même$/, (n) => `القاعدة ${n}: لا يمكن مقارنة الحقل بنفسه`],
  [/^Règle (\d+) : la condition doit porter sur un autre champ$/, (n) => `القاعدة ${n}: يجب أن يتعلق الشرط بحقل آخر`],
  [/^Critère de doublon : champ « (.+?) » inconnu$/, (k) => `معيار التكرار: الحقل « ${k} » غير معروف`],
  // ── Message de motif saisi par l'administrateur : on traduit seulement l'étiquette ──
  [new RegExp(`^${L} : (.+)$`), (l, m) => `${q(l)}: ${m}`],
];

export function translateDynamicAr(message: string): string | null {
  for (const [re, fn] of PATTERNS) {
    const m = message.match(re);
    if (m) return fn(...m.slice(1));
  }
  return null;
}
