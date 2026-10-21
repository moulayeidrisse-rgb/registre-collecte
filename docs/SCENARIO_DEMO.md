# Scénario de démonstration (≈ 15 minutes)

Toutes les données sont **fictives**. Préparation : `SEED_RESET=1 npm run db:seed` puis `npm run dev`.
Mot de passe de tous les comptes : `Demo-Registre-2026`.

Conseil : utiliser trois fenêtres (ou une fenêtre privée par rôle) pour passer d'un rôle à l'autre.

## 1. Vue d'ensemble — Administrateur (3 min)

Connexion : `admin@demo.registre.test`

1. **Tableau de bord** : présenter les 8 indicateurs (formulaires, réponses enregistrées, validées,
   en attente, complétude, anomalies…). Souligner qu'ils sont **calculés à partir de la base**.
2. Survoler le graphique « Évolution des collectes », ouvrir « Afficher les données sous forme de tableau ».
3. Panneau **Alertes qualité** : anomalies par type, puis « Réponses récentes à examiner ».

## 2. Créer un formulaire (4 min)

1. **Formulaires → Nouveau formulaire** : code `DEMO-01`, titre « Recensement des points d'eau (démo) ».
2. Dans le constructeur, ajouter :
   - « Nom du site » : Texte, obligatoire, longueur max. 80 ;
   - « Date de relevé » : Date, obligatoire, « Pas de date future » ;
   - « Nombre de ménages desservis » : Nombre, obligatoire, min 1, max 500, seuil haut d'alerte 300, entier ;
   - « Point d'eau fonctionnel » : Oui / Non, obligatoire ;
   - « Cause de la panne » : Liste déroulante (Pompe, Source tarie, Autre).
3. **Règle de cohérence** : « Obligation conditionnelle » → *Cause de la panne* obligatoire si
   *Point d'eau fonctionnel* vaut *Non*.
4. **Doublons** : cocher « Nom du site » et « Date de relevé ».
5. **Aperçu** → cliquer « Tester la validation » : les messages d'erreur apparaissent.
6. **Enregistrer et publier**, puis sur la fiche du formulaire, affecter *Amina Test* et *Claire Exemple*.

## 3. Saisie terrain — Agent (3 min)

Connexion : `agent1@demo.registre.test`

1. **Collecte** → « Recensement des points d'eau » → Nouvelle réponse.
2. Saisir 900 ménages, « Non » pour fonctionnel, sans cause → **Soumettre** : récapitulatif d'erreurs
   explicites, champs signalés.
3. Corriger (120 ménages, cause « Pompe ») → **Soumettre** : la réponse passe « En attente de validation ».
4. Refaire une saisie avec le même nom de site et la même date → soumise, mais signalée
   **doublon potentiel** (non bloquant).
5. Démarrer une troisième saisie, **Enregistrer le brouillon**, puis la retrouver dans **Mes réponses**.

## 4. Validation — Superviseur (2 min)

Connexion : `superviseur.nord@demo.registre.test`

1. **Réponses** → filtre Statut « En attente de validation ».
2. Ouvrir la réponse en doublon → **Renvoyer pour correction** sans commentaire : refus explicite ;
   ajouter un commentaire puis renvoyer.
3. Ouvrir la première réponse → **Valider**. L'historique de la réponse se met à jour.

## 5. Sécurité et traçabilité (2 min)

1. Toujours en agent : saisir l'URL `/utilisateurs` → page **Accès refusé** (contrôle serveur, pas
   seulement un menu masqué). Ouvrir `/api/export?formId=...` → **403**.
2. En `superviseur.sud` : ouvrir l'URL d'une réponse de l'enquête ménages → **introuvable**.
3. En administrateur : **Journal d'audit** — connexions, échecs, publication, validations, export.
4. **Utilisateurs** : désactiver un agent → ses sessions sont fermées immédiatement.

## 6. Résultats et export (1 min)

1. **Tableau de bord** : les compteurs ont évolué avec les saisies de la démonstration.
2. **Rapports** → « Recensement des points d'eau » : statistiques par question, **Imprimer / PDF**.
3. **Réponses** → filtrer le formulaire → **Exporter en CSV** (séparateur `;`, ouverture directe dans
   un tableur, formules neutralisées).

## Messages clés

- Prototype **fonctionnel** (base PostgreSQL réelle, validations serveur, droits vérifiés côté serveur),
  testé automatiquement (tests unitaires, d'intégration et de parcours).
- **Générique** : à adapter aux TDR ; aucune conformité réglementaire revendiquée.
