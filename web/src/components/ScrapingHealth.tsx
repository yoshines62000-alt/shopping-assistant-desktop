'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface ConnHealth {
  lastCount: number | null;
  consecutiveFailures: number;
  lastIssue: string | null;
  secondsSinceSuccess: number | null;
  secondsSinceAttempt: number | null;
  circuitOpen: boolean;
  parserSuspect?: boolean;
  emptyFullPage?: number;
}

function statusOf(h: ConnHealth): { label: string; cls: string } {
  if (h.circuitOpen) return { label: 'Circuit ouvert', cls: 'text-rose-400' };
  if (h.parserSuspect) return { label: 'Parser à vérifier', cls: 'text-orange-400' };
  if (h.secondsSinceAttempt == null) return { label: 'Jamais sollicité', cls: 'text-slate-500' };
  if (h.consecutiveFailures > 0 || h.lastIssue) return { label: 'Anomalie', cls: 'text-amber-400' };
  return { label: 'OK', cls: 'text-emerald-400' };
}

function ago(s: number | null): string {
  if (s == null) return '—';
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  return `${Math.round(s / 3600)} h`;
}

export default function ScrapingHealth() {
  const [data, setData] = useState<Record<string, ConnHealth> | null>(null);
  const [error, setError] = useState(false);

  const load = () => {
    apiFetch<{ connectors: Record<string, ConnHealth> }>('/connectors/health')
      .then((d) => {
        setData(d.connectors);
        setError(false);
      })
      .catch(() => setError(true));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="card-pad">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Santé du scraping</h2>
          <p className="text-xs text-slate-500">État de chaque source (mis à jour à chaque recherche)</p>
        </div>
        <button onClick={load} className="btn-ghost" title="Rafraîchir">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {error && <p className="text-xs text-rose-400">État indisponible (le service est-il démarré ?)</p>}

      {data && (
        <div className="space-y-2">
          {Object.entries(data).map(([name, h]) => {
            const st = statusOf(h);
            return (
              <div
                key={name}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-ink/40 px-3 py-2"
              >
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium capitalize text-slate-200">{name}</span>
                  <span className={`text-xs font-medium ${st.cls}`}>● {st.label}</span>
                </div>
                <div className="text-xs text-slate-500">
                  {h.lastCount != null ? `${h.lastCount} résultats` : '—'}
                  <span className="mx-1.5 text-slate-600">·</span>
                  succès il y a {ago(h.secondsSinceSuccess)}
                  {h.lastIssue && <span className="ml-1.5 text-amber-400/80">· {h.lastIssue}</span>}
                </div>
                {h.parserSuspect && (
                  <p className="w-full text-xs text-orange-300/90">
                    🔧 Page reçue mais 0 résultat extrait à répétition — le site a sans doute changé sa
                    mise en page. Les prix de cette source ne sont plus fiables tant que le parser n&apos;est
                    pas mis à jour.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
