# Lancer l'application sur Windows (sans ligne de commande)

Durée : 15 à 20 minutes la première fois, puis un double-clic.

## 1. Installer Node.js (une seule fois)

1. Ouvrez https://nodejs.org et téléchargez la version **22 LTS** (bouton « Windows Installer »).
2. Lancez le fichier téléchargé et cliquez sur **Next** jusqu'à **Install**, puis **Finish**.

## 2. Installer PostgreSQL (une seule fois)

1. Ouvrez https://www.postgresql.org/download/windows/ → **Download the installer** → version **16**, Windows x86-64.
2. Lancez l'installation en gardant les choix proposés.
3. Quand un **mot de passe** est demandé (utilisateur `postgres`) :
   choisissez-le **avec uniquement des lettres et des chiffres** (par exemple `Postgres2026`) et **notez-le**.
4. Gardez le port **5432**. À la fin, **décochez « Stack Builder »** puis **Finish**.

## 3. Télécharger l'application

1. Ouvrez https://github.com/moulayeidrisse-rgb/registre-collecte (connecté à votre compte GitHub).
2. Bouton vert **Code** → **Download ZIP**.
3. Dans le dossier Téléchargements : clic droit sur le fichier ZIP → **Extraire tout…** → **Extraire**.

## 4. Démarrer

1. Ouvrez le dossier extrait (`registre-collecte-main`).
2. Double-cliquez sur **`demarrer.bat`**.
   - Si Windows affiche « Windows a protégé votre ordinateur » : **Informations complémentaires** → **Exécuter quand même**.
3. La première fois, tapez le mot de passe PostgreSQL de l'étape 2, puis **Entrée**.
4. Patientez (installation 2 à 5 minutes la première fois). Le navigateur s'ouvre sur **http://localhost:3000**.
   Si la page ne s'affiche pas encore, attendez quelques secondes et actualisez (F5).

**Connexion** — mot de passe pour tous les comptes : `Demo-Registre-2026`

| Compte | Rôle |
|---|---|
| `admin@demo.registre.test` | Administrateur |
| `superviseur.nord@demo.registre.test` | Superviseur |
| `agent1@demo.registre.test` | Agent de collecte |

**Laissez la fenêtre noire ouverte** pendant l'utilisation. Pour arrêter : fermez-la.
Les fois suivantes : double-cliquez simplement sur `demarrer.bat` (démarrage en quelques secondes).

## En cas de problème

| Message | Solution |
|---|---|
| « Node.js n'est pas installé » | Refaites l'étape 1, puis **redémarrez l'ordinateur** et relancez `demarrer.bat`. |
| « Impossible d'utiliser la base de données » | Mot de passe PostgreSQL erroné : supprimez le fichier `.env` du dossier et relancez `demarrer.bat`. Vérifiez aussi que PostgreSQL est installé. |
| La page affiche « Ce site est inaccessible » | La fenêtre noire a été fermée, ou le démarrage n'est pas fini : relancez `demarrer.bat` et patientez. |

Les données sont fictives et restent sur votre ordinateur, dans la base PostgreSQL locale.
