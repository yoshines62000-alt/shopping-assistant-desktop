// Auto-update via electron-updater + GitHub Releases.
//
// Comportement : verifie au demarrage puis toutes les 2 h. Quand une mise a jour
// est publiee, l'app la telecharge en fond (progression dans le titre de la
// fenetre), puis INFORME l'utilisateur et propose de REDEMARRER pour l'appliquer
// (sinon application a la prochaine fermeture).
//
// `checkForUpdates(true)` permet une verification MANUELLE (depuis le menu) avec
// un retour visuel meme si l'app est deja a jour.
//
// Actif uniquement en app installee (pas en dev / --dir non installe).

const { app, dialog } = require('electron');

let autoUpdater = null;
let getWin = () => null;
let manualCheck = false;
let promptShown = false;

function log(...args) {
  console.log('[updater]', ...args);
}

function _win() {
  const w = getWin();
  return w && !w.isDestroyed() ? w : undefined;
}

function initAutoUpdate(getWindow) {
  getWin = getWindow || (() => null);

  if (!app.isPackaged) {
    log('dev/non packte : auto-update desactive');
    return;
  }

  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch (e) {
    log('electron-updater indisponible :', e.message);
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // Feed de test : pointer vers un serveur local (provider "generic") au lieu de
  // GitHub, pour valider l'auto-update sans rien publier. Non defini en usage normal.
  const testFeed = process.env.SA_UPDATE_FEED;
  if (testFeed) {
    log('feed de test (generic) :', testFeed);
    autoUpdater.setFeedURL({ provider: 'generic', url: testFeed });
  }

  autoUpdater.on('error', (err) => {
    const msg = err == null ? 'inconnue' : err.message;
    log('erreur :', msg);
    if (manualCheck) {
      manualCheck = false;
      dialog.showMessageBox(_win(), {
        type: 'warning',
        title: 'Mise a jour',
        message: 'Impossible de verifier les mises a jour.',
        detail: msg,
      });
    }
  });

  autoUpdater.on('update-available', (info) => {
    log('MAJ disponible :', info.version);
    if (manualCheck) {
      manualCheck = false;
      dialog.showMessageBox(_win(), {
        type: 'info',
        title: 'Mise a jour',
        message: `Version ${info.version} disponible.`,
        detail: 'Telechargement en cours... vous serez prevenu quand elle sera prete a installer.',
      });
    }
  });

  autoUpdater.on('update-not-available', () => {
    log('a jour');
    if (manualCheck) {
      manualCheck = false;
      dialog.showMessageBox(_win(), {
        type: 'info',
        title: 'Mise a jour',
        message: 'Shopping Assistant est a jour.',
        detail: `Version ${app.getVersion()}.`,
      });
    }
  });

  autoUpdater.on('download-progress', (p) => {
    const pct = Math.round(p.percent);
    log(`telechargement ${pct}%`);
    const w = _win();
    if (w) w.setTitle(`Shopping Assistant — telechargement mise a jour ${pct}%`);
  });

  autoUpdater.on('update-downloaded', async (info) => {
    log('MAJ telechargee :', info.version);
    const w = _win();
    if (w) w.setTitle('Shopping Assistant');
    if (promptShown) return;
    promptShown = true;
    const choix = await dialog.showMessageBox(w, {
      type: 'info',
      buttons: ['Redemarrer maintenant', 'Plus tard'],
      defaultId: 0,
      cancelId: 1,
      title: 'Mise a jour prete',
      message: `La version ${info.version} de Shopping Assistant est prete.`,
      detail:
        "Redemarrez pour l'appliquer maintenant.\n" +
        'Sinon, elle sera installee automatiquement a la prochaine fermeture.',
    });
    if (choix.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  checkForUpdates(false);
  setInterval(() => checkForUpdates(false), 2 * 60 * 60 * 1000);
}

// Declenche une verification. manual=true -> retour visuel (dialogue) meme a jour.
function checkForUpdates(manual) {
  if (!autoUpdater) {
    if (manual) {
      dialog.showMessageBox(_win(), {
        type: 'info',
        title: 'Mise a jour',
        message: "Les mises a jour ne sont disponibles que sur l'application installee.",
      });
    }
    return;
  }
  if (manual) manualCheck = true;
  autoUpdater.checkForUpdates().catch((e) => {
    manualCheck = false;
    log('check echoue :', e.message);
  });
}

module.exports = { initAutoUpdate, checkForUpdates };
