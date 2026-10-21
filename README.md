# Registre Collecte — MVP de démonstration

Prototype fonctionnel de **modules de collecte de données** : création de formulaires, saisie par des
agents, contrôle qualité automatique, circuit de validation, tableau de bord, rapports et export CSV.

> **Avertissements importants**
> - Prototype **générique**, construit **sans** les termes de référence ni le cahier des charges
>   officiels (non disponibles à ce stade). Il **n'est pas présenté comme conforme** au marché.
> - Aucune certification, homologation ou conformité réglementaire (RGPD, RGS, RGAA, etc.) n'est
>   revendiquée : cela exigerait un audit et une vérification documentés.
> - **Toutes les données de démonstration sont fictives** (noms, codes, adresses, valeurs).

---

## Sommaire

1. [Fonctionnalités](#1-fonctionnalités)
2. [Pile technique et versions](#2-pile-technique-et-versions)
3. [Installation](#3-installation)
4. [Configuration (variables d'environnement)](#4-configuration)
5. [Lancement](#5-lancement)
6. [Comptes de démonstration](#6-comptes-de-démonstration)
7. [Tests](#7-tests)
8. [Architecture](#8-architecture)
9. [Modèle de données](#9-modèle-de-données)
10. [Sécurité](#10-sécurité)
11. [Sauvegarde et restauration](#11-sauvegarde-et-restauration)
12. [Limites connues](#12-limites-connues)

Le scénario de démonstration pas à pas est dans [`docs/SCENARIO_DEMO.md`](docs/SCENARIO_DEMO.md).

---

## 1. Fonctionnalités

| Module | Contenu |
|---|---|
| **Tableau de bord** | Formulaires (par statut), réponses enregistrées, validées, en attente, à corriger, rejetées, brouillons ; taux de complétude moyen ; évolution quotidienne sur 30 jours ; répartition par formulaire ; alertes qualité par type. **Tous les chiffres sont calculés en direct depuis PostgreSQL**, dans le périmètre de l'utilisateur. |
| **Formulaires** | Création, constructeur visuel (7 types : texte, nombre, date, liste déroulante, choix unique, choix multiple, oui/non), champs obligatoires, règles de validation par champ, règles de cohérence entre champs, critères de doublon, aperçu avec test des règles, publication, désactivation/réactivation, **versionnement** (une version publiée est figée), affectation des agents et superviseurs. |
| **Collecte** | Formulaires disponibles, saisie, brouillon, soumission, correction selon le statut et les droits, suivi du statut. Validation immédiate dans le navigateur **et** systématique côté serveur. |
| **Qualité** | Détection : champs obligatoires manquants, valeurs hors plage (bloquantes) ou inhabituelles (avertissements), formats invalides, doublons potentiels (critères configurables, casse/accents/espaces ignorés), incohérences entre champs. Messages explicites en français. Relance du contrôle sur un formulaire. |
| **Utilisateurs** | 3 rôles (Administrateur, Superviseur, Agent de collecte), création, modification, désactivation (fermeture immédiate des sessions), réinitialisation du mot de passe, affectations. |
| **Consultation et export** | Recherche plein texte (référence, agent, valeurs), filtres par formulaire, statut, période et anomalies ; détail avec historique ; validation / rejet / renvoi pour correction ; export CSV filtré et restreint aux droits ; rapports par formulaire (statistiques par question, imprimables). |
| **Journal d'audit** | Connexions (réussies, échouées, bloquées), déconnexions, gestion des utilisateurs et formulaires, changements de statut, exports, accès refusés. |

### Identité visuelle

Couleurs inspirées du drapeau mauritanien : vert (`#006f3c` à `#00a95c`) pour la navigation et les
actions, or (`#ffc400`) pour les repères (icône, page active), rouge (`#d01c1f`) en bandeaux.
Les contrastes de texte respectent le ratio WCAG AA (≥ 4,5:1). La palette des graphiques
(vert, or, bleu, rouge) a été vérifiée pour la lisibilité par les personnes daltoniennes ;
chaque graphique est doublé d'un tableau de données. Jetons définis dans `src/app/globals.css`.

## 2. Pile technique et versions

Versions **figées** (`npm i -E`) et vérifiées au démarrage du projet :

| Élément | Version | Remarque |
|---|---|---|
| Node.js | 22.x (≥ 22.12) | requis par Prisma 7 |
| Next.js (App Router, Turbopack) | 16.4.2 | `cacheComponents` et `partialPrefetching` activés |
| React | 19.3.1 | |
| TypeScript | 5.9.3 | la 7.x (nouveau compilateur natif) a été écartée : outillage non garanti |
| Tailwind CSS | 4.3.3 | |
| PostgreSQL | 16 | |
| Prisma ORM | 7.10.1 | le tag npm `latest` de `prisma` pointait vers une **8.0 RC** : version figée en 7.10.1 |
| Zod | 4.6.7 | validation des entrées |
| @node-rs/argon2 | 2.2.2 | hachage argon2id |
| Recharts | 3.10.1 | graphiques |
| Vitest | 5.0.5 | tests unitaires et d'intégration |
| @playwright/test | 1.56.1 | aligné sur le Chromium préinstallé de l'environnement de développement |

## 3. Installation

Prérequis : Node.js 22.12+ et npm, PostgreSQL 16 (local ou via Docker).

```bash
# 1. Dépendances (génère aussi le client Prisma via postinstall)
npm ci

# 2. Base de données — au choix :
#    a) Docker (fourni)
docker compose up -d
#    b) PostgreSQL déjà installé : créer un rôle et les bases
sudo -u postgres psql -c "CREATE ROLE registre WITH LOGIN PASSWORD 'choisir-un-mot-de-passe' CREATEDB;"
sudo -u postgres createdb -O registre registre_dev
sudo -u postgres createdb -O registre registre_test   # tests d'intégration
sudo -u postgres createdb -O registre registre_e2e    # tests de parcours

# 3. Configuration
cp .env.example .env          # puis adapter DATABASE_URL
# créer aussi .env.test et .env.e2e (même format, bases registre_test / registre_e2e)

# 4. Schéma et données fictives
npm run db:deploy             # applique les migrations
npm run db:seed               # données de démonstration fictives
```

> Le seed **refuse de s'exécuter** si la base contient déjà des utilisateurs. Pour repartir de zéro
> (**opération destructive** : vide toutes les tables) : `SEED_RESET=1 npm run db:seed`.

## 4. Configuration

Toutes les variables sont lues **côté serveur uniquement** (aucune n'est préfixée `NEXT_PUBLIC_`).
Les fichiers `.env*` sont exclus de git, sauf `.env.example`.

| Variable | Obligatoire | Description |
|---|---|---|
| `DATABASE_URL` | oui | Chaîne de connexion PostgreSQL |
| `SESSION_TTL_HOURS` | non (8) | Durée de validité d'une session |
| `COOKIE_SECURE` | non | Cookie `Secure` : automatique en production. `false` uniquement pour tester `npm run start` en HTTP local |
| `SEED_PASSWORD` | non | Mot de passe attribué aux comptes fictifs du seed (`Demo-Registre-2026` par défaut) |

## 5. Lancement

```bash
npm run dev      # développement : http://localhost:3000
npm run build && npm run start   # production locale
```

En production derrière HTTPS, le cookie de session est `Secure`. Pour un test de `npm run start`
en HTTP simple sur une autre machine que `localhost`, définir `COOKIE_SECURE=false`.

## 6. Comptes de démonstration

Mot de passe commun : `Demo-Registre-2026` (domaine réservé `.test`, aucune adresse réelle).

| Compte | Rôle | Périmètre |
|---|---|---|
| `admin@demo.registre.test` | Administrateur | tout |
| `superviseur.nord@demo.registre.test` | Superviseur | Enquête ménages (ENQ-MEN-01) |
| `superviseur.sud@demo.registre.test` | Superviseur | Contrôle des adresses (CTRL-ADR-01) |
| `agent1@`, `agent2@`, `agent3@demo.registre.test` | Agents | ENQ-MEN-01 (agent3 aussi CTRL-ADR-01) |
| `agent4@demo.registre.test` | Agent | CTRL-ADR-01 |
| `agent.inactif@demo.registre.test` | Agent désactivé | ne peut pas se connecter |

Le seed crée 4 formulaires (2 publiés, 1 brouillon, 1 désactivé) et environ 125 réponses réparties
sur 40 jours, **créées via les services métier** (mêmes validations que l'application), dont des
brouillons, des réponses à corriger, rejetées, des doublons potentiels et des valeurs inhabituelles.

## 7. Tests

```bash
npm run lint              # ESLint
npm run typecheck         # TypeScript strict
npm run test              # unitaires (Vitest) — sans base de données
npm run test:integration  # intégration sur registre_test (.env.test) — vide les tables de CETTE base
npm run test:e2e          # Playwright : build de production + base registre_e2e réinitialisée
```

**Résultats de la dernière exécution** (21/10/2026, environnement Linux, Node 22.22, PostgreSQL 16.15) —
voir la section « Résultats des tests » en bas de ce fichier.

| Suite | Contenu |
|---|---|
| Unitaires (59) | moteur de validation (7 types, bornes, formats, règles inter-champs, complétude, doublons), schéma du constructeur, CSV (injection de formules, échappement), matrice des permissions et périmètres, garde-fou : chaque Server Action vérifie la session |
| Intégration (24) | sur PostgreSQL réel : hachage argon2id, sessions (hachage du jeton, expiration, désactivation), limitation des tentatives, cloisonnement agent / superviseur, validations serveur, persistance typée des valeurs, doublons, circuit de validation et audit, versionnement, indicateurs, export restreint, rapports, protection du dernier administrateur |
| E2E (17) | redirections d'authentification, cookie `httpOnly`, jeton forgé refusé, redirection ouverte bloquée, accès refusés par URL directe, export interdit (401/403), parcours complet admin → agent → superviseur → indicateurs → export CSV, brouillon, navigation mobile sans débordement |

Notes : Playwright utilise le Chromium déjà installé (`PLAYWRIGHT_BROWSERS_PATH`) ; sur une autre
machine, exécuter une fois `npx playwright install chromium`. Les tests d'intégration et E2E
contiennent un garde-fou qui refuse de s'exécuter sur une base dont le nom ne correspond pas.

## 8. Architecture

```
src/
  proxy.ts                  redirection « optimiste » sans cookie (pas un contrôle d'accès)
  app/(auth)/connexion/     page publique de connexion
  app/(app)/                pages authentifiées (menu latéral + barre supérieure)
    tableau-de-bord/ formulaires/ collecte/ reponses/ qualite/ rapports/ utilisateurs/ journal/ mon-compte/
    */actions.ts            Server Actions : requireActor(permission) puis appel du service
  app/api/export/route.ts   export CSV (contrôle session + permission + périmètre)
  server/                   code serveur uniquement (import "server-only")
    auth/                   mots de passe, jetons, sessions, matrice de permissions
    services/               logique métier ; chaque fonction reçoit l'acteur et vérifie ses droits
    db.ts                   PrismaClient unique (adapter pg)
  lib/                      code partagé sans secret : moteur de validation, CSV, libellés, formats
  components/               UI (Tailwind), graphiques, formulaire de saisie, constructeur
prisma/                     schéma, migrations (dont contraintes CHECK et index partiels), seed
tests/unit | integration | e2e
```

Principes :
- **Autorisation au plus près des données** : les services vérifient la permission
  (`assertCan`) et appliquent le périmètre (`formScope`, `submissionScope`) dans les requêtes SQL.
  Les pages et actions revérifient la session ; le menu n'est qu'un confort d'affichage.
- **Une seule source de vérité pour la validation** (`src/lib/validation/engine.ts`) : exécutée
  dans le navigateur pour le retour immédiat, et **refaite côté serveur** avant tout enregistrement.
- **Versionnement** : une réponse est rattachée à la version du formulaire sur laquelle elle a été
  saisie ; modifier un formulaire publié crée une nouvelle version.
- **Cache Components (Next 16)** : la session n'est lue que sous des frontières `<Suspense>`
  (`loading.tsx` par route, îlots du menu) ; aucune donnée métier n'est mise en cache, les
  indicateurs sont donc toujours à jour.

## 9. Modèle de données

`User`, `Session`, `LoginAttempt` · `Form`, `FormVersion`, `FormField`, `FormRule`,
`FormAssignment` · `Submission`, `SubmissionValue` (colonnes typées : texte, nombre décimal, date,
booléen, JSON pour le choix multiple) · `QualityIssue` · `AuditLog`.

Intégrité : clés étrangères avec règles de suppression explicites (`Restrict` sur les réponses
existantes), unicités (email, code de formulaire, version, clé de champ par version, valeur par
champ et réponse), contraintes `CHECK` (complétude 0–100, format des clés, email en minuscules,
date de soumission obligatoire hors brouillon), **index partiels** garantissant au plus une version
brouillon et une version publiée par formulaire, index sur les colonnes filtrées.

Les rôles sont un `enum` ; les **permissions** sont une matrice déclarée dans
`src/server/auth/permissions.ts` (testée unitairement), et le périmètre par `FormAssignment`.

## 10. Sécurité

Mesures en place :
- Mots de passe **argon2id** (paramètres OWASP), politique minimale (10 caractères, lettre + chiffre),
  changement obligatoire après création ou réinitialisation par un administrateur.
- Sessions en base : jeton aléatoire de 256 bits dans un cookie `httpOnly`, `SameSite=Lax`,
  `Secure` en production ; **seul le hachage SHA-256** est stocké ; expiration (8 h) ;
  révocation à la déconnexion, à la désactivation, au changement de rôle ou de mot de passe.
- Limitation des tentatives de connexion (5 échecs par compte / 30 par IP sur 15 min), message
  d'erreur générique, temps de réponse homogène pour un compte inexistant.
- Contrôle d'accès côté serveur sur toutes les pages, Server Actions et route d'export ; une
  ressource hors périmètre répond « introuvable » (pas de divulgation d'existence).
- Validation de toutes les entrées (Zod + moteur de validation), clés inconnues ignorées.
- Protection CSRF native des Server Actions (vérification d'origine par Next.js), redirection après
  connexion limitée aux chemins internes.
- Export CSV : neutralisation des injections de formules, en-têtes `no-store` et `nosniff`.
- En-têtes de sécurité : CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`,
  `Permissions-Policy`, `Cross-Origin-Opener-Policy`.
- Erreurs : messages génériques côté utilisateur, détails uniquement dans les journaux serveur.
- Journal d'audit des actions sensibles, sans mot de passe ni jeton (filtrage automatique des clés).

## 11. Sauvegarde et restauration

```bash
# Sauvegarde (format personnalisé compressé)
mkdir -p backups
pg_dump --format=custom --no-owner --dbname="$DATABASE_URL" --file="backups/registre_$(date +%Y%m%d_%H%M).dump"

# Vérifier le contenu d'une sauvegarde
pg_restore --list backups/registre_AAAAMMJJ_HHMM.dump | head

# Restauration dans une base VIDE (créée au préalable) — ne pas restaurer par-dessus une base en service
createdb -O registre registre_restauree
pg_restore --no-owner --dbname="postgresql://registre:...@localhost:5432/registre_restauree" backups/registre_AAAAMMJJ_HHMM.dump
```

Avec Docker : `docker compose exec db pg_dump -U registre -Fc registre_dev > backups/registre.dump`.

Recommandations hors MVP : sauvegardes automatisées et chiffrées, conservées hors du serveur,
**tests de restauration réguliers**, archivage des journaux WAL si une perte de données de moins
de 24 h n'est pas acceptable.

## 12. Limites connues

- **Périmètre fonctionnel générique**, à réaligner sur les TDR lorsqu'ils seront disponibles.
- Pas de saisie **hors ligne** ni d'application mobile native (interface web responsive seulement).
- Pas de logique d'affichage conditionnel des questions (les obligations conditionnelles sont
  contrôlées, mais les questions restent toutes visibles) ; pas de sections ni de questions répétées.
- Détection des doublons par **égalité normalisée** des champs choisis (pas de correspondance
  approximative) ; les anomalies sont recalculées à chaque enregistrement, la relance globale est manuelle.
- Rôles fixes (3) ; périmètre par affectation de formulaire uniquement (pas de découpage géographique).
- Pas de réinitialisation de mot de passe par courriel, pas d'authentification à deux facteurs.
- La limitation des tentatives est stockée en base (adaptée à une instance unique) ; l'adresse IP
  provient de `X-Forwarded-For`, fiable uniquement derrière un proxy inverse de confiance.
  La table `LoginAttempt` n'est pas purgée automatiquement.
- CSP avec `'unsafe-inline'` pour les scripts (pas de nonce) : à durcir avant toute mise en production.
- Export CSV limité à 50 000 lignes par fichier ; rapports calculés en mémoire (volumétrie de
  démonstration). Au-delà de quelques centaines de milliers de réponses, prévoir des agrégations SQL.
- Les dates de la série « Évolution des collectes » sont regroupées par jour UTC.
- Non audité en accessibilité (RGAA) ni en sécurité (test d'intrusion) : à prévoir avant tout usage réel.
- Les validations de « navigation instantanée » de Next.js 16 (mode développement) ont été traitées
  par des frontières `<Suspense>` ; elles ne s'appliquent pas au build.

---

## Résultats des tests

Exécution du 21/10/2026 (voir section 7 pour les commandes) :

| Commande | Résultat |
|---|---|
| `npm run lint` | 0 erreur, 0 avertissement |
| `npm run typecheck` | aucune erreur |
| `npm run test` | 5 fichiers, **59 tests réussis** |
| `npm run test:integration` | 3 fichiers, **24 tests réussis** (PostgreSQL 16, base `registre_test`) |
| `npm run test:e2e` | **17 tests réussis** (16 ordinateur + 1 mobile, build de production, base `registre_e2e`) |
| `npm run build` | réussi (26 routes ; pages en rendu partiel, export dynamique) |
