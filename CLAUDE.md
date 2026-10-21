# CLAUDE.md — Registre Collecte (MVP de démonstration)

Prototype **générique** de modules de collecte de données (formulaires, saisie, contrôle qualité,
tableau de bord, export). Les TDR et le cahier des charges officiels ne sont pas disponibles :
ne jamais présenter l'application comme conforme au marché, certifiée ou conforme à une
réglementation. **Toutes les données sont fictives.**

> Lire aussi `AGENTS.md` : la version de Next.js utilisée (16.4) a des API récentes ;
> la documentation de référence est dans `node_modules/next/dist/docs/`.

## Pile technique (versions figées)

| Élément | Version | Remarque |
|---|---|---|
| Node.js | 22.x | requis par Prisma 7 (≥ 22.12) |
| Next.js (App Router, Turbopack) | 16.4.2 | `cacheComponents` + `partialPrefetching` activés |
| React | 19.3.1 | |
| TypeScript | 5.9.3 | ne pas passer en 7.x (compilateur natif, outillage non garanti) |
| Tailwind CSS | 4.3.x | config CSS-first dans `src/app/globals.css` |
| Prisma / @prisma/client / @prisma/adapter-pg | 7.10.1 | ne pas utiliser le tag `latest` (pointe vers une 8.0 RC) |
| PostgreSQL | 16 | |
| Zod | 4.x | validation des entrées |
| @node-rs/argon2 | 2.2.2 | hachage argon2id |
| Vitest | 5.0.5 | tests unitaires et d'intégration |
| @playwright/test | 1.56.1 | aligné sur le Chromium préinstallé (build 1194) |

Toujours installer avec `npm i -E` (versions exactes).

## Commandes

```bash
npm run dev            # serveur de développement (http://localhost:3000)
npm run build          # build de production
npm run start          # serveur de production
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit
npm run db:generate    # génère le client Prisma (src/generated/prisma)
npm run db:migrate     # prisma migrate dev (développement uniquement)
npm run db:deploy      # prisma migrate deploy
npm run db:seed        # données fictives de démonstration
npm run test           # tests unitaires (Vitest)
npm run test:integration  # tests d'intégration sur la base registre_test
npm run test:e2e       # tests Playwright (build + base registre_e2e)
```

## Architecture

```
src/app/(auth)/        pages publiques (connexion)
src/app/(app)/         pages authentifiées (layout avec menu latéral)
src/app/api/           route handlers (export CSV)
src/server/            CODE SERVEUR UNIQUEMENT (import 'server-only')
  auth/                sessions, mots de passe, matrice de permissions
  services/            logique métier : chaque fonction reçoit l'acteur et vérifie ses droits
  db.ts                instance unique de PrismaClient (adapter pg)
src/lib/               code partagé client/serveur sans secret (validation, CSV, formats)
src/components/        composants UI
prisma/                schéma, migrations, seed
tests/unit|integration|e2e
```

## Règles impératives

1. **Autorisation côté serveur partout.** Chaque Server Action, Route Handler et service appelle
   `requireUser()` puis `assertCan(acteur, permission)` et vérifie le périmètre
   (`FormAssignment`). Masquer un bouton n'est jamais une mesure de sécurité.
2. **Les services reçoivent l'acteur en paramètre** (`actor: SessionUser`) : ils sont testables
   sans contexte Next et ne font jamais confiance à un identifiant d'utilisateur venu du client.
3. **Validation serveur systématique** avec Zod et le moteur `src/lib/validation`. La validation
   navigateur n'est qu'un confort.
4. **Aucun secret côté client.** Ne jamais préfixer une variable par `NEXT_PUBLIC_` si elle est
   sensible. `src/server/**` commence par `import 'server-only'`.
5. **Mots de passe** : argon2id uniquement. **Sessions** : jeton aléatoire en cookie `httpOnly`,
   seul son hachage SHA-256 est stocké.
6. **Erreurs** : messages génériques à l'utilisateur, détails uniquement dans les journaux serveur.
7. **Audit** : toute action sensible appelle `audit()` (connexion, utilisateurs, formulaires,
   changements de statut, exports). Ne jamais journaliser de mot de passe ni de jeton.
8. **CSV** : utiliser `src/lib/csv.ts` (neutralisation des formules `= + - @ \t \r`).
9. **Cache Components** : toute lecture de session (`cookies()`) doit être sous une frontière
   `<Suspense>` (les `loading.tsx` en fournissent une). Ne pas mettre de données de session dans
   `'use cache'`. Les données métier ne sont pas mises en cache (indicateurs toujours à jour).
10. **Next 16** : `params`, `searchParams`, `cookies()`, `headers()` sont asynchrones ;
    le middleware s'appelle `src/proxy.ts` et ne sert qu'à des redirections optimistes.
11. Interface **entièrement en français**. Données de démonstration **fictives**.
12. Ne jamais affirmer qu'un test passe sans l'avoir exécuté. Pas de commande destructive
    (reset de base, suppression de fichiers) sans accord explicite, hors bases de test.

## Conventions

- TypeScript strict ; pas de `any` non justifié.
- Noms de code en anglais, textes d'interface en français.
- Enums Prisma en français (valeurs affichées via `src/lib/labels.ts`).
- Server Actions dans des fichiers `actions.ts` à côté des pages ; elles retournent
  `{ ok: true, ... } | { ok: false, message, fieldErrors? }`.
- Dates stockées en UTC ; champs « date » des formulaires en `@db.Date`.
- Bases : `registre_dev` (développement), `registre_test` (intégration), `registre_e2e` (Playwright).
