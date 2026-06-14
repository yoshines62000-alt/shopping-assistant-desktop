// Process principal Electron.
//
// Role : au lancement, demarrer les deux services en sidecar (backend FastAPI
// + serveur Next.js), attendre qu'ils repondent, puis afficher l'UI dans une
// fenetre native. A la fermeture, tuer l'arbre des sidecars (equivalent du Job
// Object du panneau PowerShell) pour ne laisser aucun process orphelin.
//
// Mode dev (npm start) : lance `python -m uvicorn` et `next dev`.
// Mode packte (app.isPackaged) : lancera `backend.exe` + serveur Next standalone
// (jalon ulterieur, voir PLAN.md).

const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');

// Ports fixes (suffisant pour une app mono-utilisateur ; le choix de ports
// libres dynamiques pourra venir plus tard, cf. PLAN.md).
const BACKEND_PORT = 8756;
const FRONTEND_PORT = 3987;

const ROOT = path.join(__dirname, '..');
const isDev = !app.isPackaged;

let backendProc = null;
let frontendProc = null;
let mainWindow = null;

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
  if (isDev) {
    backendProc = spawn(
      'python',
      ['-m', 'uvicorn', 'src.main:app', '--port', String(BACKEND_PORT)],
      { cwd, env }
    );
  } else {
    // TODO (jalon packaging) : lancer resources/backend/backend.exe
    backendProc = spawn(path.join(process.resourcesPath, 'backend', 'backend.exe'),
      ['--port', String(BACKEND_PORT)], { cwd, env });
  }
  backendProc.stdout.on('data', (d) => process.stdout.write('[backend] ' + d));
  backendProc.stderr.on('data', (d) => process.stderr.write('[backend] ' + d));
  backendProc.on('exit', (code) => log('backend termine, code', code));
}

function startFrontend() {
  const cwd = path.join(ROOT, 'web');
  const env = {
    ...process.env,
    NEXT_PUBLIC_API_URL: `http://127.0.0.1:${BACKEND_PORT}`,
    PORT: String(FRONTEND_PORT),
  };
  if (isDev) {
    // shell: true -> resout next.cmd via node_modules/.bin sous Windows.
    frontendProc = spawn('npx', ['next', 'dev', '-p', String(FRONTEND_PORT)], {
      cwd,
      env,
      shell: true,
    });
  } else {
    // TODO (jalon packaging) : node resources/web/server.js (sortie standalone)
    frontendProc = spawn(process.execPath,
      [path.join(process.resourcesPath, 'web', 'server.js')], { cwd, env });
  }
  frontendProc.stdout.on('data', (d) => process.stdout.write('[web] ' + d));
  frontendProc.stderr.on('data', (d) => process.stderr.write('[web] ' + d));
  frontendProc.on('exit', (code) => log('frontend termine, code', code));
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    backgroundColor: '#0f1526',
    title: 'Shopping Assistant',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  mainWindow.removeMenu();
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

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    startBackend();
    startFrontend();
    try {
      await waitForHttp(`http://127.0.0.1:${BACKEND_PORT}/health/ready`, 60000);
      log('backend pret');
      await waitForHttp(`http://127.0.0.1:${FRONTEND_PORT}`, 180000);
      log('frontend pret');
    } catch (e) {
      log('attente des services:', e.message);
    }
    await createWindow();
  });

  app.on('window-all-closed', () => {
    killChildren();
    app.quit();
  });
  app.on('before-quit', killChildren);
  process.on('exit', killChildren);
}
