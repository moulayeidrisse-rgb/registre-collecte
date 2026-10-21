// Vérifie la configuration avant la mise en ligne (message explicite plutôt qu'une erreur technique)
const url = process.env.DIRECT_URL || process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (url && !process.env.DATABASE_URL) {
  console.error("\n✖ DATABASE_URL est absente (seule une connexion directe est définie). Ajoutez DATABASE_URL.\n");
  process.exit(1);
}
if (!url) {
  console.error("\n✖ La variable d'environnement DATABASE_URL est absente.");
  console.error("  Vercel : Settings → Environment Variables → ajoutez DATABASE_URL (chaîne de connexion Neon),");
  console.error("  cochez l'environnement « Production », enregistrez, puis Deployments → … → Redeploy.\n");
  process.exit(1);
}
if (!/^postgres(ql)?:\/\//.test(url.trim())) {
  console.error("\n✖ DATABASE_URL doit commencer par postgresql:// (copiez la chaîne complète depuis Neon → Connect).\n");
  process.exit(1);
}
if (url !== url.trim() || /^["']/.test(url)) {
  console.error("\n✖ DATABASE_URL contient des espaces ou des guillemets en trop : collez la chaîne seule.\n");
  process.exit(1);
}
console.log("✓ Configuration de la base détectée.");
