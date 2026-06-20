'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { History, Trash2, ExternalLink, Download, Heart, Search, Coins, BarChart3, Copy } from 'lucide-react';
import PageShell from '@/components/ui/PageShell';
import EmptyState from '@/components/ui/EmptyState';
import ProductThumb from '@/components/ui/ProductThumb';
import ContextMenu, { type ContextMenuItem } from '@/components/ui/ContextMenu';
import { toast } from '@/lib/toast';
import { euro, dateFr } from '@/lib/format';

export default function ShoppingListPage() {
  const { shoppingList, removeFromShoppingList, clearShoppingList } = useAppStore();
  const router = useRouter();
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
    a.download = `favoris-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const total = shoppingList.reduce((sum, { product }) => sum + product.totalPrice, 0);
  const isEmpty = !mounted || shoppingList.length === 0;

  return (
    <PageShell
      title="Mes favoris"
      icon={<Heart className="h-6 w-6" />}
      subtitle={
        isEmpty
          ? undefined
          : `${shoppingList.length} favori${shoppingList.length > 1 ? 's' : ''} · total ${euro(total)}`
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
            icon={<Heart className="h-6 w-6" />}
            title="Aucun favori"
            description="Appuie sur le ♥ d'un résultat de recherche pour l'ajouter à tes favoris."
            action={
              <Link href="/search" className="btn-primary text-sm">
                <Search className="h-4 w-4" /> Rechercher
              </Link>
            }
          />
        )
      ) : (
        <div className="space-y-3">
          {shoppingList.map(({ product, addedAt }) => {
            const menuItems: ContextMenuItem[] = [
              {
                label: 'Estimer la revente',
                icon: <Coins className="h-4 w-4" />,
                onClick: () =>
                  router.push(`/estimate?q=${encodeURIComponent(product.name.slice(0, 80))}&price=${product.totalPrice}`),
              },
              {
                label: 'Comparer les sites',
                icon: <BarChart3 className="h-4 w-4" />,
                onClick: () => router.push(`/compare?q=${encodeURIComponent(product.name.slice(0, 80))}`),
              },
              {
                label: 'Historique & alertes',
                icon: <History className="h-4 w-4" />,
                onClick: () => router.push(`/products/${encodeURIComponent(product.id)}`),
              },
              {
                label: "Ouvrir l'annonce",
                icon: <ExternalLink className="h-4 w-4" />,
                onClick: () => window.open(product.sourceUrl, '_blank', 'noopener'),
                separatorBefore: true,
              },
              {
                label: 'Copier le lien',
                icon: <Copy className="h-4 w-4" />,
                onClick: () =>
                  navigator.clipboard?.writeText(product.sourceUrl).then(
                    () => toast.success('Lien copié'),
                    () => toast.error('Copie impossible')
                  ),
              },
              {
                label: 'Retirer des favoris',
                icon: <Trash2 className="h-4 w-4" />,
                onClick: () => removeFromShoppingList(product.id),
                danger: true,
                separatorBefore: true,
              },
            ];
            return (
            <ContextMenu key={product.id} items={menuItems}>
            <div className="card-pad card-hover">
              <div className="flex items-start justify-between gap-3">
                <ProductThumb src={product.imageUrl} alt={product.name} />
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
            </ContextMenu>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
