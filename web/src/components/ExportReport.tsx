'use client';

import { FileDown } from 'lucide-react';
import type { Product } from '@shopping-assistant/types';
import { euro } from '@/lib/format';

interface Props {
  products: Product[];
  query?: string;
}

export default function ExportReport({ products, query = '' }: Props) {
  const handleExport = () => {
    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Rapport recherche - ${query}</title>
        <style>
          body { font-family: system-ui, sans-serif; padding: 2rem; background: #0a0e17; color: #e2e8f0; }
          h1 { color: #06b6d4; }
          table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
          th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #334155; }
          th { color: #94a3b8; font-weight: 500; }
          .badge-top { background: #06b6d4; color: #0a0e17; padding: 2px 6px; border-radius: 9999px; font-size: 10px; }
          .badge-good { background: #8b5cf6; color: #0a0e17; padding: 2px 6px; border-radius: 9999px; font-size: 10px; }
        </style>
      </head>
      <body>
        <h1>Rapport recherche : ${query}</h1>
        <p>${products.length} résultats • ${new Date().toLocaleDateString('fr-FR')}</p>
        <table>
          <thead>
            <tr><th>Produit</th><th>Prix</th><th>Note</th><th>Délai</th><th>Site</th></tr>
          </thead>
          <tbody>
            ${products.map((p) => `
            <tr>
              <td>${p.name}</td>
              <td>${euro(p.totalPrice)}</td>
              <td>${p.rating?.toFixed(1) ?? '—'}</td>
              <td>${p.deliveryDays ? p.deliveryDays + 'j' : '—'}</td>
              <td>${p.siteDomain}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        <script>window.onload = () => { window.print(); }</script>
      </body>
      </html>
    `;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(content);
      win.document.close();
    }
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={products.length === 0}
      className="btn-secondary !px-2 !py-1 text-xs disabled:opacity-50"
      title="Exporter rapport détaillé (PDF)"
    >
      <FileDown className="h-3 w-3" />
      Rapport
    </button>
  );
}