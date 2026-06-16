import type { StockItem } from '@shopping-assistant/types';

// Étiquette de rangement imprimable (F12) : grand SKU + nom + prix d'achat,
// sans dépendance (impression navigateur). À coller sur le bac / l'objet.

function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

export function printStockLabel(item: StockItem) {
  const sku = item.sku || `SA-${item.id}`;
  const price = (item.purchasePrice ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Étiquette ${esc(sku)}</title>
<style>
  * { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #111; }
  body { margin: 0; }
  .label { width: 62mm; padding: 6mm; box-sizing: border-box; border: 1px dashed #bbb; }
  .sku { font-size: 30px; font-weight: 800; letter-spacing: 1px; font-family: "Consolas", monospace; }
  .name { font-size: 14px; margin-top: 4px; }
  .meta { font-size: 12px; color: #555; margin-top: 6px; }
  @media print { .label { border: none; } }
</style></head><body>
  <div class="label">
    <div class="sku">${esc(sku)}</div>
    <div class="name">${esc(item.name)}</div>
    <div class="meta">${item.category ? esc(item.category) + ' · ' : ''}achat ${price}${item.quantity > 1 ? ` · ${item.remaining}/${item.quantity}` : ''}</div>
  </div>
  <script>window.onload = function(){ window.print(); }</script>
</body></html>`;
  const w = window.open('', '_blank', 'width=420,height=320');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
