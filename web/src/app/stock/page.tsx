'use client';

import { useState, useEffect, useCallback, useRef, FormEvent } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import type { StockItem, StockStatus, ResaleEstimate, AppSettings } from '@shopping-assistant/types';
import { Package, Plus, Coins, Clock, Download, Upload, Search } from 'lucide-react';
import StockItemCard, { STATUS_LABELS, type SellForm } from '@/components/StockItemCard';
import PageShell from '@/components/ui/PageShell';
import StatCard from '@/components/ui/StatCard';
import ErrorBanner from '@/components/ui/ErrorBanner';
import EmptyState from '@/components/ui/EmptyState';
import LoadingBlock from '@/components/ui/LoadingBlock';
import { apiFetch } from '@/lib/api';
import { toast } from '@/lib/toast';
import { downloadCSV, parseCSV } from '@/lib/csv';
import { isDormant, DORMANT_DAYS } from '@/lib/resale';
import { euro } from '@/lib/format';


export default function StockPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | StockStatus>('all');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'value' | 'name' | 'dormant'>('recent');
  const [showForm, setShowForm] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // Formulaire d'ajout
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [estimated, setEstimated] = useState('');
  const [category, setCategory] = useState('');
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
  const [listingId, setListingId] = useState<number | null>(null);
  const [photosId, setPhotosId] = useState<number | null>(null);
  const csvInput = useRef<HTMLInputElement>(null);

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
      setError(t('stock.errLoad'));
    } finally {
      setLoading(false);
    }
  }, [t]);

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
          category: category.trim(),
          sourceUrl,
          notes,
        },
      });
      setName('');
      setPrice('');
      setQuantity('1');
      setEstimated('');
      setCategory('');
      setSourceUrl('');
      setNotes('');
      setShowForm(false);
      load();
      toast.success(t('stock.added'));
    } catch {
      setError(t('stock.errAdd'));
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
      toast.success(t('stock.saleRecorded'));
    } catch {
      setError(t('stock.errSale'));
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
      setError(t('stock.errEstimate'));
    } finally {
      setEstimatingId(null);
    }
  };

  const remove = async (item: StockItem) => {
    if (!window.confirm(t('stock.confirmDelete'))) return;
    await apiFetch(`/stock/${item.id}`, { method: 'DELETE' }).catch(() => null);
    load();
  };

  const exportCSV = () => {
    downloadCSV(
      `stock-${new Date().toISOString().split('T')[0]}.csv`,
      ['Nom', "Prix d'achat", 'Quantité', 'Restant', 'Statut', 'Revente estimée', "Date d'achat", 'Notes'],
      items.map((i) => [
        i.name,
        i.purchasePrice,
        i.quantity,
        i.remaining,
        STATUS_LABELS[i.status],
        i.estimatedResale ?? '',
        i.purchaseDate.split('T')[0],
        i.notes,
      ])
    );
  };

  const importCSV = async (file: File) => {
    try {
      const rows = parseCSV(await file.text());
      let ok = 0;
      for (const r of rows) {
        const name = (r['Nom'] || r['name'] || '').trim();
        const purchasePrice = Number((r["Prix d'achat"] || r['purchasePrice'] || '').replace(',', '.'));
        if (!name || !purchasePrice) continue;
        await apiFetch('/stock', {
          method: 'POST',
          json: {
            name,
            purchasePrice,
            quantity: Number(r['Quantité'] || r['quantity'] || 1) || 1,
            estimatedResale: r['Revente estimée'] ? Number(String(r['Revente estimée']).replace(',', '.')) : null,
            notes: r['Notes'] || r['notes'] || 'Importé CSV',
          },
        }).then(() => ok++).catch(() => null);
      }
      toast.success(`${ok} ${t('stock.imported')}`);
      load();
    } catch {
      setError(t('stock.errImport'));
    } finally {
      if (csvInput.current) csvInput.current.value = '';
    }
  };

  const ageDays = (i: StockItem) => (Date.now() - new Date(i.purchaseDate).getTime()) / 86_400_000;
  const filtered = (filter === 'all' ? items : items.filter((i) => i.status === filter))
    .filter((i) => {
      const q = query.trim().toLowerCase();
      return !q || i.name.toLowerCase().includes(q) || (i.sku ?? '').toLowerCase().includes(q);
    })
    .slice()
    .sort((a, b) => {
      if (sortBy === 'value') return b.remaining * b.purchasePrice - a.remaining * a.purchasePrice;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'dormant') return ageDays(b) - ageDays(a); // plus anciens d'abord
      return b.id - a.id; // récents (id croissant ≈ ordre d'ajout)
    });
  const totalRemaining = items.reduce((s, i) => s + i.remaining, 0);
  const stockValue = items.reduce((s, i) => s + i.remaining * i.purchasePrice, 0);
  const dormantItems = items.filter((i) => isDormant(i)); // pas (isDormant) : filter passerait l'index comme 2e arg (days)
  const dormantValue = dormantItems.reduce((s, i) => s + i.remaining * i.purchasePrice, 0);
  const potentialNet = items.reduce(
    (s, i) => s + (i.estimatedResale ? i.remaining * i.estimatedResale * (1 - feeRate) : 0),
    0
  );

  return (
    <PageShell
      title={t('page.stock.title', 'Mon stock')}
      icon={<Package className="h-6 w-6" />}
      subtitle={`${totalRemaining} ${t('stock.statUnits')} · ${t('stock.statPurchaseValue')} ${euro(stockValue)}${potentialNet > 0 ? ` · ${t('stock.statPotentialNet')} ~${euro(potentialNet)}` : ''}`}
      actions={
        <button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm">
          <Plus className="h-4 w-4" /> {t('stock.addItem')}
        </button>
      }
    >
      <div className="space-y-4">
        {showForm && (
          <form onSubmit={addItem} className="card-pad space-y-3">
            <h2 className="text-sm font-semibold text-slate-100">{t('stock.newItem')}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('stock.fName')}
                className="input sm:col-span-2"
                required
                maxLength={300}
              />
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={t('stock.fUnitPrice')}
                className="input"
                min="0"
                step="0.01"
                required
              />
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={t('stock.fQuantity')}
                className="input"
                min="1"
                step="1"
              />
              <input
                type="number"
                value={estimated}
                onChange={(e) => setEstimated(e.target.value)}
                placeholder={t('stock.fEstResale')}
                className="input"
                min="0"
                step="0.01"
              />
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder={t('stock.fCategory')}
                className="input"
                maxLength={100}
                list="stock-categories"
              />
              <datalist id="stock-categories">
                {Array.from(new Set(items.map((i) => i.category).filter(Boolean))).map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder={t('stock.fPurchaseUrl')}
                className="input"
                type="url"
              />
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('stock.fNotes')}
                className="input sm:col-span-2"
                maxLength={2000}
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary">
                {t('common.save')}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                {t('common.cancel')}
              </button>
            </div>
          </form>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'in_stock', 'listed', 'sold'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`${filter === f ? 'btn-primary' : 'btn-secondary'} !px-3 !py-1 text-xs`}
            >
              {f === 'all'
                ? `${t('stock.all')} (${items.length})`
                : `${t(f === 'in_stock' ? 'stock.statusInStock' : f === 'listed' ? 'stock.statusListed' : 'stock.statusSold')} (${items.filter((i) => i.status === f).length})`}
            </button>
          ))}
          <span className="mx-1 hidden h-4 w-px bg-line sm:inline-block" />
          <button
            onClick={exportCSV}
            disabled={items.length === 0}
            className="btn-secondary !px-3 !py-1 text-xs"
            title={t('stock.exportTitle')}
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
          <button
            onClick={() => csvInput.current?.click()}
            className="btn-secondary !px-3 !py-1 text-xs"
            title={t('stock.importTitle')}
          >
            <Upload className="h-3.5 w-3.5" /> {t('stock.import')}
          </button>
          <input
            ref={csvInput}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importCSV(f);
            }}
          />
        </div>

        {items.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('stock.searchPlaceholder')}
                className="input !pl-9"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="input !w-auto"
              title={t('stock.sort')}
            >
              <option value="recent">{t('stock.sortRecent')}</option>
              <option value="value">{t('stock.sortValue')}</option>
              <option value="dormant">{t('stock.sortOldest')}</option>
              <option value="name">{t('stock.sortName')}</option>
            </select>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="animate-fade-in grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label={t('stock.statUnits')} value={String(totalRemaining)} />
            <StatCard label={t('stock.statPurchaseValue')} value={euro(stockValue)} />
            <StatCard
              label={t('stock.statPotentialNet')}
              value={potentialNet > 0 ? `~${euro(potentialNet)}` : '—'}
              tone="accent"
            />
            <StatCard
              label={t('stock.statDormant')}
              value={String(dormantItems.length)}
              sub={dormantValue > 0 ? `${euro(dormantValue)} ${t('stock.immobilized')}` : t('stock.none')}
              tone={dormantItems.length > 0 ? 'negative' : 'default'}
            />
          </div>
        )}

        {!loading && dormantItems.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            <Clock className="h-4 w-4 shrink-0" />
            <span>
              {dormantItems.length} {t('stock.dormantWord')} (&gt; {DORMANT_DAYS} {t('stock.days')}) ·{' '}
              {euro(dormantValue)} {t('stock.immobilized')} — {t('stock.sellThem')}.
            </span>
          </div>
        )}

        {error && <ErrorBanner message={error} />}
        {loading && <LoadingBlock label={t('stock.loading')} />}

        {!loading && filtered.length === 0 && !error && (
          <EmptyState
            icon={<Package className="h-6 w-6" />}
            title={items.length === 0 ? t('stock.emptyAll') : t('stock.emptyFilter')}
            description={items.length === 0 ? t('stock.emptyDesc') : undefined}
            action={
              items.length === 0 ? (
                <Link href="/estimate" className="btn-secondary text-sm">
                  <Coins className="h-4 w-4" /> {t('stock.estimateBeforeBuy')}
                </Link>
              ) : undefined
            }
          />
        )}

        {!loading && filtered.length > 0 && (
          <>
            {filtered.map((item) => (
              <StockItemCard
                key={item.id}
                item={item}
                feeRate={feeRate}
                sellingId={sellingId}
                setSellingId={setSellingId}
                sellForm={sellForm}
                setSellForm={setSellForm}
                onSell={sell}
                listingId={listingId}
                setListingId={setListingId}
                photosId={photosId}
                setPhotosId={setPhotosId}
                estimatingId={estimatingId}
                onSetStatus={setStatus}
                onReestimate={reestimate}
                onRemove={remove}
                onReload={load}
              />
            ))}
          </>
        )}
      </div>
    </PageShell>
  );
}