'use client';

import { useState, useEffect, useRef, useCallback, Suspense, FormEvent } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { useSearchParams } from 'next/navigation';
import type { ResaleEstimate, AppSettings } from '@shopping-assistant/types';
import { Coins, ExternalLink, PackagePlus, Check, SearchX, Loader2 } from 'lucide-react';
import PageShell from '@/components/ui/PageShell';
import StatCard from '@/components/ui/StatCard';
import ErrorBanner from '@/components/ui/ErrorBanner';
import EmptyState from '@/components/ui/EmptyState';
import MarginCalculator from '@/components/MarginCalculator';
import ProductThumb from '@/components/ui/ProductThumb';
import { apiFetch } from '@/lib/api';
import { toast } from '@/lib/toast';
import { euro } from '@/lib/format';

const PLATFORMS = [
  { id: 'ebay', label: 'eBay' },
  { id: 'vinted', label: 'Vinted' },
  { id: 'leboncoin', label: 'Leboncoin' },
  { id: 'autre', label: 'Autre' },
];

function EstimateContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [price, setPrice] = useState(searchParams.get('price') ?? '');
  const [platform, setPlatform] = useState('ebay');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResaleEstimate | null>(null);
  const [added, setAdded] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const autoRan = useRef(false);

  useEffect(() => {
    apiFetch<AppSettings>('/settings').then(setSettings).catch(() => setSettings(null));
  }, []);

  const run = useCallback(async (q: string, p: string, plat: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setAdded(false);
    try {
      const data = await apiFetch<ResaleEstimate>('/estimate', {
        method: 'POST',
        json: { query: q.trim(), purchasePrice: p ? Number(p) : null, platform: plat },
      });
      setResult(data);
    } catch {
      setError(t('est.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q && !autoRan.current) {
      autoRan.current = true;
      run(q, searchParams.get('price') ?? '', 'ebay');
    } else if (!q && !autoRan.current) {
      // Pas de deep-link : on restaure la dernière requête saisie.
      try {
        const saved = localStorage.getItem('estimate-query');
        if (saved) setQuery(saved);
      } catch {
        /* ignore */
      }
    }
  }, [searchParams, run]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem('estimate-query', query.trim());
    } catch {
      /* ignore */
    }
    run(query, price, platform);
  };

  const addToStock = async () => {
    if (!result?.median) return;
    try {
      await apiFetch('/stock', {
        method: 'POST',
        json: {
          name: result.query,
          purchasePrice: result.purchasePrice ?? 0,
          quantity: 1,
          estimatedResale: result.median,
          notes: 'Ajouté depuis une estimation',
        },
      });
      setAdded(true);
      toast.success(t('est.added'));
    } catch {
      setError(t('est.errAdd'));
    }
  };

  return (
    <>
      <form
        onSubmit={submit}
        className="card-pad mb-6 grid gap-3 sm:grid-cols-[1fr_150px_140px_auto]"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('est.placeholder')}
          className="input"
          required
          maxLength={200}
        />
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder={t('est.purchasePrice')}
          className="input"
          min="0"
          step="0.01"
        />
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="input"
          title={t('deals.platformTitle')}
        >
          {PLATFORMS.map((p) => (
            <option key={p.id} value={p.id}>
              {t('est.salePrefix')} : {p.label}
            </option>
          ))}
        </select>
        <button type="submit" disabled={loading} className="btn-primary whitespace-nowrap">
          <Coins className="h-4 w-4" /> {t('est.estimate')}
        </button>
      </form>

      {loading && (
        <div className="card flex items-center justify-center gap-3 px-6 py-12 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
          {t('est.loading')}
        </div>
      )}

      {error && <ErrorBanner message={error} />}

      {!loading && result?.barcode && (
        <p className="mb-3 text-sm text-slate-400">
          {t('est.barcode')} <span className="font-mono text-slate-300">{result.barcode}</span> →{' '}
          <span className="text-accent">{result.query}</span>
        </p>
      )}

      {!loading && result && result.sampleCount === 0 && (
        <EmptyState
          icon={<SearchX className="h-6 w-6" />}
          title={t('est.noSales')}
          description={t('est.noSalesDesc')}
        />
      )}

      {!loading && result && result.sampleCount > 0 && result.median != null && (
        <div className="animate-rise space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              label={t('est.medianPrice')}
              value={euro(result.median)}
              sub={`${t('est.range')} ${euro(result.low ?? 0)} – ${euro(result.high ?? 0)}`}
              tone="accent"
            />
            <StatCard
              label={`${t('est.netSeller')} (${t('est.fees')} ~${Math.round((result.feeRate ?? 0) * 100)} %)`}
              value={euro(result.netEstimate ?? 0)}
              sub={`${result.sampleCount} ${t('est.salesAnalyzed')}`}
            />
            {result.estimatedProfit != null ? (
              <StatCard
                label={`${t('est.estProfit')} (${t('est.buyWord')} ${euro(result.purchasePrice ?? 0)})`}
                value={`${result.estimatedProfit >= 0 ? '+' : ''}${euro(result.estimatedProfit)}`}
                sub={`${t('est.margin')} ${result.marginPct ?? '—'} %`}
                tone={result.estimatedProfit >= 0 ? 'positive' : 'negative'}
              />
            ) : (
              <StatCard
                label={t('est.estProfit')}
                value="—"
                sub={t('est.enterPrice')}
              />
            )}
          </div>

          {(result.velocityLabel || result.confidenceLabel) && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {result.velocityLabel && (
                <span className="badge-info">
                  {t('est.sellsIn')} {result.velocityLabel}
                  {result.salesPer30d != null ? ` · ~${result.salesPer30d}${t('est.perMonth')}` : ''}
                  {result.avgDaysBetweenSales != null ? ` · ${t('est.oneSalePer')} ${result.avgDaysBetweenSales} j` : ''}
                </span>
              )}
              {result.confidenceLabel && (
                <span className="badge-muted">
                  {t('est.reliability')} {result.confidenceLabel}
                  {result.confidenceScore != null ? ` (${result.confidenceScore}/100)` : ''}
                </span>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button onClick={addToStock} disabled={added} className="btn-primary text-sm">
              {added ? <Check className="h-4 w-4" /> : <PackagePlus className="h-4 w-4" />}
              {added ? t('est.added') : t('est.addToStock')}
            </button>
            {added && (
              <Link href="/stock" className="btn-secondary text-sm">
                {t('est.viewStock')}
              </Link>
            )}
          </div>

          <div className="card-pad">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('est.soldAnalyzed')} — {result.source}
            </h2>
            <div className="space-y-0.5">
              {result.soldListings.map((l, i) => (
                <a
                  key={i}
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-[rgb(var(--overlay)/0.05)]"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <ProductThumb src={l.imageUrl} alt="" size="sm" />
                    <span className="truncate text-sm text-slate-300 group-hover:text-slate-100">
                      {l.title}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-semibold text-accent">{euro(l.price)}</span>
                    <ExternalLink className="h-3 w-3 text-slate-600" />
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6">
        <MarginCalculator settings={settings} />
      </div>
    </>
  );
}

export default function EstimatePage() {
  const { t } = useI18n();
  return (
    <PageShell
      title={t('page.estimate.title', 'Estimation de revente')}
      icon={<Coins className="h-6 w-6" />}
      subtitle={t('page.estimate.sub', 'Basée sur les ventes réellement conclues sur eBay — pas les prix affichés')}
    >
      <Suspense fallback={<div className="text-center text-sm text-slate-400">Chargement...</div>}>
        <EstimateContent />
      </Suspense>
    </PageShell>
  );
}
