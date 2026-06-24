'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Product } from '@shopping-assistant/types';
import {
  TrendingDown,
  Clock,
  Star,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Coins,
  BarChart3,
  Heart,
  Bell,
  Copy,
  Target,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useFavorites, migrateLocalFavorites } from '@/lib/favorites';
import ScoreDetails from '@/components/ScoreDetails';
import DealAnalysis from '@/components/DealAnalysis';
import ProductThumb from '@/components/ui/ProductThumb';
import ContextMenu, { type ContextMenuItem } from '@/components/ui/ContextMenu';
import { euro } from '@/lib/format';
import { apiFetch } from '@/lib/api';
import { toast } from '@/lib/toast';

interface Props {
  products: Product[];
  isLoading: boolean;
}

function getBadge(score: number) {
  if (score >= 90) return { label: 'TOP', cls: 'badge-info' };
  if (score >= 75) return { label: 'BON', cls: 'badge-violet' };
  return { label: 'OK', cls: 'badge-muted' };
}

function PriceSparkline({ prices }: { prices: number[] }) {
  if (!prices || prices.length === 0) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const trend = prices.length > 1 && prices[prices.length - 1] < prices[0] ? 'down' : 'up';
  const strokeColor = trend === 'down' ? '#22d3ee' : '#fbbf24';

  const points = prices
    .slice(0, 10)
    .map((p, i) => {
      const x = (i / 9) * 40;
      const y = 12 - ((p - min) / range) * 12;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width="42" height="14" viewBox="0 0 42 14" role="img" aria-label="Historique prix">
      <polyline fill="none" stroke={strokeColor} strokeWidth="1.5" points={points} />
    </svg>
  );
}

function ProductSkeleton() {
  return (
    <div className="card-pad pointer-events-none">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="skeleton h-5 w-3/4" />
          <div className="skeleton h-4 w-1/2" />
        </div>
        <div className="skeleton h-10 w-24" />
      </div>
      <div className="mt-4 flex justify-between">
        <div className="skeleton h-4 w-32" />
        <div className="skeleton h-8 w-24" />
      </div>
    </div>
  );
}

export default function SearchResults({ products, isLoading }: Props) {
  const { watchList, addToWatchList, removeFromWatchList } = useAppStore();
  const { favoriteIds, loaded, load, toggle: toggleFavorite, addWithTarget } = useFavorites();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<'score' | 'priceAsc' | 'priceDesc' | 'delivery' | 'rating'>('score');
  const router = useRouter();

  // « Favori + prix cible » : on suggère -10 % et on alerte si le prix repasse dessous.
  const favoriteWithTarget = (p: Product) => {
    const suggested = Math.round(p.totalPrice * 0.9 * 100) / 100;
    const raw = window.prompt(
      `Prix cible pour « ${p.name.slice(0, 60)} » ?\nTu seras notifié si le prix passe sous ce seuil.`,
      String(suggested)
    );
    if (raw == null) return;
    const target = Number(raw.replace(',', '.'));
    if (!Number.isFinite(target) || target <= 0) {
      toast.error('Prix cible invalide');
      return;
    }
    addWithTarget(p, target);
    toast.success(`Favori ajouté · cible ${euro(target)}`);
  };

  // Favoris persistés côté backend : migration des anciens favoris locaux + chargement.
  useEffect(() => {
    if (!loaded) migrateLocalFavorites().then(load);
  }, [loaded, load]);

  const watchedIds = useMemo(() => new Set(watchList.map((w) => w.productId)), [watchList]);

  // Le cœur « surveille » réellement le prix : il crée une alerte backend
  // (seuil à -10 %) qui notifiera Discord si le prix baisse, et la supprime au
  // retrait. Les favoris deviennent ainsi de vraies alertes visibles sur /alerts.
  const toggleWatch = async (p: Product) => {
    const existing = watchList.find((w) => w.productId === p.id);
    if (existing) {
      if (existing.alertId) {
        await apiFetch(`/alerts/${existing.alertId}`, { method: 'DELETE' }).catch(() => null);
      }
      removeFromWatchList(p.id);
      toast.info('Surveillance retirée');
      return;
    }
    const threshold = Math.round(p.totalPrice * 0.9 * 100) / 100;
    try {
      const res = await apiFetch<{ alertId?: string }>('/alerts', {
        method: 'POST',
        json: { productId: p.id, thresholdPrice: threshold, channels: ['discord'] },
      });
      addToWatchList(p.id, threshold, res.alertId);
      toast.success(`Surveillé — alerte si le prix passe sous ${euro(threshold)}`);
    } catch {
      toast.error('Impossible de créer la surveillance');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4" aria-label="Chargement des résultats">
        {[...Array(3)].map((_, i) => (
          <ProductSkeleton key={i} />
        ))}
      </div>
    );
  }

  const sorted = [...products].sort((a, b) => {
    if (sortKey === 'priceAsc') return a.totalPrice - b.totalPrice;
    if (sortKey === 'priceDesc') return b.totalPrice - a.totalPrice;
    if (sortKey === 'delivery') return (a.deliveryDays ?? 9999) - (b.deliveryDays ?? 9999);
    if (sortKey === 'rating') return (b.rating ?? 0) - (a.rating ?? 0);
    return (b.scores?.final ?? 0) - (a.scores?.final ?? 0);
  });
  const avgScore = sorted.length > 0 ? sorted.reduce((sum, p) => sum + (p.scores?.final ?? 0), 0) / sorted.length : 0;

  return (
    <div className="space-y-4" aria-label={`${sorted.length} résultats de recherche`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-400">
          {sorted.length} résultat{sorted.length > 1 ? 's' : ''} &middot; score moyen{' '}
          {avgScore.toFixed(0)}/100
        </p>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
          className="input !w-auto !py-1 text-xs"
          title="Trier les résultats"
          aria-label="Trier les résultats"
        >
          <option value="score">Pertinence</option>
          <option value="priceAsc">Prix croissant</option>
          <option value="priceDesc">Prix décroissant</option>
          <option value="delivery">Livraison rapide</option>
          <option value="rating">Mieux notés</option>
        </select>
      </div>

      {sorted.map((p, idx) => {
        const badge = getBadge(p.scores?.final ?? 0);
        const inList = favoriteIds.has(p.id);
        const isWatched = watchedIds.has(p.id);
        const expanded = expandedId === p.id;
        const menuItems: ContextMenuItem[] = [
          {
            label: inList ? 'Retirer des favoris' : 'Ajouter aux favoris',
            icon: <Heart className={`h-4 w-4 ${inList ? 'fill-rose-500 text-rose-500' : ''}`} />,
            onClick: () => toggleFavorite(p),
          },
          ...(inList
            ? []
            : [
                {
                  label: 'Favori + prix cible…',
                  icon: <Target className="h-4 w-4" />,
                  onClick: () => favoriteWithTarget(p),
                },
              ]),
          {
            label: isWatched ? 'Retirer la surveillance' : 'Surveiller le prix',
            icon: <Bell className="h-4 w-4" />,
            onClick: () => toggleWatch(p),
          },
          {
            label: 'Estimer la revente',
            icon: <Coins className="h-4 w-4" />,
            onClick: () =>
              router.push(`/estimate?q=${encodeURIComponent(p.name.slice(0, 80))}&price=${p.totalPrice}`),
          },
          {
            label: 'Comparer les sites',
            icon: <BarChart3 className="h-4 w-4" />,
            onClick: () => router.push(`/compare?q=${encodeURIComponent(p.name.slice(0, 80))}`),
          },
          {
            label: 'Historique & alertes',
            icon: <TrendingDown className="h-4 w-4" />,
            onClick: () => router.push(`/products?id=${encodeURIComponent(p.id)}`),
          },
          {
            label: "Ouvrir l'annonce",
            icon: <ExternalLink className="h-4 w-4" />,
            onClick: () => window.open(p.sourceUrl, '_blank', 'noopener'),
            separatorBefore: true,
          },
          {
            label: 'Copier le lien',
            icon: <Copy className="h-4 w-4" />,
            onClick: () => {
              navigator.clipboard?.writeText(p.sourceUrl).then(
                () => toast.success('Lien copié'),
                () => toast.error('Copie impossible')
              );
            },
          },
        ];
        return (
          <ContextMenu key={p.id} items={menuItems}>
          <article
            className="card-pad card-hover animate-rise"
            style={{ animationDelay: `${Math.min(idx, 8) * 55}ms` }}
            aria-label={p.name}
          >
            <div className="flex items-start justify-between gap-4">
              <ProductThumb src={p.imageUrl} alt={p.name} />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-slate-100">{p.name}</h3>
                  <span className={badge.cls}>{badge.label}</span>
                </div>
                <p className="text-xs text-slate-500">
                  {p.seller && p.seller !== p.siteDomain ? `${p.seller} · ` : ''}
                  {p.siteDomain}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-2xl font-bold tracking-tight text-slate-50">
                  {euro(p.totalPrice)}
                </p>
                <p className="text-xs text-slate-500">TTC</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-5 text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-accent" />
                  {p.deliveryDays != null ? `${p.deliveryDays} j` : '—'}
                </span>
                <span className="flex items-center gap-1.5">
                  <Star className="h-4 w-4 text-amber-400" />
                  {p.rating?.toFixed(1) ?? '—'}
                  <span className="text-slate-600">({p.reviewCount ?? 0})</span>
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggleFavorite(p)}
                  className="btn-ghost !px-1.5 !py-1 text-xs"
                  title={inList ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  aria-pressed={inList}
                >
                  <Heart
                    className={`h-4 w-4 transition-colors ${inList ? 'fill-rose-500 text-rose-500' : 'text-slate-400'}`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => toggleWatch(p)}
                  className="btn-ghost !px-1.5 !py-1 text-xs"
                  title={isWatched ? 'Retirer la surveillance du prix' : 'Surveiller le prix (alerte)'}
                  aria-pressed={isWatched}
                >
                  <Bell
                    className={`h-3.5 w-3.5 ${isWatched ? 'fill-accent text-accent' : 'text-slate-400'}`}
                  />
                </button>
                <Link
                  href={`/estimate?q=${encodeURIComponent(p.name.slice(0, 80))}&price=${p.totalPrice}`}
                  className="btn-ghost text-amber-300/90 hover:text-amber-200"
                  title="Estimer le prix de revente"
                  aria-label="Estimer le prix de revente"
                >
                  <Coins className="h-4 w-4" />
                </Link>
                <Link
                  href={`/products?id=${encodeURIComponent(p.id)}`}
                  className="btn-ghost"
                  aria-label="Voir historique et alertes"
                >
                  <TrendingDown className="h-4 w-4" />
                </Link>
                <Link
                  href={`/compare?q=${encodeURIComponent(p.name.slice(0, 80))}`}
                  className="btn-ghost"
                  aria-label="Comparer ce produit sur d'autres sites"
                >
                  <BarChart3 className="h-4 w-4" />
                </Link>
                {p.raw?.priceHistory && p.raw.priceHistory.length > 0 && (
                  <div className="ml-1">
                    <PriceSparkline prices={p.raw.priceHistory} />
                  </div>
                )}
                <a
                  href={p.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-ghost"
                  aria-label="Voir l'offre sur le site marchand"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>

            {p.scores && (
              <div className="mt-4">
                <div className="score-track">
                  <div
                    className="score-fill"
                    style={{ width: `${Math.max(0, Math.min(100, p.scores.final))}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>Score {p.scores.final}/100</span>
                  <button
                    onClick={() => setExpandedId(expanded ? null : p.id)}
                    className="flex items-center gap-1 text-accent transition-colors hover:text-cyan-300"
                    aria-expanded={expanded}
                  >
                    Détails
                    {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                </div>
                {expanded && (
                  <div className="mt-3">
                    <ScoreDetails scores={p.scores} />
                  </div>
                )}
              </div>
            )}

            <DealAnalysis name={p.name} purchasePrice={p.totalPrice} />
          </article>
          </ContextMenu>
        );
      })}
    </div>
  );
}