'use client';

import { useState, useEffect, FormEvent } from 'react';
import { ArrowLeftRight, ExternalLink, Loader2, SearchX } from 'lucide-react';
import type { ArbitrageResponse, ArbitragePair } from '@shopping-assistant/types';
import PageShell from '@/components/ui/PageShell';
import ErrorBanner from '@/components/ui/ErrorBanner';
import EmptyState from '@/components/ui/EmptyState';
import ProductThumb from '@/components/ui/ProductThumb';
import { apiFetch } from '@/lib/api';
import { euro } from '@/lib/format';

export default function ArbitragePage() {
  const [query, setQuery] = useState('');
  const [minMargin, setMinMargin] = useState('15');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ArbitrageResponse | null>(null);

  useEffect(() => {
    try {
      const q = localStorage.getItem('arbitrage-query');
      if (q) setQuery(q);
    } catch {
      /* ignore */
    }
  }, []);

  const run = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    try {
      localStorage.setItem('arbitrage-query', query.trim());
    } catch {
      /* ignore */
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await apiFetch<ArbitrageResponse>('/arbitrage', {
        method: 'POST',
        json: { query: query.trim(), minMarginPct: Number(minMargin) || 15 },
      });
      setResult(data);
    } catch {
      setError("Erreur pendant l'analyse. Vérifiez que le service est démarré.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell
      title="Arbitrage"
      icon={<ArrowLeftRight className="h-6 w-6" />}
      subtitle="Même produit moins cher d'un côté que de l'autre : achète bas, revends haut"
    >
      <form onSubmit={run} className="card-pad mb-6 grid gap-3 sm:grid-cols-[1fr_170px_auto]">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Produit à comparer entre plateformes (ex : airpods pro 2)"
          className="input"
          required
          maxLength={200}
        />
        <select
          value={minMargin}
          onChange={(e) => setMinMargin(e.target.value)}
          className="input"
          title="Marge minimale"
        >
          <option value="10">Marge mini 10 %</option>
          <option value="15">Marge mini 15 %</option>
          <option value="25">Marge mini 25 %</option>
          <option value="40">Marge mini 40 %</option>
        </select>
        <button type="submit" disabled={loading} className="btn-primary whitespace-nowrap">
          <ArrowLeftRight className="h-4 w-4" /> Comparer
        </button>
      </form>

      {loading && (
        <div className="card flex items-center justify-center gap-3 px-6 py-12 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
          Comparaison des plateformes... (~20 s)
        </div>
      )}

      {error && <ErrorBanner message={error} />}

      {!loading && result && result.pairs.length === 0 && (
        <EmptyState
          icon={<SearchX className="h-6 w-6" />}
          title="Aucun écart rentable"
          description="Pas de même produit trouvé sur 2 plateformes avec une marge suffisante. Essayez un libellé plus précis (marque + modèle) ou baissez le seuil de marge."
        />
      )}

      {!loading && result && result.pairs.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-slate-400">
            {result.pairs.length} opportunité{result.pairs.length > 1 ? 's' : ''}
            {' · sources : '}
            {result.sources_queried.join(', ') || '—'}
          </p>
          {result.pairs.map((p, i) => (
            <ArbitrageCard key={i} pair={p} index={i} />
          ))}
        </div>
      )}
    </PageShell>
  );
}

function ArbitrageCard({ pair, index = 0 }: { pair: ArbitragePair; index?: number }) {
  return (
    <article
      className="card-pad card-hover animate-rise"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <ProductThumb src={pair.buy.imageUrl ?? pair.sell.imageUrl} alt={pair.name} size="sm" />
          <h3 className="min-w-0 truncate font-semibold text-slate-100">{pair.name}</h3>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
          +{euro(pair.marginEur)} ({pair.marginPct} %)
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <OfferBox label="Acheter" offer={pair.buy} tone="buy" />
        <ArrowLeftRight className="mx-auto hidden h-4 w-4 shrink-0 text-slate-500 sm:block" />
        <OfferBox label="Revendre" offer={pair.sell} tone="sell" />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Marge nette après frais de revente (~{Math.round(pair.feeRate * 100)} %)
      </p>
    </article>
  );
}

function OfferBox({
  label,
  offer,
  tone,
}: {
  label: string;
  offer: ArbitragePair['buy'];
  tone: 'buy' | 'sell';
}) {
  return (
    <a
      href={offer.sourceUrl}
      target="_blank"
      rel="noreferrer"
      className="block rounded-lg border border-line bg-ink/40 p-3 transition-colors hover:bg-[rgb(var(--overlay)/0.05)]"
    >
      <div className="flex items-center justify-between text-xs">
        <span className={tone === 'buy' ? 'text-cyan-300' : 'text-amber-300'}>
          {label} · {offer.siteDomain}
        </span>
        <ExternalLink className="h-3 w-3 text-slate-600" />
      </div>
      <div className="mt-1 text-lg font-bold tracking-tight text-slate-50">{euro(offer.totalPrice)}</div>
      <div className="truncate text-xs text-slate-400">{offer.name}</div>
    </a>
  );
}
