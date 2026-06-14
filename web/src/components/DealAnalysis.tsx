'use client';

import { useState } from 'react';
import { TrendingUp, Loader2 } from 'lucide-react';
import type { ResaleEstimate } from '@shopping-assistant/types';
import { apiFetch } from '@/lib/api';
import { euro } from '@/lib/format';

/**
 * Croise le prix d'achat d'une offre avec l'estimation de revente eBay pour
 * dire, en un clic, si c'est une bonne affaire à revendre. C'est le cœur d'un
 * assistant achat/revente : trouver des objets profitables à flipper.
 *
 * L'estimation prend ~20 s (scrape des ventes réussies), donc l'analyse est à
 * la demande par produit plutôt qu'automatique sur toute la liste.
 */
function verdict(marginPct: number): { label: string; cls: string } {
  if (marginPct >= 30) return { label: 'TOP AFFAIRE', cls: 'badge-success' };
  if (marginPct >= 10) return { label: 'Bonne marge', cls: 'badge-info' };
  if (marginPct >= 0) return { label: 'Marge faible', cls: 'badge-muted' };
  return { label: 'Perte probable', cls: 'badge bg-rose-500/15 text-rose-300' };
}

export default function DealAnalysis({
  name,
  purchasePrice,
}: {
  name: string;
  purchasePrice: number;
}) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<ResaleEstimate | null>(null);

  const analyze = async () => {
    setState('loading');
    try {
      const data = await apiFetch<ResaleEstimate>('/estimate', {
        method: 'POST',
        json: { query: name.slice(0, 80), purchasePrice, platform: 'ebay' },
      });
      setResult(data);
      setState('done');
    } catch {
      setState('error');
    }
  };

  if (state === 'idle') {
    return (
      <button
        onClick={analyze}
        className="btn-ghost mt-3 text-xs text-amber-300/90 hover:text-amber-200"
        title="Estimer la marge de revente de cette offre"
      >
        <TrendingUp className="h-3.5 w-3.5" /> Bonne affaire ?
      </button>
    );
  }

  if (state === 'loading') {
    return (
      <p className="mt-3 flex items-center gap-2 text-xs text-slate-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" /> Analyse des ventes eBay… (~20 s)
      </p>
    );
  }

  if (state === 'error') {
    return <p className="mt-3 text-xs text-rose-300">Analyse impossible (service indisponible).</p>;
  }

  if (!result || result.sampleCount === 0 || result.median == null) {
    return (
      <p className="mt-3 text-xs text-slate-500">
        Pas assez de ventes récentes pour estimer la revente.
      </p>
    );
  }

  const margin = result.estimatedProfit ?? 0;
  const pct = result.marginPct ?? 0;
  const v = verdict(pct);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-ink/40 px-3 py-2 text-xs">
      <span className={v.cls}>{v.label}</span>
      <span className="text-slate-400">
        Revente ~<span className="font-semibold text-slate-200">{euro(result.median)}</span>
      </span>
      <span className="text-slate-400">
        net <span className="font-semibold text-slate-200">{euro(result.netEstimate ?? 0)}</span>
      </span>
      <span className={margin >= 0 ? 'font-semibold text-emerald-400' : 'font-semibold text-rose-400'}>
        marge {margin >= 0 ? '+' : ''}
        {euro(margin)} ({pct}%)
      </span>
      <span className="text-slate-600">· {result.sampleCount} ventes</span>
      {result.velocityLabel && (
        <span className="text-slate-400">
          · se vend <span className="font-semibold text-slate-200">{result.velocityLabel}</span>
          {result.salesPer30d != null ? ` (~${result.salesPer30d}/mois)` : ''}
        </span>
      )}
      {result.confidenceLabel && (
        <span className="text-slate-400">· fiabilité {result.confidenceLabel}</span>
      )}
    </div>
  );
}
