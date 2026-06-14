# Plan — Shopping Assistant en logiciel Windows installable

> Document de cadrage. Cible : transformer le projet web `shopping-assistant`
> (Next.js + FastAPI/Python) en un **logiciel Windows installable** (`setup.exe`)
> qui démarre seul, **sans Docker ni panneau de contrôle**.
>
> Le projet d'origine (`../shopping-assistant`) **n'est pas modifié** : on en
> **copie** le code dans ce nouveau dépôt.
>
> Rédigé le 2026-06-14.

---

## 1. Principes

- **Nouveau dépôt** `shopping-assistant-desktop` (celui-ci). Le projet actuel reste intact.
- Stack retenue :
  - **Electron** — coquille de bureau (fenêtre native, lance les services).
  - **Next.js** — interface, réutilisée telle quelle (build `standalone`).
  - **Backend Python packagé** via **PyInstaller** → `backend.exe`.
  - **SQLite** — base de données locale (un fichier, pas de serveur).
  - **electron-builder** — produit l'installeur **NSIS** (`setup.exe`).
- Résultat : un seul `setup.exe` (menu Démarrer, icône bureau, désinstalleur),
  l'app démarre ses services automatiquement.

---

## 2. Architecture à l'exécution

```
  setup.exe (installeur NSIS)
        │ installe
        ▼
  ┌─────────────────────────────────────────────────────┐
  │  Application installée (icône bureau / menu Démarrer)│
  │                                                       │
  │   ┌─────────────────────────────────────────────┐    │
  │   │  Fenêtre Electron — affiche l'interface      │    │
  │   └─────────────────────────────────────────────┘    │
  │                      │ charge                         │
  │                      ▼                                │
  │   ┌──────────────────┐      API     ┌──────────────┐  │
  │   │ Serveur Next.js   │ ───────────► │ backend.exe  │  │
  │   │ (interface,       │              │ FastAPI       │  │
  │   │  sidecar)         │              │ (PyInstaller) │  │
  │   └──────────────────┘              │  ┌──────────┐ │  │
  │                                      │  │ Chromium │ │  │
  │                                      │  │ Playwright│ │  │
  │                                      │  └──────────┘ │  │
  │                                      └──────┬───────┘  │
  │                                             │          │
  │                                             ▼          │
  │              ┌──────────────────────────────────────┐  │
  │              │ Base SQLite locale (%APPDATA%)        │  │
  │              │ aucun Docker                          │  │
  │              └──────────────────────────────────────┘  │
  └─────────────────────────────────────────────────────┘

  Légende : interface = Electron + Next.js ; moteur/scraping = backend.exe + Chromium.
```

---

## 3. Arborescence du dépôt

```
shopping-assistant-desktop/
├─ electron/
│  ├─ main.js          # spawn backend + serveur Next, crée la fenêtre, gère l'arrêt
│  ├─ preload.js
│  └─ ports.js         # choisit 2 ports libres au lancement
├─ web/                # copie de apps/web (Next.js), build "standalone"
├─ backend/            # copie de services/scraping (FastAPI), adapté SQLite
├─ resources/          # généré par le build, embarqué dans l'installeur
│  ├─ backend/         #   backend.exe + deps (PyInstaller)
│  ├─ chromium/        #   navigateur Playwright (offline) — optionnel
│  └─ web/             #   .next/standalone + static + public
├─ build/
│  ├─ icon.ico
│  └─ installer.nsh    # script NSIS (raccourcis, %APPDATA%, etc.)
├─ scripts/
│  ├─ build-backend.ps1   # PyInstaller
│  ├─ build-web.ps1       # next build (standalone)
│  └─ build-all.ps1
├─ package.json        # scripts + config electron-builder
└─ PLAN.md             # ce document
```

---

## 4. Adaptations du code (dans la copie, pas l'original)

| Domaine | Aujourd'hui | À adapter |
|---|---|---|
| **Base de données** | Postgres / TimescaleDB (Docker) | **SQLite** via SQLModel. Vérifier qu'aucune requête n'utilise une fonction Timescale (hypertables sur l'historique de prix) → tables normales. |
| **Cache** | Redis (Docker) | Rien à faire : `get_redis()` renvoie déjà `None` proprement → fonctionne sans cache. |
| **Stockage objet** | MinIO (Docker) | À auditer (images ?) → dossier local si utilisé, sinon supprimer. |
| **Chemins** | dossier du projet | DB + logs dans `%APPDATA%\ShoppingAssistant` (le dossier d'install est en lecture seule). |
| **Playwright** | `playwright install` manuel | Pointer `PLAYWRIGHT_BROWSERS_PATH` vers le Chromium bundlé, **ou** `playwright install chromium` au 1er lancement. |
| **Ports** | 3000 / 8000 en dur | Lire le port via variable d'environnement (injectée par Electron) + CORS dynamique. |
| **Frontend** | `API_BASE` fixe | Lire le port backend injecté au runtime ; activer `output: 'standalone'` ; les routes dynamiques (`/products/[id]`) restent OK en serveur standalone. |

---

## 5. Pipeline de build (`scripts/build-all.ps1`)

1. **Backend** → PyInstaller empaquette `uvicorn src.main:app` en
   `resources/backend/backend.exe` (hidden-imports pour fastapi, sqlmodel,
   playwright…).
2. **Chromium** → `playwright install chromium` puis copie dans
   `resources/chromium/` (pour le fonctionnement hors-ligne).
3. **Web** → `next build` (standalone) → copie `.next/standalone` + `static` +
   `public` dans `resources/web/`.
4. **Empaquetage** → `electron-builder` produit `setup.exe` (NSIS) : icône,
   menu Démarrer, raccourci bureau, désinstalleur.

---

## 6. Logique de démarrage (`electron/main.js`)

1. `app.whenReady` → trouver 2 ports libres.
2. Lancer `backend.exe` (`PORT=<back>`, `APP_DATA=%APPDATA%\ShoppingAssistant`)
   → attendre `/health/ready`.
3. Lancer le serveur Next standalone (`PORT=<front>`,
   `NEXT_PUBLIC_API_BASE=http://127.0.0.1:<back>`) → attendre le port.
4. `BrowserWindow.loadURL("http://127.0.0.1:<front>")`.
5. **Single-instance lock** (évite deux fenêtres).
6. À la fermeture → tuer les sidecars (tree-kill — l'équivalent du Job Object
   ajouté au panneau PowerShell, mais géré côté Electron).

---

## 7. Distribution & mises à jour

- `electron-builder` → `setup.exe` NSIS, hébergé sur **GitHub Releases**.
- **Auto-update** possible via `electron-updater` (lit les Releases). Optionnel.
- **Signature** du `.exe` (certificat OV/EV, payant) pour éviter l'avertissement
  SmartScreen. Optionnel mais recommandé pour une distribution à d'autres.

---

## 8. Risques / points d'attention

- **Taille** : ~200–300 Mo avec Chromium embarqué (ou installeur léger +
  téléchargement au 1er lancement).
- **PyInstaller + Playwright** : hooks parfois capricieux → **à tester tôt**
  (principal risque technique).
- **Timescale → SQLite** : perte de l'optimisation time-series de l'historique
  de prix (sans impact à l'échelle perso).
- **Antivirus / SmartScreen** sur un `.exe` non signé.
- **Le scraping reste fragile** (sélecteurs des sites marchands) — indépendant
  de l'empaquetage.

---

## 9. Alternative : Tauri (au lieu d'Electron)

| Stack | Avantages | Inconvénients |
|---|---|---|
| **Electron** *(recommandé ici)* | Outillage roi pour « lancer un backend + faire un installeur » ; auto-update ; réutilise le Next.js tel quel | Plus lourd (~150 Mo, embarque Chromium) |
| **Tauri** | Très léger (~5–10 Mo, utilise WebView2 déjà présent sur Win10/11) | Frontend à adapter en statique ; intégration backend Python plus manuelle |

Electron est recommandé car c'est le chemin le plus direct pour transformer
*exactement* ce projet en installeur, avec le moins de modifications du code.

---

## 10. Jalons

| Jalon | Contenu | Effort |
|---|---|---|
| **J1 — POC** | Electron ouvre l'UI + `backend.exe` répond (SQLite, sans Chromium bundlé) | ~1–2 j |
| **J2–3** | Playwright bundlé, ports dynamiques, données `%APPDATA%`, arrêt propre des sidecars | ~2 j |
| **J4–5** | `electron-builder` → installeur NSIS propre (icône, menu Démarrer, désinstalleur) + tests install/désinstall | ~2 j |
| **J+** | Signature `.exe` + auto-update GitHub Releases | optionnel |

---

## Prochaine étape

Démarrer la **POC du jalon 1** : scaffolding Electron, copie de `web/` et
`backend/`, premier `backend.exe` via PyInstaller, fenêtre qui charge l'UI.
