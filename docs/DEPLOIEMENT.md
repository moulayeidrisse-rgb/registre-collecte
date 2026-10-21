# Mettre l'application en ligne (gratuit, sans rien installer)

Durée : environ 15 minutes, uniquement dans le navigateur (Windows, Mac ou Linux).

- **Neon** héberge la base de données PostgreSQL (offre gratuite).
- **Vercel** héberge l'application et vous donne un lien du type `https://registre-collecte-xxxx.vercel.app`
  (offre gratuite « Hobby », réservée à un usage non commercial).

Au **premier déploiement**, les tables sont créées et les données **fictives** de démonstration sont
chargées automatiquement. Les déploiements suivants conservent les données.

> **À savoir avant de commencer**
> - Toute personne qui a le lien peut voir la page de connexion. Pour qu'elle ne puisse pas entrer
>   avec les comptes de démonstration, choisissez votre propre mot de passe à l'étape B.4 (`SEED_PASSWORD`).
> - Ne saisissez jamais de données réelles ou personnelles dans cette démonstration.

---

## A. Créer la base de données (Neon)

1. Ouvrez **https://neon.tech** → **Sign up** → **Continue with GitHub**.
2. Créez un projet :
   - *Project name* : `registre-collecte`
   - *Region* : **AWS Europe Central (Frankfurt)** (la plus proche)
   - laissez la version de PostgreSQL proposée → **Create project**.
3. Sur le tableau de bord du projet, cliquez sur **Connect**.
4. **Désactivez** l'option **Connection pooling** (connexion directe, la plus fiable pour créer
   les tables), puis **copiez la chaîne de connexion**. Elle ressemble à :
   `postgresql://neondb_owner:xxxxxxxx@ep-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`
   (sans `-pooler` dans l'adresse).
5. Gardez-la de côté (Bloc-notes). **C'est un secret** : ne la partagez pas publiquement.

## B. Mettre l'application en ligne (Vercel)

1. Ouvrez **https://vercel.com** → **Sign Up** → **Hobby** → **Continue with GitHub**.
2. Cliquez sur **Add New… → Project**.
3. Dans la liste, trouvez **registre-collecte** → **Import**.
   - S'il n'apparaît pas (dépôt privé) : cliquez sur **Adjust GitHub App Permissions**, autorisez
     le dépôt `registre-collecte`, puis revenez.
4. Ouvrez **Environment Variables** et ajoutez :

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | la chaîne copiée à l'étape A.4 |
   | `SEED_PASSWORD` | un mot de passe de votre choix (10 caractères minimum, lettres et chiffres) |
   | `SESSION_TTL_HOURS` | `8` |

   Le reste est détecté automatiquement (Next.js). Ne changez pas les commandes de build.
5. Cliquez sur **Deploy** et attendez 2 à 4 minutes.
   Dans le journal, vous devez voir `Seed terminé : 8 utilisateurs, 4 formulaires…`.
6. Cliquez sur **Continue to Dashboard → Visit** : l'application s'ouvre.

## C. Se connecter

Mot de passe : celui que vous avez choisi pour `SEED_PASSWORD`.

| Compte | Rôle |
|---|---|
| `admin@demo.registre.test` | Administrateur (tout) |
| `superviseur.nord@demo.registre.test` | Superviseur (enquête ménages) |
| `superviseur.sud@demo.registre.test` | Superviseur (contrôle des adresses) |
| `agent1@demo.registre.test` … `agent4@demo.registre.test` | Agents de collecte |

Pour un parcours guidé, suivez `docs/SCENARIO_DEMO.md`. Le bouton **Français / العربية** change la langue.

## Questions fréquentes

**Le déploiement échoue à l'étape `prisma migrate deploy`.**
La variable `DATABASE_URL` est absente ou erronée. Corrigez-la dans *Settings → Environment Variables*,
puis *Deployments → … → Redeploy*.

**Utilisation avancée : connexion avec pooling.**
Mettez la chaîne *avec* pooling dans `DATABASE_URL` et la chaîne *directe* dans une variable
`DIRECT_URL` : l'application utilise la première, les migrations la seconde.

**Je veux repartir de données de démonstration neuves.**
Dans Neon, supprimez le projet et recréez-en un (étape A), mettez à jour `DATABASE_URL` dans Vercel,
puis redéployez.

**Chaque modification envoyée sur GitHub est-elle mise en ligne ?**
Oui : Vercel redéploie automatiquement la branche `main`. Les données sont conservées.

**Comment tout supprimer ?**
Vercel : *Settings → Advanced → Delete Project*. Neon : *Settings → Delete project*.

## Limites de cette mise en ligne

- Offres gratuites : la base Neon se met en veille après inactivité ; la première page peut alors
  mettre quelques secondes à s'afficher.
- Démonstration uniquement : pas de sauvegarde automatique configurée, pas de nom de domaine personnalisé,
  aucun audit de sécurité. Ne pas utiliser pour des données réelles.
