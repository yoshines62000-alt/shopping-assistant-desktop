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
- [ ] Build Next.js `standalone` + installeur NSIS (`electron-builder`).
- [ ] Chromium (Playwright) embarqué (nécessaire au scraping dans l'.exe).

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

## Structure

```
electron/   coquille (process principal, preload)
web/        frontend Next.js (copie de apps/web) + vendor/types
backend/    backend FastAPI (copie de services/scraping), adapté SQLite
build/      icône + scripts installeur (NSIS)
scripts/    scripts de build (PyInstaller, next standalone)
PLAN.md     plan détaillé du projet
```
