// Notifications natives Windows pour les alertes prix.
//
// Le backend verifie deja les alertes en fond (et notifie Discord). Ici, l'app
// sonde periodiquement /api/v1/alerts et affiche une notification native quand
// une alerte vient de se DECLENCHER (nouvelle), meme si la fenetre est masquee
// dans la zone de notification -> l'app devient un "deal-watcher" passif.

const { Notification } = require('electron');
const http = require('http');

const notified = new Set(); // cles "alertId:triggeredAt" deja notifiees

function fetchAlerts(port) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:${port}/api/v1/alerts`, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data).alerts || []);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(3000, () => req.destroy(new Error('timeout')));
  });
}

function notify(alert) {
  if (!Notification.isSupported()) return;
  const name = alert.name || alert.productId;
  new Notification({
    title: 'Alerte prix déclenchée',
    body: `${name} est passé sous ${alert.thresholdPrice} €`,
    silent: false,
  }).show();
}

async function poll(port) {
  let alerts;
  try {
    alerts = await fetchAlerts(port);
  } catch {
    return; // backend pas pret / indisponible
  }
  for (const a of alerts) {
    if (!a.triggeredAt) continue;
    const key = `${a.alertId}:${a.triggeredAt}`;
    if (!notified.has(key)) {
      notified.add(key);
      notify(a);
    }
  }
}

function initAlertNotifications(port) {
  // 1er passage : marque les alertes DEJA declenchees comme "vues" (pas de spam
  // de notifications pour d'anciennes alertes au demarrage).
  fetchAlerts(port)
    .then((alerts) => {
      for (const a of alerts) {
        if (a.triggeredAt) notified.add(`${a.alertId}:${a.triggeredAt}`);
      }
    })
    .catch(() => {});
  // Puis sonde toutes les 2 min pour les NOUVELLES alertes declenchees.
  setInterval(() => poll(port), 2 * 60 * 1000);
}

module.exports = { initAlertNotifications };
