// Auto-update via electron-updater + GitHub Releases.
//
// Comportement voulu : quand une mise a jour validee est publiee (= une nouvelle
// Release GitHub avec l'installeur + latest.yml), l'app la telecharge en fond,
// puis INFORME l'utilisateur qu'elle est prete et lui propose de REDEMARRER pour
// l'appliquer. S'il reporte, elle s'installe a la prochaine fermeture.
//
// Ne s'active qu'en app installee (pas en dev / pas en --dir non installe).

const { app, dialog } = require('electron');

function log(...args) {
  console.log('[updater]', ...args);
}

function initAutoUpdate(getWindow) {
  if (!app.isPackaged) {
    log('dev/non packte : auto-update desactive');
    return;
  }

  let autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch (e) {
    log('electron-updater indisponible :', e.message);
    return;
  }

  // Telecharge la MAJ des qu'elle est detectee ; si l'utilisateur reporte le
  // redemarrage, elle est appliquee automatiquement au prochain arret de l'app.
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // Feed de test : pointer l'app vers un serveur local (provider "generic") au
  // lieu des Releases GitHub, pour valider l'auto-update sans rien publier.
  // En usage normal, la variable n'est pas definie -> feed GitHub (package.json).
  const testFeed = process.env.SA_UPDATE_FEED;
  if (testFeed) {
    log('feed de test (generic) :', testFeed);
    autoUpdater.setFeedURL({ provider: 'generic', url: testFeed });
  }

  autoUpdater.on('error', (err) => {
    log('erreur :', err == null ? 'inconnue' : err.message);
  });
  autoUpdater.on('update-available', (info) => log('MAJ disponible :', info.version));
  autoUpdater.on('update-not-available', () => log('a jour'));
  autoUpdater.on('download-progress', (p) => log(`telechargement ${Math.round(p.percent)}%`));

  let promptShown = false;
  autoUpdater.on('update-downloaded', async (info) => {
    log('MAJ telechargee :', info.version);
    if (promptShown) return;
    promptShown = true;
    const win = getWindow && getWindow();
    const choix = await dialog.showMessageBox(win, {
      type: 'info',
      buttons: ['Redemarrer maintenant', 'Plus tard'],
      defaultId: 0,
      cancelId: 1,
      title: 'Mise a jour prete',
      message: `La version ${info.version} de Shopping Assistant est prete.`,
      detail:
        "Redemarrez pour l'appliquer maintenant.\n" +
        "Sinon, elle sera installee automatiquement a la prochaine fermeture.",
    });
    if (choix.response === 0) {
      // quitAndInstall ferme l'app (les sidecars sont tues via before-quit) puis
      // relance l'installeur en mode mise a jour et redemarre l'app.
      autoUpdater.quitAndInstall();
    }
  });

  // Verifie au demarrage, puis toutes les 6 h tant que l'app tourne.
  const check = () => autoUpdater.checkForUpdates().catch((e) => log('check echoue :', e.message));
  check();
  setInterval(check, 6 * 60 * 60 * 1000);
}

module.exports = { initAutoUpdate };
