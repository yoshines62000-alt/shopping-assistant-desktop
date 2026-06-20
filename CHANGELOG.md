# Changelog

Versions notables de l'application desktop. Format inspiré de
[Keep a Changelog](https://keepachangelog.com/fr/).
À mettre à jour à chaque release (avant `npm version` + publication).

## [Non publié]

## [0.7.1] — 2026-06-20
### Ajouté
- **Menu clic droit** étendu au stock, aux affaires et aux favoris (en plus de
  la recherche) : actions rapides adaptées à chaque objet.
- **Raccourcis clavier** : `/` (recherche), `?` (aide), et `g` + lettre pour
  naviguer (g s = stock, g f = favoris, g c = comptes…).

## [0.7.0] — 2026-06-20
### Ajouté
- **Favoris** : « Liste » devient « Favoris ». Le **cœur** d'un résultat de
  recherche l'ajoute aux favoris ; la surveillance de prix passe sur une cloche.
- **Menu clic droit** sur les résultats : actions rapides (favoris, surveiller,
  estimer, comparer, historique, ouvrir l'annonce, copier le lien).
- **Couleur d'accent personnalisable** (Réglages → Apparence) : 6 teintes,
  appliquée et mémorisée aussitôt, adaptée au thème clair/sombre.
### Amélioré (interface)
- Refonte visuelle avancée : boutons primaires en **dégradé** suivant l'accent,
  léger retour tactile au clic, onglet actif plus net.
- Accueil retravaillé (hero), tuiles d'accès rapide colorées, états vides
  illustrés et chargements en fondu.

## [0.6.0] — 2026-06-17
### Amélioré (interface)
- **Refonte visuelle** : vignettes produit unifiées (avec placeholder propre)
  partout où l'on liste des offres — recherche, affaires, arbitrage, comparaison,
  stock et ventes analysées.
- **Navigation** rangée avec une icône devant chaque rubrique.
- **En-têtes de page** plus soignés (icône pastillée), cartes **KPI** à liseré
  dégradé, et **ombres adaptées au thème** (douces en clair).
- Photos de l'objet affichées dans le **brouillon d'annonce** (cross-listing).
### Corrigé
- Disparition d'un avertissement React au chargement (thème).

## [0.5.0] — 2026-06-17
### Ajouté
- **Photos des produits dans les résultats de recherche** : chaque offre
  (Amazon / eBay / Vinted / Leboncoin) affiche désormais sa vignette à côté du
  titre, du prix et des infos.
- **Miniatures de tes photos dans le stock** : la première photo d'un objet
  s'affiche directement dans la liste (clic → galerie).

## [0.4.0] — 2026-06-17
### Ajouté
- **Thème clair / sombre** : bascule dans la barre de navigation (préférence
  mémorisée, sans clignotement au démarrage).
- **Photos d'annonce** : ajout de photos par objet (redimensionnées et
  compressées localement), galerie + suppression.
- **Suggestion de re-tarification** : sur un objet en vente, un indicateur
  conseille de baisser ou monter le prix quand le marché a bougé.

## [0.3.0] — 2026-06-16
### Ajouté (18 nouveautés)
- **Pilotage** : bande « À suivre » sur l'accueil (objets dormants, alertes
  actives, nouveaux bons plans) ; **ROI par catégorie** sur les comptes.
- **Prix** : **calculateur de marge** détaillé (frais + port → net/marge/ROI) et
  **graphe d'historique** complet (min/médiane/max) sur la fiche produit.
- **Stock & ventes** : **import/export CSV**, **facture / bon de vente PDF**,
  **suivi des retours** (+ taux de retour), **SKU + étiquette** de rangement,
  **catégorie** d'objet.
- **Compta / fiscal** : **aide micro-entrepreneur** (CA, cotisations URSSAF,
  seuils TVA / micro-BIC) ; **catégorisation auto des dépenses**.
- **Notifications** : **Telegram + e-mail** (en plus de Discord) avec bouton de
  test ; **digest hebdomadaire** automatique.
- **Surveillances** : fréquence réglable par recherche + **veille « nouveautés »**
  (plus de flot initial).
- **Données & confort** : **sauvegarde / restauration** de la base (JSON) ;
  **palette de commandes** (Ctrl+K).
- **Robustesse** : migrations de schéma désormais compatibles SQLite (ajout de
  colonnes sur base existante).

## [0.2.0] — 2026-06-16
### Ajouté
- **Connecteur Leboncoin** : recherche leboncoin.fr (parse `__NEXT_DATA__`),
  intégré à la recherche / santé / surveillances. *(DataDome bloque sans proxy
  résidentiel : dégradation propre + circuit breaker.)*
- **Deal-watcher** : surveille des recherches favorites (requête + prix cible),
  les re-scanne en fond et **notifie** (Discord + notification native Windows)
  dès qu’une offre passe sous la cible. UI dans « Alertes & surveillances ».
- **Aide au cross-listing** : bouton « Annonce » sur chaque objet du stock —
  brouillon de titre + description + prix conseillé, adapté à eBay / Vinted /
  Leboncoin, avec copie en un clic.
- **Stock dormant** : badge « Dormant · N j » et bandeau récapitulatif (nombre +
  valeur immobilisée) pour les objets en stock depuis plus de 60 jours.
- **Tendance de prix** : indicateur « bon moment pour acheter » (prix actuel
  proche du plus bas / plus haut de la fourchette observée) sur la fiche produit.
- **Zone de notification (tray)** : fermer la fenêtre la masque (l'app continue
  en fond) ; **notifications natives Windows** quand une alerte prix se déclenche.
- Santé des connecteurs + **circuit breaker** anti-bot (saute un connecteur
  bloqué à répétition) ; endpoint `/api/v1/connectors/health` + section
  « Santé du scraping » dans Réglages.
- Script `scripts/sync-from-main.ps1` (sync backend + frontend depuis le projet principal).

## [0.1.2] — 2026-06-15
### Ajouté
- Vérification des mises à jour toutes les **2 h** (au lieu de 6 h) + menu
  **Fichier → Vérifier les mises à jour…** (vérification manuelle).
- **Progression** du téléchargement de la mise à jour dans le titre de la fenêtre.

## [0.1.1] — 2026-06-15
### Ajouté / Modifié
- Fiabilité du scraping : **détection des blocages anti-bot** + retry session,
  tests des parsers sur **fixtures HTML réelles** (Amazon/eBay).

## [0.1.0] — 2026-06-15
### Initial
- Application Windows packagée : **Electron + Next.js + FastAPI / SQLite** (sans Docker).
- `backend.exe` (PyInstaller), **Chromium embarqué**, installeur **NSIS**.
- **Mise à jour automatique** (electron-updater + GitHub Releases).
- Démarrage robuste : splash + gestion d'erreurs (Réessayer / Quitter), icône.
