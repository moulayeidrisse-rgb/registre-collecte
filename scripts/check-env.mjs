// Vérifie la configuration avant la mise en ligne : messages explicites plutôt qu'erreurs techniques.
// N'affiche jamais le mot de passe.
import { lookup } from "node:dns/promises";

const fail = (msg) => {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
};

const url = process.env.DIRECT_URL || process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!process.env.DATABASE_URL) {
  fail("La variable DATABASE_URL est absente. Vercel : Settings → Environment Variables → ajoutez DATABASE_URL (adresse complète copiée depuis Neon → Connect → Copy snippet), cochez « Production », Save, puis Redeploy.");
}
const raw = url;
if (raw !== raw.trim() || /^["']/.test(raw)) fail("DATABASE_URL contient des espaces ou des guillemets en trop : collez l'adresse seule.");
if (!/^postgres(ql)?:\/\//.test(raw)) fail("DATABASE_URL doit commencer par postgresql:// (copiez l'onglet « Connection string » dans Neon → Connect).");

let u;
try {
  u = new URL(raw);
} catch {
  fail("DATABASE_URL n'est pas une adresse valide : recopiez-la avec le bouton « Copy snippet » de Neon.");
}
const host = u.hostname;
console.log(`Base : utilisateur « ${decodeURIComponent(u.username)} », serveur « ${host} », base « ${u.pathname.slice(1)} »`);
if (!u.password || /^\*+$/.test(decodeURIComponent(u.password))) {
  fail("Le mot de passe est absent ou masqué (****) dans DATABASE_URL. Dans Neon → Connect, utilisez « Copy snippet » (ou « Show password ») pour copier l'adresse avec le vrai mot de passe.");
}
if (/\.\.|\*|…|xxx/i.test(host) || host.startsWith("ep-.")) {
  fail(`L'adresse du serveur « ${host} » est un exemple, pas votre vraie base. Dans Neon → Connect → onglet « Connection string » → « Copy snippet », puis remplacez la valeur de DATABASE_URL dans Vercel.`);
}
try {
  await lookup(host);
} catch {
  fail(`Le serveur « ${host} » est introuvable. Vérifiez que l'adresse a été copiée en entier depuis Neon (Connect → Copy snippet).`);
}
console.log("✓ Configuration de la base détectée et serveur joignable.");
