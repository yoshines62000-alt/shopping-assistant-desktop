// Historique des nouveautés affiché dans l'app (/changelog).
// Le plus récent en premier. Contenu en français (les en-têtes sont traduits).
export interface ChangelogEntry {
  version: string;
  /** Date ISO (YYYY-MM-DD). */
  date: string;
  added?: string[];
  improved?: string[];
  fixed?: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.29.0',
    date: '2026-06-24',
    improved: [
      'Page Stock entièrement traduite : formulaire, filtres, statuts, statistiques, cartes d\'objets, ventes et messages suivent la langue.',
    ],
  },
  {
    version: '0.28.0',
    date: '2026-06-24',
    improved: [
      'Pages Recherche et Affaires entièrement traduites : formulaire, filtres, tri, pagination, états vides et messages suivent la langue.',
    ],
  },
  {
    version: '0.27.0',
    date: '2026-06-24',
    improved: [
      'Résultats de recherche traduits : tri, menu clic-droit, libellés et messages suivent la langue (Recherche et Affaires).',
    ],
  },
  {
    version: '0.26.0',
    date: '2026-06-24',
    improved: [
      'Traduction étendue : les en-têtes de toutes les pages suivent la langue choisie.',
      "Un point dans le menu signale qu'une nouvelle version est disponible (page « Nouveautés »).",
    ],
  },
  {
    version: '0.25.0',
    date: '2026-06-24',
    added: [
      'Choix de la langue : français, anglais, espagnol, allemand et italien (Réglages → Langue).',
      'Page « Nouveautés » (ce changelog) accessible depuis le menu.',
    ],
    improved: [
      'Navigation mobile : un menu donne accès à toutes les pages, dont les Réglages.',
      'Réglages → Connexion au backend : bouton « Tester » avec aide au dépannage.',
    ],
  },
  {
    version: '0.24.0',
    date: '2026-06-24',
    added: [
      "Application Android : pilote l'outil depuis le téléphone, le PC fait le travail.",
      'Le backend du PC est joignable sur le réseau local (Wi-Fi).',
      "Écran de démarrage et icône aux couleurs de l'application.",
    ],
  },
  {
    version: '0.23.0',
    date: '2026-06-22',
    fixed: [
      "Vignettes manquantes sur d'anciens favoris : récupérées automatiquement au rafraîchissement du prix.",
    ],
  },
  {
    version: '0.22.0',
    date: '2026-06-22',
    added: [
      'Cloche de notifications : bons plans de la veille, alertes déclenchées et sources en panne.',
      'Menu clic-droit (copier / coller / corriger) dans les champs de saisie (version bureau).',
    ],
  },
];

export const LATEST_VERSION = CHANGELOG[0].version;
