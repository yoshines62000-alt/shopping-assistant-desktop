'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { BarChart3, ExternalLink, ArrowUpDown } from 'lucide-react';
import type { Product } from '@shopping-assistant/types';
import { apiFetch } from '@/lib/api';
import PageShell from '@/components/ui/PageShell';
import SearchResults from '@/components/SearchResults';
import { euro } from '@/lib/format';
import { Suspense } from 'react';

function CompareContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query) return;
    setLoading(true);
    apiFetch<{ results?: Product[] }>('/search', { method: 'POST', json: { query } })
      .then((data) => setResults(data.results ?? []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [query]);

  // Group products by similar name for comparison table
  const grouped = results.reduce((acc, p) => {
    const key = p.name.toLowerCase().split(' ')[0];
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {} as Record<string, Product[]>);

  const comparisons = Object.entries(grouped).slice(0, 3).map(([key, items]) => ({
    name: key,
    items: [...items].sort((a, b) => (a.totalPrice ?? 0) - (b.totalPrice ?? 0)),
  }));

  return (
    <>
      {loading && <SearchResults products={[]} isLoading />}
      {!loading && (
        <div className="space-y-6">
          {comparisons.map((c) => (
            <div key={c.name} className="card-pad">
              <h3 className="mb-3 font-semibold text-slate-200">{c.items[0].name}</h3>
              
              {/* Comparison table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-line">
                    <tr className="text-slate-400">
                      <th className="pb-2 text-left">Site</th>
                      <th className="pb-2 text-right">Prix</th>
                      <th className="pb-2 text-right">Note</th>
                      <th className="pb-2 text-right">Délai</th>
                      <th className="pb-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.items.map((p) => (
                      <tr key={p.id} className="border-b border-line/50">
                        <td className="py-2 text-slate-300">{p.siteDomain}</td>
                        <td className="py-2 text-right font-medium text-slate-100">{euro(p.totalPrice)}</td>
                        <td className="py-2 text-right text-slate-400">{p.rating?.toFixed(1) ?? '—'}</td>
                        <td className="py-2 text-right text-slate-400">{p.deliveryDays ? `${p.deliveryDays}j` : '—'}</td>
                        <td className="py-2 text-center">
                          <a href={p.sourceUrl} target="_blank" rel="noreferrer" className="btn-secondary !px-2 !py-1 text-xs">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Best deal highlight */}
              {c.items.length > 1 && (
                <p className="mt-2 text-xs text-accent">
                  <ArrowUpDown className="inline h-3 w-3" /> Meilleur prix : {c.items[0].siteDomain} ({euro(c.items[0].totalPrice)})
                </p>
              )}
            </div>
          ))}
          {!loading && !query && <p className="text-slate-400">Entrez un produit à comparer via la recherche.</p>}
        </div>
      )}
    </>
  );
}

export default function ComparePage() {
  return (
    <PageShell
      title="Comparaison"
      icon={<BarChart3 className="h-6 w-6" />}
      subtitle="Comparaison prix entre sites"
    >
      <Suspense fallback={<div className="text-center text-sm text-slate-400">Chargement...</div>}>
        <CompareContent />
      </Suspense>
    </PageShell>
  );
}
