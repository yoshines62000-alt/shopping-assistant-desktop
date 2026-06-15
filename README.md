# Shopping Assistant — application de bureau (Windows)

Version « logiciel installable » de [shopping-assistant](../shopping-assistant) :
le frontend Next.js et le backend FastAPI sont emballés dans une coquille
**Electron**. La base est **SQLite** (un fichier local), donc **aucun Docker**.

> Projet généré à partir du plan [`PLAN.md`](./PLAN.md). Le dépôt d'origine
> n'est pas modifié : son code est **copié** ici (`web/`, `backend/`).

## État d'avancement (jalon 1 — POC)

- [x] Backend copié et adapté **SQLite** (démarre sans Docker, vérifié).
- [x] Coquille Electron qui lance backend + frontend en sidecars et affiche l'UI.
- [x] Arrêt propre des sidecars à la fermeture (taskkill /T).
- [x] Packaging **`backend.exe`** (PyInstaller) — `npm run build:backend` (vérifié : démarre sans Python).
- [x] **Chromium** embarqué — `npm run build:chromium` (~270 Mo, headless shell ; vérifié : scraping réel OK dans l'exe, sans Playwright global).
- [x] Build Next.js **`standalone`** + **installeur NSIS** (`electron-builder`) → **`setup.exe`** (vérifié : app packagée lance backend.exe + Chromium + frontend, DB et recherche OK).
- [x] **Mise à jour automatique** (`electron-updater` + GitHub Releases) : l'app détecte une nouvelle version, la télécharge, et propose de **redémarrer pour l'appliquer**.
- [x] **Démarrage robuste** : écran de chargement (splash) avec statut, **gestion d'erreurs** (dialogue *Réessayer / Quitter* au lieu d'une fenêtre blanche si un service ne démarre pas), et nettoyage des `backend.exe` orphelins d'un crash précédent.

## Prérequis (dev)

- Node.js + npm
- Python 3 avec les dépendances du backend installées
  (`pip install -r backend/requirements.txt`)

## Lancer en dev

```powershell
# 1) Dépendances du frontend (Next.js + types vendorisés)
npm run install:web

# 2) Dépendances Electron
npm install

# 3) Lancer l'application (démarre backend + frontend + fenêtre)
npm start
```

Au lancement, Electron :
1. démarre le backend (`python -m uvicorn`) sur le port **8756**, base SQLite
   dans `%APPDATA%\shopping-assistant-desktop\shopping.db` ;
2. démarre le frontend (`next dev`) sur le port **3987**, pointé sur le backend ;
3. attend que les deux répondent, puis ouvre la fenêtre sur l'UI.

À la fermeture de la fenêtre, les deux sidecars sont tués automatiquement.
(La base SQLite de l'app installée est dans `%APPDATA%\ShoppingAssistant\shopping.db`.)

## Construire l'installeur `setup.exe`

```powershell
# 1) Construire les ressources embarquées (une fois, ou après modif du code) :
npm run build:resources   # = build:backend (PyInstaller) + build:chromium + build:web (Next standalone)

# 2) Fabriquer l'installeur NSIS :
npm run dist              # -> dist_installer/Shopping Assistant Setup <version>.exe

# (ou, app décompressée sans installeur, utile pour tester :)
npm run pack             # -> dist_installer/win-unpacked/Shopping Assistant.exe
```

> **Note Windows / electron-builder** : la création de l'installeur extrait un
> outil (`winCodeSign`) qui contient des liens symboliques macOS. Sur Windows,
> leur création exige un privilège : si `npm run dist` échoue avec
> *« Cannot create symbolic link … winCodeSign … »*, **activez le Mode
> développeur Windows** (Paramètres → Confidentialité et sécurité → Pour les
> développeurs) **ou** lancez le terminal **en administrateur**. Les 2 liens
> concernés (`.dylib`) sont inutiles sous Windows.
>
> L'installeur n'est pas signé (pas de certificat) : Windows SmartScreen peut
> afficher un avertissement au 1er lancement.

## Mises à jour automatiques

L'app installée vérifie au démarrage (puis toutes les 6 h) s'il existe une
version plus récente, via les **Releases GitHub** du dépôt
(`build.publish` dans `package.json`). Si oui : téléchargement en fond, puis une
fenêtre propose **« Redémarrer maintenant »** / **« Plus tard »**. En cas de
report, la mise à jour s'applique automatiquement à la prochaine fermeture.

**Publier une mise à jour** (chez le dev) :

```powershell
# 1) Incrémenter la version dans package.json (ex: 0.1.0 -> 0.1.1)
# 2) Reconstruire ressources + installeur
npm run build:resources
npm run dist
# 3) Publier sur GitHub : créer une Release taguée v0.1.1 et y uploader
#    TOUT le contenu de dist_installer/ : le .exe, latest.yml et le .blockmap.
#    (ou: $env:GH_TOKEN=...; npx electron-builder --publish always)
```

Les apps déjà installées détecteront la Release et proposeront le redémarrage.
L'auto-update ne fonctionne **que sur une app installée** (désactivé en dev).

## Structure

```
electron/   coquille (process principal, preload)
web/        frontend Next.js (copie de apps/web) + vendor/types
backend/    backend FastAPI (copie de services/scraping), adapté SQLite
build/      icône + scripts installeur (NSIS)
scripts/    scripts de build (PyInstaller, next standalone)
PLAN.md     plan détaillé du projet
```
