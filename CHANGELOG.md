# Changelog

Versions notables de l'application desktop. Format inspiré de
[Keep a Changelog](https://keepachangelog.com/fr/).
À mettre à jour à chaque release (avant `npm version` + publication).

## [Non publié]

## [0.12.0] — 2026-06-21
### Refonte page par page
- **Graphes plus spectaculaires** partout : dégradé + halo cyan suivant la couleur
  d'accent, **apparition animée** (barres qui poussent, courbe qui se dessine).
- **Comptes** : panneau en tête avec le **bénéfice net** en grand, mini-stats
  (CA / ROI / rotation / ventes) et la tendance mensuelle animée.
- **Stock** : bandeau de stats (exemplaires, valeur d'achat, potentiel net, dormants).
- **Recherche** : résultats qui apparaissent en cascade.

## [0.11.0] — 2026-06-21
### Favoris intelligents
- **Prix cible dès la recherche** : « Favori + prix cible… » (clic droit sur un
  résultat) enregistre le favori avec ton seuil (suggéré à −10 %).
- **Alerte « passé sous la cible »** : quand le prix d'un favori repasse sous ta
  cible, tu reçois une notification (une seule par franchissement).
- **Rafraîchissement automatique** des prix des favoris Amazon/eBay en fond
  (≈ 1×/jour), sans action de ta part.
### Interface
- En-têtes de page retravaillés (icône lumineuse, liseré néon, animation
  d'entrée), dans la continuité de la refonte futuriste.

## [0.10.0] — 2026-06-21
### Refonte graphique complète — interface futuriste
- **Nouvelle navigation** : sidebar verticale repliable (groupes Explorer / Gérer),
  état actif à halo cyan, badge favoris ; barre du haut avec **palette ⌘K**,
  statut et thème ; nav horizontale de repli sur petits écrans.
- **Identité visuelle** : fond carbone quasi-noir + **cyan néon** + gris, **orbes
  lumineux** animés, trame « blueprint », **surfaces en verre**, glow au survol.
- **Polices** Space Grotesk (titres) + JetBrains Mono (données).
- **Accueil = vrai tableau de bord** : KPIs (bénéfice, stock, ROI, potentiel),
  graphe bénéfice/mois, « à suivre » (dormants/alertes/affaires), dernières
  ventes, état favoris/stock/compta. Fini les accès rapides redondants.
### Sécurité / interne
- Le service ne divulgue plus le détail des erreurs internes au client.

## [0.9.0] — 2026-06-21
### Favoris — gestion avancée
- **Sélection multiple** : coche plusieurs favoris pour les **ranger en lot**
  dans une liste ou les **retirer** d'un coup.
- **Glisser-déposer** un favori sur l'onglet d'une liste pour l'y ranger.
- **Réordonner les listes** (flèches sur la liste active).
- **Vue compacte** : bascule de densité (mémorisée) pour parcourir beaucoup de
  favoris d'un coup d'œil.
- **Historique de prix** par favori : à chaque rafraîchissement, un mini-graphe
  (vert si le prix baisse, rouge s'il monte) montre la tendance.

## [0.8.2] — 2026-06-21
### Favoris
- **Filtre « sous ma cible »** : un bouton compte les favoris au prix cible ou en
  dessous et permet de n'afficher qu'eux (idéal après un rafraîchissement des prix).

## [0.8.1] — 2026-06-21
### Favoris — encore plus pratiques
- **Recherche** dans les favoris + **tri** (récents / prix ↑ / prix ↓ /
  proche de ma cible).
- **Couleurs de listes** : auto-assignées à la création, modifiables d'un clic.
- **Rafraîchir le prix** d'un favori Amazon/eBay (ou tous d'un coup) : le prix
  actuel est re-vérifié, l'évolution s'affiche et l'écart vs ta cible reste juste.
- **Export CSV** de tes favoris (filtre/tri courant inclus).
### Corrigé
- Affichage des durées (« il y a 3 h ») fondé sur l'heure UTC réelle (plus de
  décalage dû au fuseau).

## [0.8.0] — 2026-06-21
### Ajouté — Favoris, un vrai gestionnaire
- **Listes** pour ranger tes favoris (un favori peut être dans plusieurs listes) :
  créer / renommer / supprimer, filtre par liste, compteurs.
- **Cartes riches** : grande photo, **prix cible** perso avec écart vs prix actuel,
  note/avis + délai + vendeur, **note personnelle**, surveillance du prix.
- Favoris **persistés en base** (inclus dans la sauvegarde, conservés entre
  machines) ; tes favoris locaux existants sont **migrés automatiquement**.

## [0.7.2] — 2026-06-20
### Sécurité
- La **sauvegarde** n'exporte plus en clair les identifiants (webhook Discord,
  token Telegram, mot de passe SMTP) ; ils restent en place lors d'une restauration.
### Ajouté
- **Sauvegarde automatique** de la base : un instantané par jour (rotation 7 jours)
  dans `%APPDATA%\ShoppingAssistant\backups\`.
- **Alerte de connecteur** : notification quand une source (Amazon/eBay/…) tombe
  ou se rétablit.
### Interne
- Logique financière testée + carte de stock refactorisée (corrige un comptage
  erroné des objets « dormants »).

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
