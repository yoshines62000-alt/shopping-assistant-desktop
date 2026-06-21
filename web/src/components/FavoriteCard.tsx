'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Favorite, FavoriteList } from '@shopping-assistant/types';
import {
  ExternalLink,
  Coins,
  BarChart3,
  Bell,
  Trash2,
  Star,
  Truck,
  Tag as TagIcon,
  Check,
  Target,
  RefreshCw,
  ArrowDownRight,
  ArrowUpRight,
  CheckSquare,
  Square,
} from 'lucide-react';
import ProductThumb from '@/components/ui/ProductThumb';
import { apiFetch } from '@/lib/api';
import { toast } from '@/lib/toast';
import { euro, relativeTime } from '@/lib/format';

/** Mini-graphe du prix au fil des rafraîchissements (le plus ancien à gauche). */
function Sparkline({ prices }: { prices: number[] }) {
  if (prices.length < 2) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const w = 64;
  const h = 18;
  const pts = prices
    .map((p, i) => `${(i / (prices.length - 1)) * w},${h - ((p - min) / range) * h}`)
    .join(' ');
  const down = prices[prices.length - 1] <= prices[0];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Historique du prix">
      <polyline
        fill="none"
        stroke={down ? '#34d399' : '#fb7185'}
        strokeWidth="1.5"
        strokeLinejoin="round"
        points={pts}
      />
    </svg>
  );
}

export default function FavoriteCard({
  fav,
  lists,
  onChanged,
  onRemoved,
  selected = false,
  onToggleSelect,
}: {
  fav: Favorite;
  lists: FavoriteList[];
  onChanged: (updated: Favorite) => void;
  onRemoved: (id: number) => void;
  selected?: boolean;
  onToggleSelect?: (id: number) => void;
}) {
  const [notes, setNotes] = useState(fav.notes);
  const [target, setTarget] = useState(fav.targetPrice != null ? String(fav.targetPrice) : '');
  const [tagsOpen, setTagsOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const canRefresh = /amazon\.|ebay\./i.test(fav.sourceUrl);

  const refreshPrice = async () => {
    setRefreshing(true);
    try {
      const res = await apiFetch<{ status: string; oldPrice?: number; favorite: Favorite }>(
        `/favorites/${fav.id}/refresh-price`,
        { method: 'POST' }
      );
      onChanged(res.favorite);
      if (res.status === 'changed' && res.oldPrice != null) {
        const diff = res.favorite.price - res.oldPrice;
        toast.success(`Prix mis à jour : ${euro(res.oldPrice)} → ${euro(res.favorite.price)} (${diff < 0 ? '' : '+'}${euro(diff)})`);
      } else if (res.status === 'same') {
        toast.info('Prix inchangé');
      } else {
        toast.info('Prix indisponible pour ce site');
      }
    } catch {
      toast.error('Rafraîchissement impossible');
    } finally {
      setRefreshing(false);
    }
  };

  const patch = async (body: Record<string, unknown>) => {
    try {
      const updated = await apiFetch<Favorite>(`/favorites/${fav.id}`, { method: 'PATCH', json: body });
      onChanged(updated);
    } catch {
      toast.error('Enregistrement impossible');
    }
  };

  const remove = async () => {
    onRemoved(fav.id);
    await apiFetch(`/favorites/${fav.id}`, { method: 'DELETE' }).catch(() => null);
  };

  const toggleTag = (listId: number) => {
    const next = fav.listIds.includes(listId)
      ? fav.listIds.filter((id) => id !== listId)
      : [...fav.listIds, listId];
    patch({ listIds: next });
  };

  const watch = async () => {
    const threshold = fav.targetPrice ?? Math.round(fav.price * 0.9 * 100) / 100;
    try {
      await apiFetch('/alerts', {
        method: 'POST',
        json: { productId: fav.productId, thresholdPrice: threshold, channels: ['discord'] },
      });
      toast.success(`Surveillé — alerte si le prix passe sous ${euro(threshold)}`);
    } catch {
      toast.error('Surveillance impossible');
    }
  };

  // Évolution depuis le dernier rafraîchissement.
  const priceDelta =
    fav.previousPrice != null ? Math.round((fav.price - fav.previousPrice) * 100) / 100 : null;
  const checkedAgo = fav.priceCheckedAt ? relativeTime(fav.priceCheckedAt) : null;

  // Écart prix actuel vs prix cible perso.
  const gap =
    fav.targetPrice && fav.targetPrice > 0
      ? Math.round(((fav.price - fav.targetPrice) / fav.targetPrice) * 100)
      : null;

  const tagChips = fav.listIds
    .map((id) => lists.find((l) => l.id === id))
    .filter((l): l is FavoriteList => !!l);

  return (
    <article
      className={`card-pad card-hover ${selected ? 'ring-2 ring-accent' : ''}`}
      aria-label={fav.name}
    >
      <div className="flex gap-3">
        {onToggleSelect && (
          <button
            onClick={() => onToggleSelect(fav.id)}
            className="mt-0.5 shrink-0 self-start text-slate-400 hover:text-accent"
            title={selected ? 'Désélectionner' : 'Sélectionner'}
            aria-pressed={selected}
          >
            {selected ? (
              <CheckSquare className="h-4 w-4 text-accent" />
            ) : (
              <Square className="h-4 w-4" />
            )}
          </button>
        )}
        <ProductThumb src={fav.imageUrl} alt={fav.name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-slate-100">{fav.name}</h3>
            <div className="shrink-0 text-right">
              <span className="text-lg font-bold tracking-tight text-slate-50">{euro(fav.price)}</span>
              {priceDelta != null && priceDelta !== 0 && (
                <span
                  className={`mt-0.5 flex items-center justify-end gap-0.5 text-xs ${priceDelta < 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                  title={`Avant : ${euro(fav.previousPrice!)}`}
                >
                  {priceDelta < 0 ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                  {priceDelta < 0 ? '' : '+'}{euro(priceDelta)}
                </span>
              )}
            </div>
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span>{fav.siteDomain}</span>
            {fav.rating != null && (
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 text-amber-400" /> {fav.rating.toFixed(1)}
                {fav.reviewCount != null && <span className="text-slate-600"> ({fav.reviewCount})</span>}
              </span>
            )}
            {fav.deliveryDays != null && (
              <span className="flex items-center gap-1">
                <Truck className="h-3 w-3" /> {fav.deliveryDays} j
              </span>
            )}
            {fav.seller && <span className="truncate">· {fav.seller}</span>}
          </p>

          {/* Étiquettes (listes) */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {tagChips.map((l) => (
              <span
                key={l.id}
                className="badge-muted"
                style={l.color ? { color: l.color, backgroundColor: `${l.color}22` } : undefined}
              >
                {l.name}
              </span>
            ))}
            <div className="relative">
              <button
                onClick={() => setTagsOpen((o) => !o)}
                className="btn-ghost !px-2 !py-0.5 text-xs"
                title="Ranger dans des listes"
              >
                <TagIcon className="h-3.5 w-3.5" /> Listes
              </button>
              {tagsOpen && (
                <div
                  className="absolute z-20 mt-1 w-52 rounded-lg border border-line-strong bg-surface p-1 shadow-card-hover"
                  style={{ boxShadow: 'var(--shadow-card-hover)' }}
                >
                  {lists.length === 0 && (
                    <p className="px-2 py-1.5 text-xs text-slate-500">Crée d&apos;abord une liste.</p>
                  )}
                  {lists.map((l) => {
                    const on = fav.listIds.includes(l.id);
                    return (
                      <button
                        key={l.id}
                        onClick={() => toggleTag(l.id)}
                        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm text-slate-200 hover:bg-[rgb(var(--overlay)/0.06)]"
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: l.color || 'rgb(var(--c-accent))' }}
                          />
                          {l.name}
                        </span>
                        {on && <Check className="h-4 w-4 text-accent" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Prix cible perso + écart */}
      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3">
        <label className="flex items-center gap-1.5 text-xs text-slate-400">
          <Target className="h-3.5 w-3.5 text-accent" /> Prix cible
          <input
            type="number"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            onBlur={() => patch({ targetPrice: target === '' ? null : Number(target) })}
            placeholder="—"
            className="input !w-24 !py-1 text-sm"
            min="0"
            step="0.01"
          />
        </label>
        {gap != null && (
          <span className={`badge ${gap <= 0 ? 'badge-success' : 'bg-amber-500/15 text-amber-300'}`}>
            {gap <= 0 ? `${Math.abs(gap)}% sous ta cible` : `+${gap}% au-dessus`}
          </span>
        )}
        {fav.priceHistory.length >= 2 && (
          <span className="ml-auto flex items-center gap-1.5" title={`Historique : ${fav.priceHistory.map((p) => euro(p)).join(' → ')}`}>
            <Sparkline prices={fav.priceHistory} />
          </span>
        )}
      </div>

      {/* Note personnelle */}
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => notes !== fav.notes && patch({ notes })}
        placeholder="Note perso (taille, état recherché, rappel…)"
        className="input mt-2 text-sm"
        maxLength={2000}
      />

      {/* Actions */}
      <div className="mt-3 flex flex-wrap items-center gap-1">
        <a href={fav.sourceUrl} target="_blank" rel="noreferrer" className="btn-ghost text-xs" title="Voir l'offre">
          <ExternalLink className="h-3.5 w-3.5" /> Voir l&apos;offre
        </a>
        <Link
          href={`/estimate?q=${encodeURIComponent(fav.name.slice(0, 80))}&price=${fav.price}`}
          className="btn-ghost text-xs text-amber-300/90 hover:text-amber-200"
          title="Estimer la revente"
        >
          <Coins className="h-3.5 w-3.5" /> Estimer
        </Link>
        <Link
          href={`/compare?q=${encodeURIComponent(fav.name.slice(0, 80))}`}
          className="btn-ghost text-xs"
          title="Comparer les sites"
        >
          <BarChart3 className="h-3.5 w-3.5" />
        </Link>
        <button onClick={watch} className="btn-ghost text-xs" title="Surveiller le prix (alerte)">
          <Bell className="h-3.5 w-3.5" />
        </button>
        {canRefresh && (
          <button
            onClick={refreshPrice}
            disabled={refreshing}
            className="btn-ghost text-xs disabled:opacity-50"
            title="Rafraîchir le prix actuel"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        )}
        {checkedAgo && <span className="text-[11px] text-slate-600">Prix {checkedAgo}</span>}
        <button onClick={remove} className="btn-ghost text-xs hover:!text-rose-300 ml-auto" title="Retirer des favoris">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </article>
  );
}
