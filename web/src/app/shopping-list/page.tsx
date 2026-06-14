'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { History, Trash2, ExternalLink, Download, ShoppingCart, Search } from 'lucide-react';
import PageShell from '@/components/ui/PageShell';
import EmptyState from '@/components/ui/EmptyState';
import { euro, dateFr } from '@/lib/format';

export default function ShoppingListPage() {
  const { shoppingList, removeFromShoppingList, clearShoppingList } = useAppStore();
  // La liste vient du localStorage : on attend le montage pour éviter
  // un mismatch d'hydratation entre le HTML serveur et le client.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const exportCSV = () => {
    if (shoppingList.length === 0) return;

    const header = 'Nom,Prix (€),Site,Vendeur,Date ajout\n';
    const rows = shoppingList
      .map(
        ({ product, addedAt }) =>
          `"${product.name.replace(/"/g, '""')}",${product.totalPrice},${product.siteDomain},"${product.seller ?? ''}","${dateFr(addedAt)}"`
      )
      .join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shopping-list-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const total = shoppingList.reduce((sum, { product }) => sum + product.totalPrice, 0);
  const isEmpty = !mounted || shoppingList.length === 0;

  return (
    <PageShell
      title="Ma liste"
      icon={<ShoppingCart className="h-6 w-6" />}
      subtitle={
        isEmpty
          ? undefined
          : `${shoppingList.length} article${shoppingList.length > 1 ? 's' : ''} · total ${euro(total)}`
      }
      actions={
        isEmpty ? undefined : (
          <>
            <button onClick={exportCSV} className="btn-secondary text-sm">
              <Download className="h-4 w-4" /> Export CSV
            </button>
            <button onClick={clearShoppingList} className="btn-danger text-sm">
              Vider
            </button>
          </>
        )
      }
    >
      {isEmpty ? (
        mounted && (
          <EmptyState
            icon={<ShoppingCart className="h-6 w-6" />}
            title="Liste vide"
            description="Ajoutez des produits depuis la recherche pour les retrouver ici."
            action={
              <Link href="/search" className="btn-primary text-sm">
                <Search className="h-4 w-4" /> Rechercher
              </Link>
            }
          />
        )
      ) : (
        <div className="space-y-3">
          {shoppingList.map(({ product, addedAt }) => (
            <div key={product.id} className="card-pad">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-slate-100">{product.name}</h3>
                  <p className="text-sm text-slate-400">
                    {product.siteDomain} &middot; {euro(product.totalPrice)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Ajouté le {dateFr(addedAt)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Link
                    href={`/products/${encodeURIComponent(product.id)}`}
                    className="btn-ghost"
                    title="Historique de prix"
                  >
                    <History className="h-4 w-4" />
                  </Link>
                  <a
                    href={product.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-ghost"
                    title="Voir l'offre"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <button
                    onClick={() => removeFromShoppingList(product.id)}
                    className="btn-ghost hover:!text-rose-300"
                    title="Retirer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
