import type { Sale } from '@shopping-assistant/types';

// Génère un bon de vente / facture imprimable (F9) sans dépendance : on ouvre
// une fenêtre avec un document HTML stylé et on lance l'impression — l'utilisateur
// choisit « Enregistrer au format PDF » dans la boîte d'impression du navigateur.

function euro(v: number): string {
  return (v ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

export function printSaleInvoice(sale: Sale, seller = 'Shopping Assistant') {
  const date = new Date(sale.saleDate).toLocaleDateString('fr-FR');
  const ref = `V-${String(sale.id).padStart(5, '0')}`;
  const subtotal = sale.unitPrice * sale.quantity;

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Bon de vente ${ref}</title>
<style>
  * { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #111; }
  body { margin: 40px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .muted { color: #666; font-size: 13px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #ddd; font-size: 14px; }
  th { background: #f4f4f5; }
  td.num, th.num { text-align: right; }
  .totals { margin-top: 16px; width: 280px; margin-left: auto; }
  .totals div { display: flex; justify-content: space-between; padding: 6px 8px; font-size: 14px; }
  .totals .grand { border-top: 2px solid #111; font-weight: 700; font-size: 16px; }
  .foot { margin-top: 40px; font-size: 12px; color: #888; }
  @media print { body { margin: 12mm; } }
</style></head><body>
  <div class="head">
    <div><h1>Bon de vente</h1><div class="muted">${esc(seller)}</div></div>
    <div class="muted" style="text-align:right"><strong>${ref}</strong><br>${date}</div>
  </div>
  <table>
    <thead><tr><th>Désignation</th><th class="num">Qté</th><th class="num">PU</th><th class="num">Montant</th></tr></thead>
    <tbody>
      <tr><td>${esc(sale.itemName)}</td><td class="num">${sale.quantity}</td><td class="num">${euro(sale.unitPrice)}</td><td class="num">${euro(subtotal)}</td></tr>
    </tbody>
  </table>
  <div class="totals">
    <div><span>Sous-total</span><span>${euro(subtotal)}</span></div>
    ${sale.fees > 0 ? `<div><span>Frais</span><span>-${euro(sale.fees)}</span></div>` : ''}
    <div class="grand"><span>Total net</span><span>${euro(sale.total)}</span></div>
  </div>
  ${sale.platform ? `<p class="muted" style="margin-top:24px">Plateforme : ${esc(sale.platform)}</p>` : ''}
  <div class="foot">Document généré par Shopping Assistant — non soumis à TVA (le cas échéant).</div>
  <script>window.onload = function(){ window.print(); }</script>
</body></html>`;

  const w = window.open('', '_blank', 'width=800,height=900');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
