// Notifications natives Windows pour les alertes prix.
//
// Le backend verifie deja les alertes en fond (et notifie Discord). Ici, l'app
// sonde periodiquement /api/v1/alerts et affiche une notification native quand
// une alerte vient de se DECLENCHER (nouvelle), meme si la fenetre est masquee
// dans la zone de notification -> l'app devient un "deal-watcher" passif.

const { Notification } = require('electron');
const http = require('http');

const notified = new Set(); // cles "alertId:triggeredAt" deja notifiees
const notifiedDeals = new Set(); // ids de DealHit deja notifies (deal-watcher)

function fetchJson(port, path) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:${port}${path}`, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(3000, () => req.destroy(new Error('timeout')));
  });
}

function fetchAlerts(port) {
  return fetchJson(port, '/api/v1/alerts').then((d) => d.alerts || []);
}

function fetchDeals(port) {
  return fetchJson(port, '/api/v1/watch/deals?limit=30').then((d) => d.deals || []);
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

function notifyDeal(deal) {
  if (!Notification.isSupported()) return;
  const name = deal.name || deal.siteDomain || 'Offre';
  new Notification({
    title: 'Nouveau bon plan',
    body: `${name} à ${deal.price} € (${deal.siteDomain})`,
    silent: false,
  }).show();
}

async function poll(port) {
  try {
    const alerts = await fetchAlerts(port);
    for (const a of alerts) {
      if (!a.triggeredAt) continue;
      const key = `${a.alertId}:${a.triggeredAt}`;
      if (!notified.has(key)) {
        notified.add(key);
        notify(a);
      }
    }
  } catch {
    return; // backend pas pret / indisponible -> on reessaiera au prochain cycle
  }

  try {
    const deals = await fetchDeals(port);
    for (const d of deals) {
      if (!notifiedDeals.has(d.id)) {
        notifiedDeals.add(d.id);
        notifyDeal(d);
      }
    }
  } catch {
    /* deals indisponibles : ignore */
  }
}

function initAlertNotifications(port) {
  // 1er passage : marque les alertes/deals DEJA presents comme "vus" (pas de
  // spam de notifications pour d'anciens elements au demarrage).
  fetchAlerts(port)
    .then((alerts) => {
      for (const a of alerts) {
        if (a.triggeredAt) notified.add(`${a.alertId}:${a.triggeredAt}`);
      }
    })
    .catch(() => {});
  fetchDeals(port)
    .then((deals) => {
      for (const d of deals) notifiedDeals.add(d.id);
    })
    .catch(() => {});
  // Puis sonde toutes les 2 min pour les NOUVELLES alertes/deals.
  setInterval(() => poll(port), 2 * 60 * 1000);
}

module.exports = { initAlertNotifications };
