// Process principal Electron.
//
// Role : au lancement, demarrer les deux services en sidecar (backend FastAPI
// + serveur Next.js), attendre qu'ils repondent, puis afficher l'UI dans une
// fenetre native. A la fermeture, tuer l'arbre des sidecars (equivalent du Job
// Object du panneau PowerShell) pour ne laisser aucun process orphelin.
//
// Mode dev (npm start) : lance `python -m uvicorn` et `next dev`.
// Mode packte (app.isPackaged) : lance `backend.exe` + le serveur Next standalone.
// Un splash couvre le demarrage ; en cas d'echec -> dialogue Reessayer/Quitter.

const { app, BrowserWindow, Menu, Tray, dialog, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { initAutoUpdate, checkForUpdates } = require('./updater');
const { initAlertNotifications } = require('./alerts');

const REPO_URL = 'https://github.com/yoshines62000-alt/shopping-assistant-desktop';

// Ports fixes (suffisant pour une app mono-utilisateur ; le choix de ports
// libres dynamiques pourra venir plus tard, cf. PLAN.md).
const BACKEND_PORT = 8756;
const FRONTEND_PORT = 3987;

const ROOT = path.join(__dirname, '..');
const isDev = !app.isPackaged;

let backendProc = null;
let frontendProc = null;
let mainWindow = null;
let splashWindow = null;
let tray = null;
let reallyQuit = false; // vrai quand on quitte vraiment (vs reduire dans le tray)

// Dossier de donnees de l'app : %APPDATA%\ShoppingAssistant (emplacement stable
// et lisible, independant du nom interne d'Electron). Cree s'il manque.
function dataDir() {
  const dir = path.join(app.getPath('appData'), 'ShoppingAssistant');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Base SQLite dans le dossier de donnees (pas dans le dossier d'installation,
// en lecture seule une fois packte).
function databaseUrl() {
  const dbPath = path.join(dataDir(), 'shopping.db').replace(/\\/g, '/');
  return `sqlite:///${dbPath}`;
}

// Navigateur Chromium embarque (Playwright) pour le scraping. En packte il est
// dans resources/chromium ; en dev on prend le bundle s'il existe, sinon on
// laisse Playwright utiliser son cache global (ms-playwright).
function chromiumDir() {
  return isDev
    ? path.join(ROOT, 'resources', 'chromium')
    : path.join(process.resourcesPath, 'chromium');
}

function log(...args) {
  console.log('[main]', ...args);
}

// Attend qu'une URL HTTP reponde (n'importe quel code) avant de continuer.
function waitForHttp(url, timeoutMs) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.destroy();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) reject(new Error('timeout: ' + url));
        else setTimeout(tick, 500);
      });
      req.setTimeout(2000, () => req.destroy());
    };
    tick();
  });
}

function startBackend() {
  const cwd = path.join(ROOT, 'backend');
  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl(),
    CORS_ALLOW_ORIGINS: `http://127.0.0.1:${FRONTEND_PORT},http://localhost:${FRONTEND_PORT}`,
  };
  const chromium = chromiumDir();
  if (fs.existsSync(chromium)) {
    env.PLAYWRIGHT_BROWSERS_PATH = chromium;
  }
  if (isDev) {
    backendProc = spawn(
      'python',
      ['-m', 'uvicorn', 'src.main:app', '--port', String(BACKEND_PORT)],
      { cwd, env }
    );
  } else {
    // Packte : backend.exe (PyInstaller) depuis resources/backend.
    const backendDir = path.join(process.resourcesPath, 'backend');
    backendProc = spawn(path.join(backendDir, 'backend.exe'),
      ['--port', String(BACKEND_PORT)], { cwd: backendDir, env });
  }
  backendProc.stdout.on('data', (d) => process.stdout.write('[backend] ' + d));
  backendProc.stderr.on('data', (d) => process.stderr.write('[backend] ' + d));
  backendProc.on('exit', (code) => log('backend termine, code', code));
}

function startFrontend() {
  const env = {
    ...process.env,
    NEXT_PUBLIC_API_URL: `http://127.0.0.1:${BACKEND_PORT}`,
    PORT: String(FRONTEND_PORT),
    HOSTNAME: '127.0.0.1',
  };
  if (isDev) {
    // shell: true -> resout next.cmd via node_modules/.bin sous Windows.
    frontendProc = spawn('npx', ['next', 'dev', '-p', String(FRONTEND_PORT)], {
      cwd: path.join(ROOT, 'web'),
      env,
      shell: true,
    });
  } else {
    // Packte : serveur Next "standalone" (resources/web/server.js) lance par le
    // node embarque dans Electron (ELECTRON_RUN_AS_NODE=1). cwd = le dossier
    // standalone pour qu'il trouve .next/static et public.
    const webDir = path.join(process.resourcesPath, 'web');
    frontendProc = spawn(process.execPath, [path.join(webDir, 'server.js')], {
      cwd: webDir,
      env: { ...env, ELECTRON_RUN_AS_NODE: '1' },
    });
  }
  frontendProc.stdout.on('data', (d) => process.stdout.write('[web] ' + d));
  frontendProc.stderr.on('data', (d) => process.stderr.write('[web] ' + d));
  frontendProc.on('exit', (code) => log('frontend termine, code', code));
}

// Menu minimal (barre masquee par defaut, revelee avec Alt). Donne un acces a la
// verification manuelle des mises a jour, a la version, et au zoom/rechargement.
function buildAppMenu() {
  const template = [
    {
      label: 'Fichier',
      submenu: [
        { label: 'Verifier les mises a jour...', click: () => checkForUpdates(true) },
        { type: 'separator' },
        { role: 'quit', label: 'Quitter' },
      ],
    },
    {
      label: 'Affichage',
      submenu: [
        { role: 'reload', label: 'Recharger' },
        { role: 'togglefullscreen', label: 'Plein ecran' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom normal' },
        { role: 'zoomIn', label: 'Zoom +' },
        { role: 'zoomOut', label: 'Zoom -' },
      ],
    },
    {
      label: 'Aide',
      submenu: [
        { label: `Version ${app.getVersion()}`, enabled: false },
        { label: 'Code source (GitHub)', click: () => shell.openExternal(REPO_URL) },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// --- Zone de notification (tray) -----------------------------
function showMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  if (tray) return;
  try {
    tray = new Tray(path.join(__dirname, 'tray.png'));
  } catch (e) {
    log('tray indisponible :', e.message);
    return;
  }
  tray.setToolTip('Shopping Assistant');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Ouvrir', click: showMainWindow },
      { type: 'separator' },
      { label: 'Quitter', click: () => { reallyQuit = true; app.quit(); } },
    ])
  );
  tray.on('double-click', showMainWindow);
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    backgroundColor: '#0f1526',
    title: 'Shopping Assistant',
    autoHideMenuBar: true, // barre de menu masquee par defaut (Alt pour l'afficher)
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  buildAppMenu();
  // Fermer la fenetre ne quitte pas : on la masque dans la zone de notification
  // (l'app continue de surveiller les alertes en fond). Quitter = menu du tray.
  mainWindow.on('close', (e) => {
    if (!reallyQuit) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  await mainWindow.loadURL(`http://127.0.0.1:${FRONTEND_PORT}`);
}

// Tue l'arbre de chaque sidecar. Sous Windows, taskkill /T emporte les enfants
// (next -> node, uvicorn -> workers, Chromium de Playwright...).
function killChildren() {
  for (const proc of [backendProc, frontendProc]) {
    if (proc && proc.pid && !proc.killed) {
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F']);
        } else {
          proc.kill('SIGTERM');
        }
      } catch (e) {
        log('kill error', e.message);
      }
    }
  }
  backendProc = null;
  frontendProc = null;
}

// --- Ecran de demarrage (splash) -----------------------------
function createSplash() {
  splashWindow = new BrowserWindow({
    width: 460,
    height: 300,
    frame: false,
    resizable: false,
    center: true,
    backgroundColor: '#0f1526',
    title: 'Shopping Assistant',
  });
  splashWindow.removeMenu();
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
}

function splashStatus(text) {
  log(text);
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents
      .executeJavaScript(`window.setStatus && window.setStatus(${JSON.stringify(text)})`)
      .catch(() => {});
  }
}

function closeSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
  splashWindow = null;
}

// Promesse qui rejette si le process meurt avant d'etre pret (echec rapide :
// inutile d'attendre le timeout complet si backend.exe plante au demarrage).
function rejectOnExit(proc, name) {
  let handler;
  const promise = new Promise((_, reject) => {
    handler = (code) => reject(new Error(`${name} s'est arrete (code ${code}) avant d'etre pret.`));
    proc.once('exit', handler);
  });
  return { promise, dispose: () => proc && proc.removeListener('exit', handler) };
}

async function waitForServiceReady(proc, url, timeout, name) {
  const guard = rejectOnExit(proc, name);
  try {
    await Promise.race([waitForHttp(url, timeout), guard.promise]);
  } finally {
    guard.dispose();
  }
}

// Tue un backend.exe orphelin (issu d'un crash precedent) qui squatterait nos
// ports. Cible uniquement NOTRE binaire (chemin sous resources) -> sans danger.
function cleanupOrphans() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32' || isDev) return resolve();
    const resDir = process.resourcesPath.replace(/'/g, "''");
    const ps =
      `Get-CimInstance Win32_Process -Filter "Name='backend.exe'" | ` +
      `Where-Object { $_.ExecutablePath -like '${resDir}*' } | ` +
      `ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
    try {
      const p = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], {
        windowsHide: true,
      });
      p.on('exit', () => resolve());
      p.on('error', () => resolve());
    } catch {
      resolve();
    }
  });
}

// Demarre les services et attend qu'ils repondent, en mettant a jour le splash.
async function bootServices() {
  splashStatus('Verification...');
  await cleanupOrphans();
  splashStatus('Demarrage du moteur...');
  startBackend();
  await waitForServiceReady(
    backendProc,
    `http://127.0.0.1:${BACKEND_PORT}/health/ready`,
    45000,
    'Le moteur (backend)'
  );
  splashStatus("Preparation de l'interface...");
  startFrontend();
  await waitForServiceReady(
    frontendProc,
    `http://127.0.0.1:${FRONTEND_PORT}`,
    120000,
    "L'interface"
  );
  splashStatus('Pret.');
}

// Orchestration : splash -> services -> fenetre. En cas d'echec, propose de
// reessayer ou de quitter (au lieu d'une fenetre blanche muette).
async function startup() {
  try {
    await bootServices();
  } catch (e) {
    killChildren();
    const detail =
      (e && e.message ? e.message : 'Erreur inconnue.') +
      '\n\nUne instance precedente est peut-etre encore active, ou un port ' +
      `(${BACKEND_PORT}/${FRONTEND_PORT}) est occupe par un autre programme.`;
    const res = await dialog.showMessageBox(splashWindow || undefined, {
      type: 'error',
      buttons: ['Reessayer', 'Quitter'],
      defaultId: 0,
      cancelId: 1,
      title: 'Demarrage impossible',
      message: "Shopping Assistant n'a pas pu demarrer.",
      detail,
    });
    if (res.response === 0) {
      return startup();
    }
    app.quit();
    return;
  }
  // Fenetre principale AVANT de fermer le splash (toujours >= 1 fenetre ouverte,
  // sinon window-all-closed quitterait l'app).
  await createWindow();
  closeSplash();
  createTray();
  initAutoUpdate(() => mainWindow);
  initAlertNotifications(BACKEND_PORT);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showMainWindow();
  });

  app.whenReady().then(() => {
    createSplash();
    startup();
  });

  app.on('window-all-closed', () => {
    killChildren();
    app.quit();
  });
  app.on('before-quit', () => {
    reallyQuit = true;
    killChildren();
  });
  process.on('exit', killChildren);
}
