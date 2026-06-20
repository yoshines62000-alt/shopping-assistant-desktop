'use client';

import type { FormEvent } from 'react';
import type { StockItem, StockStatus } from '@shopping-assistant/types';
import {
  TrendingUp,
  Tag,
  RefreshCw,
  Clock,
  Megaphone,
  Printer,
  ExternalLink,
  Trash2,
  Image as ImageIcon,
} from 'lucide-react';
import CrossListingPanel from '@/components/CrossListingPanel';
import StockPhotos from '@/components/StockPhotos';
import ProductThumb from '@/components/ui/ProductThumb';
import ContextMenu, { type ContextMenuItem } from '@/components/ui/ContextMenu';
import { printStockLabel } from '@/lib/label';
import { ageDays, isDormant, computeReprice } from '@/lib/resale';
import { euro, dateFr } from '@/lib/format';

export const STATUS_LABELS: Record<StockStatus, string> = {
  in_stock: 'En stock',
  listed: 'En vente',
  sold: 'Vendu',
};

export const STATUS_BADGES: Record<StockStatus, string> = {
  in_stock: 'badge-info',
  listed: 'badge-violet',
  sold: 'badge-muted',
};

export interface SellForm {
  quantity: string;
  unitPrice: string;
  fees: string;
  platform: string;
}

// Présentation de la suggestion de re-tarification (logique pure : lib/resale).
function repriceHint(item: StockItem): { label: string; cls: string } | null {
  const r = computeReprice(item);
  if (!r) return null;
  if (r.dir === 'down')
    return {
      label: `Marché en baisse ${r.movePct}% — repositionne à ~${euro(r.target)}`,
      cls: 'bg-amber-500/15 text-amber-300',
    };
  return {
    label: `Sous-coté +${r.movePct}% — tu peux monter à ~${euro(r.target)}`,
    cls: 'badge-success',
  };
}

export interface StockItemCardProps {
  item: StockItem;
  feeRate: number;
  sellingId: number | null;
  setSellingId: (id: number | null) => void;
  sellForm: SellForm;
  setSellForm: (f: SellForm) => void;
  onSell: (item: StockItem, e: FormEvent) => void;
  listingId: number | null;
  setListingId: (id: number | null) => void;
  photosId: number | null;
  setPhotosId: (id: number | null) => void;
  estimatingId: number | null;
  onSetStatus: (item: StockItem, status: StockStatus) => void;
  onReestimate: (item: StockItem) => void;
  onRemove: (item: StockItem) => void;
  onReload: () => void;
}

export default function StockItemCard({
  item,
  feeRate,
  sellingId,
  setSellingId,
  sellForm,
  setSellForm,
  onSell,
  listingId,
  setListingId,
  photosId,
  setPhotosId,
  estimatingId,
  onSetStatus,
  onReestimate,
  onRemove,
  onReload,
}: StockItemCardProps) {
  const unitNet = item.estimatedResale ? item.estimatedResale * (1 - feeRate) : null;
  const unitProfit = unitNet !== null ? unitNet - item.purchasePrice : null;
  const hint = repriceHint(item);

  const menuItems: ContextMenuItem[] = [
    ...(item.remaining > 0
      ? [{ label: 'Vendre', icon: <TrendingUp className="h-4 w-4" />, onClick: () => setSellingId(item.id) } as ContextMenuItem]
      : []),
    ...(item.remaining > 0 && item.status === 'in_stock'
      ? [{ label: 'Marquer en vente', icon: <Tag className="h-4 w-4" />, onClick: () => onSetStatus(item, 'listed') } as ContextMenuItem]
      : []),
    ...(item.status === 'listed'
      ? [{ label: 'Remettre en stock', icon: <Tag className="h-4 w-4" />, onClick: () => onSetStatus(item, 'in_stock') } as ContextMenuItem]
      : []),
    { label: 'Ré-estimer la revente', icon: <RefreshCw className="h-4 w-4" />, onClick: () => onReestimate(item) },
    { label: 'Générer une annonce', icon: <Megaphone className="h-4 w-4" />, onClick: () => setListingId(item.id) },
    { label: 'Gérer les photos', icon: <ImageIcon className="h-4 w-4" />, onClick: () => setPhotosId(item.id) },
    ...(item.sourceUrl
      ? [{ label: "Ouvrir l'annonce d'achat", icon: <ExternalLink className="h-4 w-4" />, onClick: () => window.open(item.sourceUrl, '_blank', 'noopener'), separatorBefore: true } as ContextMenuItem]
      : []),
    { label: 'Supprimer', icon: <Trash2 className="h-4 w-4" />, onClick: () => onRemove(item), danger: true, separatorBefore: !item.sourceUrl },
  ];

  return (
    <ContextMenu items={menuItems}>
      <article className="card-pad" aria-label={item.name}>
        <div className="flex items-start justify-between gap-3">
          <ProductThumb
            src={item.photos?.[0]}
            alt={item.name}
            onClick={() => setPhotosId(photosId === item.id ? null : item.id)}
          />
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-slate-100">{item.name}</h3>
              {item.sku && (
                <span className="font-mono text-xs text-slate-500" title="Code de rangement">
                  {item.sku}
                </span>
              )}
              <span className={STATUS_BADGES[item.status]}>{STATUS_LABELS[item.status]}</span>
              {item.category && <span className="badge-muted">{item.category}</span>}
              {isDormant(item) && (
                <span
                  className="badge bg-amber-500/15 text-amber-300"
                  title={`En stock depuis ${ageDays(item.purchaseDate)} jours`}
                >
                  <Clock className="h-3 w-3" /> Dormant · {ageDays(item.purchaseDate)} j
                </span>
              )}
              {hint && (
                <span className={`badge ${hint.cls}`} title="Suggestion de re-tarification">
                  <TrendingUp className="h-3 w-3" /> {hint.label}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400">
              Achat {euro(item.purchasePrice)}
              {item.quantity > 1 && (
                <>
                  {' '}
                  &middot; reste {item.remaining}/{item.quantity}
                </>
              )}{' '}
              &middot; {dateFr(item.purchaseDate)}
            </p>
            {item.estimatedResale != null && (
              <p className="mt-1 text-sm">
                <span className="text-accent">Revente estimée {euro(item.estimatedResale)}</span>
                {item.previousEstimate != null && item.previousEstimate !== item.estimatedResale && (
                  <span
                    className={item.estimatedResale > item.previousEstimate ? 'text-emerald-400' : 'text-rose-400'}
                    title={`Estimation précédente : ${euro(item.previousEstimate)}`}
                  >
                    {' '}
                    {item.estimatedResale > item.previousEstimate ? '↗' : '↘'}
                  </span>
                )}
                {unitProfit !== null && (
                  <span className={unitProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    {' '}
                    &middot; {unitProfit >= 0 ? '+' : ''}
                    {euro(unitProfit)} net/unité
                  </span>
                )}
                {item.estimatedAt && (
                  <span className="text-xs text-slate-500"> &middot; estimé le {dateFr(item.estimatedAt)}</span>
                )}
              </p>
            )}
            {item.notes && <p className="mt-1 text-xs text-slate-500">{item.notes}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button onClick={() => printStockLabel(item)} className="btn-ghost" title="Imprimer l'étiquette de rangement">
              <Printer className="h-4 w-4" />
            </button>
            {item.sourceUrl && (
              <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="btn-ghost" title="Annonce d'origine">
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
            <button
              onClick={() => onReestimate(item)}
              disabled={estimatingId === item.id}
              className="btn-ghost"
              title="Ré-estimer via les ventes eBay (~20 s)"
            >
              <RefreshCw className={`h-4 w-4 ${estimatingId === item.id ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={() => onRemove(item)} className="btn-ghost hover:!text-rose-300" title="Supprimer">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {item.remaining > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {sellingId !== item.id && (
              <button
                onClick={() => {
                  setSellingId(item.id);
                  setSellForm({
                    quantity: '1',
                    unitPrice: item.estimatedResale != null ? String(item.estimatedResale) : '',
                    fees: '0',
                    platform: 'eBay',
                  });
                }}
                className="btn-primary !px-3 !py-1.5 text-xs"
              >
                <TrendingUp className="h-4 w-4" /> Vendre
              </button>
            )}
            {item.status === 'in_stock' && (
              <button onClick={() => onSetStatus(item, 'listed')} className="btn-secondary !px-3 !py-1.5 text-xs">
                <Tag className="h-4 w-4" /> Marquer en vente
              </button>
            )}
            {item.status === 'listed' && (
              <button onClick={() => onSetStatus(item, 'in_stock')} className="btn-secondary !px-3 !py-1.5 text-xs">
                Remettre en stock
              </button>
            )}
            <button
              onClick={() => setListingId(listingId === item.id ? null : item.id)}
              className="btn-secondary !px-3 !py-1.5 text-xs"
              title="Générer un brouillon d'annonce eBay / Vinted / Leboncoin"
            >
              <Megaphone className="h-4 w-4" /> Annonce
            </button>
            <button
              onClick={() => setPhotosId(photosId === item.id ? null : item.id)}
              className="btn-secondary !px-3 !py-1.5 text-xs"
              title="Photos de l'objet"
            >
              <ImageIcon className="h-4 w-4" />
              {item.photos && item.photos.length > 0 ? ` ${item.photos.length}` : ' Photos'}
            </button>
          </div>
        )}

        {photosId === item.id && <StockPhotos item={item} onUpdated={onReload} />}

        {listingId === item.id && <CrossListingPanel item={item} onClose={() => setListingId(null)} />}

        {sellingId === item.id && (
          <form
            onSubmit={(e) => onSell(item, e)}
            className="mt-3 grid items-center gap-2 rounded-lg border border-line bg-ink/40 p-3 sm:grid-cols-5"
          >
            <input
              type="number"
              value={sellForm.quantity}
              onChange={(e) => setSellForm({ ...sellForm, quantity: e.target.value })}
              className="input"
              min="1"
              max={item.remaining}
              step="1"
              title="Quantité"
              required
            />
            <input
              type="number"
              value={sellForm.unitPrice}
              onChange={(e) => setSellForm({ ...sellForm, unitPrice: e.target.value })}
              className="input"
              placeholder="Prix unitaire (€)"
              min="0"
              step="0.01"
              required
            />
            <input
              type="number"
              value={sellForm.fees}
              onChange={(e) => setSellForm({ ...sellForm, fees: e.target.value })}
              className="input"
              placeholder="Frais (€)"
              min="0"
              step="0.01"
            />
            <input
              value={sellForm.platform}
              onChange={(e) => setSellForm({ ...sellForm, platform: e.target.value })}
              className="input"
              placeholder="Plateforme"
            />
            <div className="flex gap-1">
              <button type="submit" className="btn-primary flex-1 !px-3 !py-1.5 text-xs">
                OK
              </button>
              <button type="button" onClick={() => setSellingId(null)} className="btn-secondary !px-3 !py-1.5 text-xs">
                ✕
              </button>
            </div>
          </form>
        )}
      </article>
    </ContextMenu>
  );
}
