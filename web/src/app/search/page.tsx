'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, SearchX, Download } from 'lucide-react';
import type { Product, IntentParams } from '@shopping-assistant/types';
import SearchForm from '@/components/SearchForm';
import SearchResults from '@/components/SearchResults';
import ShareSearch from '@/components/ShareSearch';
import ExportReport from '@/components/ExportReport';
import PushNotify from '@/components/PushNotify';
import PageShell from '@/components/ui/PageShell';
import ErrorBanner from '@/components/ui/ErrorBanner';
import EmptyState from '@/components/ui/EmptyState';
import { apiFetch } from '@/lib/api';

// Filtres <-> URL : rend les recherches partageables et persistantes au reload.
function buildSearchUrl(q: string, intent: IntentParams | null): string {
  const sp = new URLSearchParams({ q });
  if (intent) {
    if (intent.minPriceEur != null) sp.set('min', String(intent.minPriceEur));
    if (intent.maxPriceEur != null) sp.set('max', String(intent.maxPriceEur));
    if (intent.maxDeliveryDays != null) sp.set('days', String(intent.maxDeliveryDays));
    if (intent.minRating != null) sp.set('rating', String(intent.minRating));
    if (intent.priority && intent.priority !== 'balanced') sp.set('priority', intent.priority);
    if (intent.site) sp.set('site', intent.site);
  }
  return sp.toString();
}

function parseIntentFromParams(sp: URLSearchParams): IntentParams | null {
  const num = (k: string): number | null => {
    const v = sp.get(k);
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const minPriceEur = num('min');
  const maxPriceEur = num('max');
  const maxDeliveryDays = num('days');
  const minRating = num('rating');
  const priority = (sp.get('priority') as IntentParams['priority']) || undefined;
  const site = sp.get('site') || undefined;
  if (
    minPriceEur == null && maxPriceEur == null && maxDeliveryDays == null &&
    minRating == null && !priority && !site
  ) {
    return null;
  }
  return { query: sp.get('q') || '', minPriceEur, maxPriceEur, maxDeliveryDays, minRating, priority, site };
}

function SearchContent() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<'score' | 'price' | 'delivery'>('score');
  const [page, setPage] = useState(1);
  const router = useRouter();
  const searchParams = useSearchParams();
  const lastSearched = useRef('');
  const lastIntent = useRef<IntentParams | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const PER_PAGE = 20;

  const doSearch = useCallback(async (q: string, intent: IntentParams | null = null, pageNum = 1) => {
    lastSearched.current = q;
    lastIntent.current = intent; // conserve les filtres pour la pagination
    setQuery(q);
    setPage(pageNum);
    // Annule une recherche precedente encore en vol : evite qu'une reponse
    // tardive ecrase des resultats plus recents.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ results?: Product[] }>('/search', {
        method: 'POST',
        json: { query: q, maxResults: PER_PAGE, offset: (pageNum - 1) * PER_PAGE, ...(intent ?? {}) },
        signal: controller.signal,
      });
      setResults(data.results ?? []);
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return; // remplacee par une recherche plus recente
      setError('Erreur lors de la recherche. Vérifiez que le service est démarré.');
      setResults([]);
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const q = searchParams.get('q') || '';
    if (q && q !== lastSearched.current) {
      doSearch(q, parseIntentFromParams(searchParams));
    }
  }, [searchParams, doSearch]);

  const handleSearch = (q: string, intent?: IntentParams | null) => {
    router.replace(`/search?${buildSearchUrl(q, intent ?? null)}`, { scroll: false });
    doSearch(q, intent ?? null, 1);
  };

  const handleExport = () => {
    if (results.length === 0) return;
    const csv = [
      ['Nom', 'Prix', 'Site', 'Note', 'Avis', 'Délai'],
      ...results.map((p) => [
        p.name.replace(/"/g, '""'),
        p.totalPrice.toFixed(2),
        p.siteDomain,
        p.rating?.toFixed(1) ?? '',
        p.reviewCount?.toString() ?? '',
        p.deliveryDays?.toString() ?? '',
      ]),
    ].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recherche-${query.slice(0, 30)}.csv`.replace(/\s+/g, '-');
    a.click();
    URL.revokeObjectURL(url);
  };

  const sorted = [...results].sort((a, b) => {
    if (sortKey === 'price') return (a.totalPrice ?? 0) - (b.totalPrice ?? 0);
    if (sortKey === 'delivery') return (a.deliveryDays ?? 999) - (b.deliveryDays ?? 999);
    return (b.scores?.final ?? 0) - (a.scores?.final ?? 0);
  });

  return (
    <>
      <div className="card-pad mb-6">
        <SearchForm
          initialQuery={searchParams.get('q') ?? ''}
          initialFilters={{
            minPrice: searchParams.get('min') ?? '',
            maxPrice: searchParams.get('max') ?? '',
            maxDays: searchParams.get('days') ?? '',
            minRating: searchParams.get('rating') ?? '',
            site: searchParams.get('site') ?? 'all',
            priority: searchParams.get('priority') ?? 'balanced',
          }}
          onSearch={handleSearch}
        />
      </div>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {loading && <SearchResults products={[]} isLoading />}

      {!loading && results.length > 0 && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Trier par :</span>
              <button
                type="button"
                onClick={() => setSortKey('score')}
                className={`btn-ghost !px-2 !py-1 text-xs ${sortKey === 'score' ? 'text-accent' : ''}`}
              >
                Score
              </button>
              <button
                type="button"
                onClick={() => setSortKey('price')}
                className={`btn-ghost !px-2 !py-1 text-xs ${sortKey === 'price' ? 'text-accent' : ''}`}
              >
                Prix
              </button>
              <button
                type="button"
                onClick={() => setSortKey('delivery')}
                className={`btn-ghost !px-2 !py-1 text-xs ${sortKey === 'delivery' ? 'text-accent' : ''}`}
              >
                Délai
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExport}
                className="btn-secondary !px-2 !py-1 text-xs"
                title="Exporter les résultats en CSV"
              >
                <Download className="h-3 w-3" />
                Export CSV
              </button>
              <ExportReport products={sorted} query={query} />
              <PushNotify />
              <ShareSearch />
            </div>
          </div>
          <SearchResults products={sorted} isLoading={false} />

          {results.length >= PER_PAGE && (
            <div className="mt-6 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (page > 1) doSearch(query, lastIntent.current, page - 1);
                }}
                disabled={page <= 1}
                className="btn-secondary !px-3 !py-1.5 text-xs disabled:opacity-50"
              >
                ← Précédent
              </button>
              <span className="flex items-center px-3 text-xs text-slate-400">Page {page}</span>
              <button
                type="button"
                onClick={() => doSearch(query, lastIntent.current, page + 1)}
                className="btn-secondary !px-3 !py-1.5 text-xs"
              >
                Suivant →
              </button>
            </div>
          )}
        </>
      )}

      {!loading && !error && results.length === 0 && query && (
        <EmptyState
          icon={<SearchX className="h-6 w-6" />}
          title="Aucun résultat"
          description="Essayez une autre requête ou ajustez les filtres."
        />
      )}
    </>
  );
}

export default function SearchPage() {
  return (
    <PageShell
      title="Recherche"
      icon={<Search className="h-6 w-6" />}
      subtitle="Offres réelles Amazon.fr et eBay.fr, triées par score"
    >
      <Suspense fallback={<div className="text-center text-sm text-slate-400">Chargement...</div>}>
        <SearchContent />
      </Suspense>
    </PageShell>
  );
}