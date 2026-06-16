# Changelog

Versions notables de l'application desktop. Format inspiré de
[Keep a Changelog](https://keepachangelog.com/fr/).
À mettre à jour à chaque release (avant `npm version` + publication).

## [Non publié]
### Ajouté
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
