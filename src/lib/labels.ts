import type {
  FieldType,
  FormStatus,
  FormVersionStatus,
  IssueSeverity,
  IssueType,
  Role,
  SubmissionStatus,
} from "@/generated/prisma/enums";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrateur",
  SUPERVISEUR: "Superviseur",
  AGENT: "Agent de collecte",
};

export const FORM_STATUS_LABELS: Record<FormStatus, string> = {
  BROUILLON: "Brouillon",
  PUBLIE: "Publié",
  DESACTIVE: "Désactivé",
};

export const VERSION_STATUS_LABELS: Record<FormVersionStatus, string> = {
  BROUILLON: "Brouillon",
  PUBLIEE: "Publiée",
  ARCHIVEE: "Archivée",
};

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  BROUILLON: "Brouillon",
  SOUMISE: "En attente de validation",
  A_CORRIGER: "À corriger",
  VALIDEE: "Validée",
  REJETEE: "Rejetée",
};

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  TEXTE: "Texte",
  NOMBRE: "Nombre",
  DATE: "Date",
  LISTE: "Liste déroulante",
  CHOIX_UNIQUE: "Choix unique",
  CHOIX_MULTIPLE: "Choix multiple",
  OUI_NON: "Oui / Non",
};

export const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  MANQUANT: "Champ obligatoire manquant",
  HORS_PLAGE: "Valeur hors plage",
  FORMAT: "Format invalide",
  DOUBLON: "Doublon potentiel",
  INCOHERENCE: "Incohérence entre champs",
};

export const SEVERITY_LABELS: Record<IssueSeverity, string> = {
  ERREUR: "Erreur",
  AVERTISSEMENT: "Avertissement",
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "auth.login": "Connexion",
  "auth.login_failed": "Échec de connexion",
  "auth.login_blocked": "Connexion bloquée (trop de tentatives)",
  "auth.logout": "Déconnexion",
  "auth.password_changed": "Mot de passe modifié",
  "user.create": "Création d'utilisateur",
  "user.update": "Modification d'utilisateur",
  "user.password_reset": "Réinitialisation de mot de passe",
  "user.assignments": "Affectation de formulaires",
  "form.create": "Création de formulaire",
  "form.update": "Modification de formulaire",
  "form.new_version": "Nouvelle version de formulaire",
  "form.publish": "Publication de formulaire",
  "form.disable": "Désactivation de formulaire",
  "form.enable": "Réactivation de formulaire",
  "form.assignments": "Affectation d'utilisateurs",
  "submission.create": "Création de réponse",
  "submission.update": "Modification de réponse",
  "submission.submit": "Soumission de réponse",
  "submission.validate": "Validation de réponse",
  "submission.reject": "Rejet de réponse",
  "submission.return": "Renvoi pour correction",
  "quality.rescan": "Relance du contrôle qualité",
  "export.csv": "Export CSV",
  "access.denied": "Accès refusé",
};

export const STATUS_TONE: Record<SubmissionStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  BROUILLON: "neutral",
  SOUMISE: "info",
  A_CORRIGER: "warning",
  VALIDEE: "success",
  REJETEE: "danger",
};
