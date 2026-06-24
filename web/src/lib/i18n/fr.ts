// Dictionnaire FRANÇAIS — source de vérité des clés i18n.
// Les autres langues doivent fournir les mêmes clés (typage strict).
export const fr = {
  // Navigation
  'nav.home': 'Accueil',
  'nav.search': 'Recherche',
  'nav.deals': 'Affaires',
  'nav.arbitrage': 'Arbitrage',
  'nav.estimate': 'Estimation',
  'nav.stock': 'Stock',
  'nav.accounting': 'Comptes',
  'nav.favorites': 'Favoris',
  'nav.alerts': 'Alertes',
  'nav.digest': 'Digest',
  'nav.scan': 'Scanner',
  'nav.settings': 'Réglages',
  'nav.changelog': 'Nouveautés',
  'group.explore': 'Explorer',
  'group.manage': 'Gérer',
  'nav.collapse': 'Replier',
  'nav.expand': 'Déplier',
  'nav.openMenu': 'Ouvrir le menu',
  'nav.closeMenu': 'Fermer le menu',
  'nav.home.title': 'Accueil',

  // Barre du haut
  'topbar.searchPage': 'Rechercher une page…',
  'topbar.notifications': 'Notifications',
  'topbar.toggleTheme': 'Basculer le thème',

  // État du backend
  'status.online': 'Services connectés',
  'status.offline': 'Services hors ligne',
  'status.checking': 'Connexion…',

  // Réglages
  'settings.title': 'Réglages',
  'settings.subtitle': 'Frais de revente, notifications, sauvegarde et tâches automatiques',
  'settings.appearance': 'Apparence',
  'settings.language': 'Langue',
  'settings.languageHelp': "Langue de l'interface (appliquée et mémorisée aussitôt).",
  'settings.backend': 'Connexion au backend',
  'settings.backendTest': 'Tester',
  'settings.backendTesting': 'Test…',
  'settings.backendSave': 'Enregistrer & recharger',
  'settings.backendReachable': '✓ Backend joignable à cette adresse.',
  'settings.currently': 'Actuellement',

  // Commun
  'common.save': 'Enregistrer',
  'common.saved': 'Enregistré',
  'common.cancel': 'Annuler',
  'common.close': 'Fermer',

  // Nouveautés / changelog
  'changelog.title': 'Nouveautés',
  'changelog.subtitle': 'Les améliorations et corrections, version par version',
  'changelog.current': 'Version actuelle',
  'changelog.added': 'Ajouté',
  'changelog.improved': 'Amélioré',
  'changelog.fixed': 'Corrigé',

  // En-têtes de pages
  'page.search.title': 'Recherche',
  'page.search.sub': 'Offres réelles Amazon.fr et eBay.fr, triées par score',
  'page.deals.title': 'Bonnes affaires',
  'page.deals.sub': "Tape ce que tu cherches : l'app trouve les offres et estime automatiquement leur revente, classées par marge",
  'page.arbitrage.title': 'Arbitrage',
  'page.arbitrage.sub': "Même produit moins cher d'un côté que de l'autre : achète bas, revends haut",
  'page.estimate.title': 'Estimation de revente',
  'page.estimate.sub': 'Basée sur les ventes réellement conclues sur eBay — pas les prix affichés',
  'page.stock.title': 'Mon stock',
  'page.accounting.title': 'Mes comptes',
  'page.accounting.sub': 'Bilan achat / revente',
  'page.favorites.title': 'Mes favoris',
  'page.alerts.title': 'Alertes & surveillances',
  'page.alerts.sub': "Surveille des recherches favorites ou un produit précis — re-scan automatique en fond et notification quand le prix passe sous ta cible",
  'page.digest.title': 'Digest quotidien',
  'page.digest.sub': 'Baisses de prix récentes',
  'page.scan.title': 'Mode brocante',
  'page.scan.sub': "Scanne ou saisis un objet : verdict immédiat et prix d'achat max pour ta marge cible",
} as const;

export type TranslationKey = keyof typeof fr;
