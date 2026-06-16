'use client';

import { useState, useEffect, ChangeEvent } from 'react';
import { Bell, History, ExternalLink, TrendingDown, TrendingUp } from 'lucide-react';
import type { ProductInfo } from '@shopping-assistant/types';
import EmptyState from '@/components/ui/EmptyState';
import Sparkline from '@/components/ui/Sparkline';
import PriceChart from '@/components/PriceChart';
import { apiFetch } from '@/lib/api';
import { toast } from '@/lib/toast';
import { euro } from '@/lib/format';

interface PriceHistoryPoint {
  price: number;
  connector: string;
  ts: number;
}

export default function ProductHistory({ productId }: { productId: string }) {
  const [history, setHistory] = useState<PriceHistoryPoint[]>([]);
  const [info, setInfo] = useState<ProductInfo | null>(null);
  const [threshold, setThreshold] = useState('');

  useEffect(() => {
    apiFetch<{ history?: PriceHistoryPoint[] }>(
      `/products/${encodeURIComponent(productId)}/history`
    )
      .then((data) => setHistory(data.history ?? []))
      .catch(() => setHistory([]));
    apiFetch<ProductInfo>(`/products/${encodeURIComponent(productId)}`)
      .then(setInfo)
      .catch(() => setInfo(null));
  }, [productId]);

  const createAlert = async () => {
    if (!threshold || Number(threshold) <= 0) {
      toast.error('Indiquez un prix cible valide');
      return;
    }
    try {
      await apiFetch('/alerts', {
        method: 'POST',
        json: { productId, thresholdPrice: Number(threshold), channels: ['discord'] },
      });
      toast.success('Alerte créée — notification Discord si le prix baisse');
      setThreshold('');
    } catch {
      toast.error('Erreur lors de la création de l’alerte');
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => setThreshold(e.target.value);

  // L'API renvoie l'historique du plus récent au plus ancien
  const chronological = [...history].sort((a, b) => a.ts - b.ts);
  const currentPrice = chronological[chronological.length - 1]?.price;
  const firstPrice = chronological[0]?.price;
  const trendPct =
    chronological.length >= 2 && firstPrice && firstPrice > 0 && currentPrice != null
      ? Math.round(((currentPrice - firstPrice) / firstPrice) * 100)
      : null;

  // Indicateur "bon moment pour acheter" : position du prix actuel dans la
  // fourchette observee. Proche du plus bas -> bon moment ; proche du plus haut -> cher.
  const prices = chronological.map((h) => h.price).filter((p) => p > 0);
  const minPrice = prices.length ? Math.min(...prices) : null;
  const maxPrice = prices.length ? Math.max(...prices) : null;
  const buyHint =
    prices.length >= 3 && currentPrice != null && minPrice != null && maxPrice != null && maxPrice > minPrice
      ? currentPrice <= minPrice * 1.03
        ? { label: 'Bon moment — proche du plus bas', cls: 'badge-success' }
        : currentPrice >= maxPrice * 0.97
          ? { label: 'Prix élevé — proche du plus haut', cls: 'bg-rose-500/15 text-rose-300' }
          : null
      : null;

  return (
    <div className="space-y-4">
      {info && (info.name || info.sourceUrl) && (
        <div className="card-pad flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-100">{info.name || 'Produit'}</h2>
            <p className="text-xs text-slate-500">{info.siteDomain}</p>
          </div>
          {info.sourceUrl && (
            <a
              href={info.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary shrink-0 text-xs"
            >
              <ExternalLink className="h-4 w-4" /> Voir l&apos;offre
            </a>
          )}
        </div>
      )}

      {history.length === 0 ? (
        <EmptyState
          icon={<History className="h-6 w-6" />}
          title="Pas d'historique"
          description="Ce produit n'a pas encore d'historique de prix enregistré. Tu peux quand même créer une alerte ci-dessous."
        />
      ) : (
        <div className="card-pad">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Historique des prix
            </h2>
            <div className="flex items-center gap-2">
              {buyHint && (
                <span className={`badge ${buyHint.cls}`} title="Position du prix actuel dans la fourchette observée">
                  {buyHint.label}
                </span>
              )}
              {trendPct != null && trendPct !== 0 && (
                <span
                  className={`badge ${trendPct < 0 ? 'badge-success' : 'bg-amber-500/15 text-amber-300'}`}
                  title="Variation depuis le premier prix observé"
                >
                  {trendPct < 0 ? (
                    <TrendingDown className="h-3 w-3" />
                  ) : (
                    <TrendingUp className="h-3 w-3" />
                  )}
                  {trendPct > 0 ? '+' : ''}
                  {trendPct}%
                </span>
              )}
            </div>
          </div>
          {chronological.length >= 3 ? (
            <div className="mb-4">
              <PriceChart points={chronological.map((h) => ({ price: h.price, ts: h.ts }))} />
            </div>
          ) : chronological.length === 2 ? (
            <div className="mb-4">
              <Sparkline values={chronological.map((h) => h.price)} />
            </div>
          ) : null}
          <div className="space-y-0.5">
            {chronological
              .slice(-10)
              .reverse()
              .map((entry, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-white/5"
                >
                  <span className="text-sm text-slate-400">
                    {new Date(entry.ts * 1000).toLocaleString('fr-FR')}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-100">{euro(entry.price)}</span>
                    <span className="badge-muted">{entry.connector}</span>
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="card-pad">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Créer une alerte
        </h2>
        {currentPrice != null && (
          <p className="mb-3 text-sm text-slate-400">
            Prix actuel : <span className="font-semibold text-accent">{euro(currentPrice)}</span>
          </p>
        )}
        <div className="flex gap-2">
          <input
            type="number"
            value={threshold}
            onChange={handleChange}
            placeholder="Prix cible (€)"
            className="input flex-1"
            min="0"
            step="0.01"
          />
          <button onClick={createAlert} className="btn-primary">
            <Bell className="h-4 w-4" /> Alerter
          </button>
        </div>
      </div>
    </div>
  );
}
