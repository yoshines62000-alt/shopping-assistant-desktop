// Sauvegarde automatique de la base (SQLite) de l'app desktop.
//
// Appelle l'endpoint backend POST /api/v1/backup/snapshot, qui fait une copie
// cohérente du fichier SQLite (VACUUM INTO) dans %APPDATA%\ShoppingAssistant\
// backups\ avec rotation (7 derniers). Déclenché peu après le démarrage puis
// toutes les 24 h. Le backend ignore proprement l'appel hors SQLite.

const http = require('http');

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const START_DELAY_MS = 60 * 1000; // laisse le backend démarrer

function triggerSnapshot(port) {
  const req = http.request(
    {
      host: '127.0.0.1',
      port,
      path: '/api/v1/backup/snapshot',
      method: 'POST',
      headers: { 'Content-Length': 0 },
    },
    (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          const body = JSON.parse(data);
          if (body.path) console.log('[backup] snapshot:', body.path, '(rotation:', body.removed, ')');
          else if (body.skipped) console.log('[backup] snapshot ignoré:', body.skipped);
        } catch {
          /* réponse inattendue : on ignore */
        }
      });
    }
  );
  req.on('error', () => {}); // backend pas prêt / indisponible : silencieux
  req.setTimeout(15000, () => req.destroy());
  req.end();
}

function scheduleDbBackups(port) {
  setTimeout(() => triggerSnapshot(port), START_DELAY_MS);
  setInterval(() => triggerSnapshot(port), ONE_DAY_MS);
}

module.exports = { scheduleDbBackups };
