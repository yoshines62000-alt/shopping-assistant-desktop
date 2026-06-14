'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';
import Link from 'next/link';
import type { StockItem, StockStatus, ResaleEstimate, AppSettings } from '@shopping-assistant/types';
import {
  Package,
  Plus,
  Trash2,
  ExternalLink,
  TrendingUp,
  Tag,
  RefreshCw,
  Coins,
} from 'lucide-react';
import PageShell from '@/components/ui/PageShell';
import ErrorBanner from '@/components/ui/ErrorBanner';
import EmptyState from '@/components/ui/EmptyState';
import LoadingBlock from '@/components/ui/LoadingBlock';
import { apiFetch } from '@/lib/api';
import { toast } from '@/lib/toast';
import { euro, dateFr } from '@/lib/format';

const STATUS_LABELS: Record<StockStatus, string> = {
  in_stock: 'En stock',
  listed: 'En vente',
  sold: 'Vendu',
};

const STATUS_BADGES: Record<StockStatus, string> = {
  in_stock: 'badge-info',
  listed: 'badge-violet',
  sold: 'badge-muted',
};

interface SellForm {
  quantity: string;
  unitPrice: string;
  fees: string;
  platform: string;
}

export default function StockPage() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | StockStatus>('all');
  const [showForm, setShowForm] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // Formulaire d'ajout
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [estimated, setEstimated] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [notes, setNotes] = useState('');

  // Vente inline + ré-estimation
  const [sellingId, setSellingId] = useState<number | null>(null);
  const [sellForm, setSellForm] = useState<SellForm>({
    quantity: '1',
    unitPrice: '',
    fees: '0',
    platform: 'eBay',
  });
  const [estimatingId, setEstimatingId] = useState<number | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      const data = await apiFetch<AppSettings>('/settings');
      setSettings(data);
    } catch {
      setSettings(null);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ items?: StockItem[] }>('/stock');
      setItems(data.items ?? []);
      setError(null);
    } catch {
      setError('Impossible de charger le stock. Vérifiez que le service est démarré.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    load();
  }, [load, loadSettings]);

  // Utilise le taux de frais depuis les settings ou défaut 13%
  const feeRate = settings?.platformFees?.ebay ?? 0.13;

  const addItem = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/stock', {
        method: 'POST',
        json: {
          name,
          purchasePrice: Number(price),
          quantity: Number(quantity) || 1,
          estimatedResale: estimated ? Number(estimated) : null,
          sourceUrl,
          notes,
        },
      });
      setName('');
      setPrice('');
      setQuantity('1');
      setEstimated('');
      setSourceUrl('');
      setNotes('');
      setShowForm(false);
      load();
      toast.success('Objet ajouté au stock');
    } catch {
      setError("Impossible d'ajouter l'objet.");
    }
  };

  const sell = async (item: StockItem, e: FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch(`/stock/${item.id}/sell`, {
        method: 'POST',
        json: {
          quantity: Number(sellForm.quantity) || 1,
          unitPrice: Number(sellForm.unitPrice),
          fees: Number(sellForm.fees) || 0,
          platform: sellForm.platform,
        },
      });
      setSellingId(null);
      load();
      toast.success('Vente enregistrée');
    } catch {
      setError('Vente impossible (quantité supérieure au stock restant ?).');
    }
  };

  const setStatus = async (item: StockItem, status: StockStatus) => {
    await apiFetch(`/stock/${item.id}`, { method: 'PATCH', json: { status } }).catch(() => null);
    load();
  };

  const reestimate = async (item: StockItem) => {
    setEstimatingId(item.id);
    try {
      const data = await apiFetch<ResaleEstimate>('/estimate', {
        method: 'POST',
        json: { query: item.name, purchasePrice: item.purchasePrice },
      });
      if (data.median) {
        await apiFetch(`/stock/${item.id}`, {
          method: 'PATCH',
          json: { estimatedResale: data.median },
        });
        load();
      }
    } catch {
      setError("L'estimation a échoué.");
    } finally {
      setEstimatingId(null);
    }
  };

  const remove = async (item: StockItem) => {
    if (!window.confirm(`Supprimer « ${item.name} » et ses ventes associées ?`)) return;
    await apiFetch(`/stock/${item.id}`, { method: 'DELETE' }).catch(() => null);
    load();
  };

  const filtered = filter === 'all' ? items : items.filter((i) => i.status === filter);
  const totalRemaining = items.reduce((s, i) => s + i.remaining, 0);
  const stockValue = items.reduce((s, i) => s + i.remaining * i.purchasePrice, 0);
  const potentialNet = items.reduce(
    (s, i) => s + (i.estimatedResale ? i.remaining * i.estimatedResale * (1 - feeRate) : 0),
    0
  );

  return (
    <PageShell
      title="Mon stock"
      icon={<Package className="h-6 w-6" />}
      subtitle={`${totalRemaining} exemplaire(s) · valeur d'achat ${euro(stockValue)}${potentialNet > 0 ? ` · potentiel net ~${euro(potentialNet)}` : ''}`}
      actions={
        <button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm">
          <Plus className="h-4 w-4" /> Ajouter un objet
        </button>
      }
    >
      <div className="space-y-4">
        {showForm && (
          <form onSubmit={addItem} className="card-pad space-y-3">
            <h2 className="text-sm font-semibold text-slate-100">Nouvel objet</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nom de l'objet *"
                className="input sm:col-span-2"
                required
                maxLength={300}
              />
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Prix d'achat unitaire (€) *"
                className="input"
                min="0"
                step="0.01"
                required
              />
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Quantité"
                className="input"
                min="1"
                step="1"
              />
              <input
                type="number"
                value={estimated}
                onChange={(e) => setEstimated(e.target.value)}
                placeholder="Estimation revente unitaire (€)"
                className="input"
                min="0"
                step="0.01"
              />
              <input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="URL de l'annonce d'achat"
                className="input"
                type="url"
              />
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes (état, taille...)"
                className="input sm:col-span-2"
                maxLength={2000}
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary">
                Enregistrer
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                Annuler
              </button>
            </div>
          </form>
        )}

        <div className="flex flex-wrap gap-2">
          {(['all', 'in_stock', 'listed', 'sold'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`${filter === f ? 'btn-primary' : 'btn-secondary'} !px-3 !py-1 text-xs`}
            >
              {f === 'all'
                ? `Tous (${items.length})`
                : `${STATUS_LABELS[f]} (${items.filter((i) => i.status === f).length})`}
            </button>
          ))}
        </div>

        {error && <ErrorBanner message={error} />}
        {loading && <LoadingBlock label="Chargement du stock..." />}

        {!loading && filtered.length === 0 && !error && (
          <EmptyState
            icon={<Package className="h-6 w-6" />}
            title={items.length === 0 ? 'Aucun objet en stock' : 'Aucun objet pour ce filtre'}
            description={
              items.length === 0
                ? 'Ajoutez vos achats pour suivre vos reventes et vos bénéfices.'
                : undefined
            }
            action={
              items.length === 0 ? (
                <Link href="/estimate" className="btn-secondary text-sm">
                  <Coins className="h-4 w-4" /> Estimer un objet avant achat
                </Link>
              ) : undefined
            }
          />
        )}

        {!loading && filtered.length > 0 && (
          <>
            {filtered.map((item) => {
              const unitNet = item.estimatedResale ? item.estimatedResale * (1 - feeRate) : null;
              const unitProfit = unitNet !== null ? unitNet - item.purchasePrice : null;
              return (
                <article key={item.id} className="card-pad" aria-label={item.name}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-100">{item.name}</h3>
                        <span className={STATUS_BADGES[item.status]}>{STATUS_LABELS[item.status]}</span>
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
                          <span className="text-accent">
                            Revente estimée {euro(item.estimatedResale)}
                          </span>
                          {item.previousEstimate != null &&
                            item.previousEstimate !== item.estimatedResale && (
                              <span
                                className={
                                  item.estimatedResale > item.previousEstimate
                                    ? 'text-emerald-400'
                                    : 'text-rose-400'
                                }
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
                            <span className="text-xs text-slate-500">
                              {' '}
                              &middot; estimé le {dateFr(item.estimatedAt)}
                            </span>
                          )}
                        </p>
                      )}
                      {item.notes && <p className="mt-1 text-xs text-slate-500">{item.notes}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {item.sourceUrl && (
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-ghost"
                          title="Annonce d'origine"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      <button
                        onClick={() => reestimate(item)}
                        disabled={estimatingId === item.id}
                        className="btn-ghost"
                        title="Ré-estimer via les ventes eBay (~20 s)"
                      >
                        <RefreshCw
                          className={`h-4 w-4 ${estimatingId === item.id ? 'animate-spin' : ''}`}
                        />
                      </button>
                      <button
                        onClick={() => remove(item)}
                        className="btn-ghost hover:!text-rose-300"
                        title="Supprimer"
                      >
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
                              unitPrice:
                                item.estimatedResale != null ? String(item.estimatedResale) : '',
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
                        <button
                          onClick={() => setStatus(item, 'listed')}
                          className="btn-secondary !px-3 !py-1.5 text-xs"
                        >
                          <Tag className="h-4 w-4" /> Marquer en vente
                        </button>
                      )}
                      {item.status === 'listed' && (
                        <button
                          onClick={() => setStatus(item, 'in_stock')}
                          className="btn-secondary !px-3 !py-1.5 text-xs"
                        >
                          Remettre en stock
                        </button>
                      )}
                    </div>
                  )}

                  {sellingId === item.id && (
                    <form
                      onSubmit={(e) => sell(item, e)}
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
                        <button
                          type="button"
                          onClick={() => setSellingId(null)}
                          className="btn-secondary !px-3 !py-1.5 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    </form>
                  )}
                </article>
              );
            })}
          </>
        )}
      </div>
    </PageShell>
  );
}