'use client';

import { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { useRouter } from 'next/navigation';
import type { Deal, DealsResponse } from '@shopping-assistant/types';
import { Sparkles, ExternalLink, Coins, Loader2, SearchX, Copy, BarChart3 } from 'lucide-react';
import PageShell from '@/components/ui/PageShell';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import ProductThumb from '@/components/ui/ProductThumb';
import ContextMenu, { type ContextMenuItem } from '@/components/ui/ContextMenu';
import { apiFetch } from '@/lib/api';
import { toast } from '@/lib/toast';
import { euro } from '@/lib/format';

const PLATFORMS = [
  { id: 'ebay', label: 'eBay' },
  { id: 'vinted', label: 'Vinted' },
  { id: 'leboncoin', label: 'Leboncoin' },
];

function verdict(pct: number | null): { label: string; cls: string } | null {
  if (pct == null) return null;
  if (pct >= 30) return { label: 'TOP AFFAIRE', cls: 'badge-success' };
  if (pct >= 10) return { label: 'Bonne marge', cls: 'badge-info' };
  if (pct >= 0) return { label: 'Marge faible', cls: 'badge-muted' };
  return { label: 'Perte probable', cls: 'badge bg-rose-500/15 text-rose-300' };
}

function DealCard({ deal, index = 0 }: { deal: Deal; index?: number }) {
  const r = deal.resale;
  const v = verdict(r?.marginPct ?? null);
  const router = useRouter();
  const menuItems: ContextMenuItem[] = [
    {
      label: 'Estimer la revente',
      icon: <Coins className="h-4 w-4" />,
      onClick: () =>
        router.push(`/estimate?q=${encodeURIComponent(deal.name.slice(0, 80))}&price=${deal.totalPrice}`),
    },
    {
      label: 'Comparer les sites',
      icon: <BarChart3 className="h-4 w-4" />,
      onClick: () => router.push(`/compare?q=${encodeURIComponent(deal.name.slice(0, 80))}`),
    },
    {
      label: "Ouvrir l'annonce",
      icon: <ExternalLink className="h-4 w-4" />,
      onClick: () => window.open(deal.sourceUrl, '_blank', 'noopener'),
      separatorBefore: true,
    },
    {
      label: 'Copier le lien',
      icon: <Copy className="h-4 w-4" />,
      onClick: () =>
        navigator.clipboard?.writeText(deal.sourceUrl).then(
          () => toast.success('Lien copié'),
          () => toast.error('Copie impossible')
        ),
    },
  ];
  return (
    <ContextMenu items={menuItems}>
    <article
      className="card-pad card-hover animate-rise"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <div className="flex items-start justify-between gap-4">
        <ProductThumb src={deal.imageUrl} alt={deal.name} />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            {v && <span className={v.cls}>{v.label}</span>}
            <h3 className="truncate font-semibold text-slate-100">{deal.name}</h3>
          </div>
          <p className="text-xs text-slate-500">
            Achat <span className="text-slate-300">{euro(deal.totalPrice)}</span>
            {deal.seller && deal.seller !== deal.siteDomain ? ` · ${deal.seller}` : ''} · {deal.siteDomain}
          </p>
        </div>
        <div className="shrink-0 text-right">
{r ? (
             <>
               <p
                 className={`text-2xl font-bold tracking-tight ${(r.marginEur ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
               >
                 {(r.marginEur ?? 0) >= 0 ? '+' : ''}
                 {euro(r.marginEur)}
               </p>
               <p className="text-xs text-slate-500">
                 marge nette{r.marginPct != null ? ` · ${r.marginPct}%` : ''}
               </p>
             </>
           ) : (
            <p className="text-xs leading-tight text-slate-500">
              revente
              <br />
              non estimée
            </p>
          )}
        </div>
      </div>

      {r && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3 text-xs text-slate-400">
          <span>
            Revente médiane ~<span className="font-semibold text-slate-200">{euro(r.median)}</span>
          </span>
<span>
             net vendeur <span className="font-semibold text-slate-200">{euro(r.netEstimate ?? 0)}</span>
           </span>
          <span className="text-slate-600">· {r.sampleCount} ventes analysées</span>
        </div>
      )}

      <div className="mt-3 flex items-center gap-1">
        <a
          href={deal.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="btn-ghost text-xs"
          aria-label="Voir l'offre"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Voir l&apos;offre
        </a>
        <Link
          href={`/estimate?q=${encodeURIComponent(deal.name.slice(0, 80))}&price=${deal.totalPrice}`}
          className="btn-ghost text-xs text-amber-300/90 hover:text-amber-200"
        >
          <Coins className="h-3.5 w-3.5" /> Détail revente
        </Link>
      </div>
    </article>
    </ContextMenu>
  );
}

export default function DealsPage() {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [analyze, setAnalyze] = useState('3');
  const [platform, setPlatform] = useState('ebay');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DealsResponse | null>(null);

  // Mémorise la dernière requête / plateforme (confort entre sessions).
  useEffect(() => {
    try {
      const q = localStorage.getItem('deals-query');
      const p = localStorage.getItem('deals-platform');
      if (q) setQuery(q);
      if (p) setPlatform(p);
    } catch {
      /* ignore */
    }
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    try {
      localStorage.setItem('deals-query', query.trim());
      localStorage.setItem('deals-platform', platform);
    } catch {
      /* ignore */
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await apiFetch<DealsResponse>('/deals', {
        method: 'POST',
        json: { query: query.trim(), maxResults: Number(analyze), platform },
      });
      setResult(data);
    } catch {
      setError('Analyse impossible. Vérifie que le service est démarré.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell
      title={t('page.deals.title', 'Bonnes affaires')}
      icon={<Sparkles className="h-6 w-6" />}
      subtitle={t('page.deals.sub', "Tape ce que tu cherches : l'app trouve les offres et estime automatiquement leur revente, classées par marge")}
    >
      <form onSubmit={submit} className="card-pad mb-6 grid gap-3 sm:grid-cols-[1fr_130px_130px_auto]">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ex : lego star wars, casque sony, console rétro..."
          className="input"
          required
          maxLength={200}
        />
        <select
          value={analyze}
          onChange={(e) => setAnalyze(e.target.value)}
          className="input"
          title="Nombre d'offres à analyser (plus = plus long)"
        >
          <option value="3">3 offres</option>
          <option value="5">5 offres</option>
        </select>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="input"
          title="Plateforme de revente visée (frais appliqués)"
        >
          {PLATFORMS.map((p) => (
            <option key={p.id} value={p.id}>
              Revente : {p.label}
            </option>
          ))}
        </select>
        <button type="submit" disabled={loading} className="btn-primary whitespace-nowrap">
          <Sparkles className="h-4 w-4" /> Chasser
        </button>
      </form>

      {loading && (
        <div className="card flex items-center justify-center gap-3 px-6 py-12 text-center text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
          Recherche des offres et analyse de leur revente sur eBay… (~30 s)
        </div>
      )}

      {error && <ErrorBanner message={error} />}

      {!loading && result && result.deals.length === 0 && (
        <EmptyState
          icon={<SearchX className="h-6 w-6" />}
          title="Aucune offre trouvée"
          description={`Pas d'offre exploitable pour « ${result.query} ». Essaie un libellé plus générique.`}
        />
      )}

      {!loading && result && result.deals.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            {result.deals.length} offre{result.deals.length > 1 ? 's' : ''} analysée
            {result.deals.length > 1 ? 's' : ''} · classées par marge nette de revente
          </p>
          {result.deals.map((d, i) => (
            <DealCard key={d.id} deal={d} index={i} />
          ))}
          <p className="text-center text-xs text-slate-600">
            Marge = revente nette estimée (médiane des ventes eBay réussies, frais déduits) − prix
            d&apos;achat de l&apos;offre.
          </p>
        </div>
      )}
    </PageShell>
  );
}
