'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';
import { Radar, Trash2, ExternalLink, Play, Pause, Tag } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import { apiFetch } from '@/lib/api';
import { toast } from '@/lib/toast';
import { euro } from '@/lib/format';

interface SavedSearch {
  id: number;
  query: string;
  targetPrice: number;
  site: string | null;
  active: boolean;
  lastChecked: string | null;
  dealCount: number;
}

interface DealHit {
  id: number;
  savedSearchId: number;
  name: string;
  price: number;
  sourceUrl: string;
  siteDomain: string;
  foundAt: string;
}

function whenFr(iso: string | null): string {
  if (!iso) return 'jamais vérifiée';
  return `vérifiée le ${new Date(iso).toLocaleString('fr-FR')}`;
}

export default function SavedSearches() {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [deals, setDeals] = useState<DealHit[]>([]);
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState('');
  const [site, setSite] = useState('');

  const load = useCallback(() => {
    apiFetch<{ searches?: SavedSearch[] }>('/watch/searches')
      .then((r) => setSearches(r.searches ?? []))
      .catch(() => setSearches([]));
    apiFetch<{ deals?: DealHit[] }>('/watch/deals?limit=30')
      .then((r) => setDeals(r.deals ?? []))
      .catch(() => setDeals([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim() || Number(target) <= 0) {
      toast.error('Indiquez une requête et un prix cible valides');
      return;
    }
    try {
      await apiFetch('/watch/searches', {
        method: 'POST',
        json: { query: query.trim(), targetPrice: Number(target), site: site || null },
      });
      toast.success('Recherche surveillée — re-scannée en fond');
      setQuery('');
      setTarget('');
      setSite('');
      load();
    } catch {
      toast.error('Impossible d’ajouter la surveillance');
    }
  };

  const toggle = async (s: SavedSearch) => {
    await apiFetch(`/watch/searches/${s.id}`, {
      method: 'PATCH',
      json: { active: !s.active },
    }).catch(() => null);
    load();
  };

  const remove = async (s: SavedSearch) => {
    if (!window.confirm(`Supprimer la surveillance « ${s.query} » et ses bons plans ?`)) return;
    await apiFetch(`/watch/searches/${s.id}`, { method: 'DELETE' }).catch(() => null);
    load();
  };

  const dealsFor = (id: number) => deals.filter((d) => d.savedSearchId === id);

  return (
    <div className="space-y-4">
      <div className="card-pad">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Radar className="h-4 w-4 text-accent" /> Surveiller une recherche
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          Re-scannée automatiquement en fond — notification (Discord + Windows) dès qu’une offre
          passe sous ton prix cible.
        </p>
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex : iPhone 13 128 Go"
            className="input"
            maxLength={300}
            required
          />
          <input
            type="number"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="≤ Prix (€)"
            className="input sm:w-32"
            min="0"
            step="0.01"
            required
          />
          <select value={site} onChange={(e) => setSite(e.target.value)} className="input sm:w-32">
            <option value="">Tous les sites</option>
            <option value="amazon">Amazon</option>
            <option value="ebay">eBay</option>
            <option value="vinted">Vinted</option>
            <option value="leboncoin">Leboncoin</option>
          </select>
          <button type="submit" className="btn-primary">
            <Radar className="h-4 w-4" /> Surveiller
          </button>
        </form>
      </div>

      <div className="card-pad">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Recherches surveillées ({searches.length})
        </h2>
        {searches.length === 0 ? (
          <EmptyState
            icon={<Radar className="h-6 w-6" />}
            title="Aucune surveillance"
            description="Ajoute une recherche ci-dessus : on guette les bons plans pour toi en continu."
          />
        ) : (
          <div className="space-y-2">
            {searches.map((s) => {
              const hits = dealsFor(s.id);
              return (
                <div key={s.id} className="rounded-lg border border-line bg-ink/40 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-100">{s.query}</span>
                        <span className="badge-info">≤ {euro(s.targetPrice)}</span>
                        {s.site && (
                          <span className="badge-muted">
                            <Tag className="h-3 w-3" /> {s.site}
                          </span>
                        )}
                        {s.active ? (
                          <span className="badge-success">active</span>
                        ) : (
                          <span className="badge-muted">en pause</span>
                        )}
                        {s.dealCount > 0 && (
                          <span className="badge bg-amber-500/15 text-amber-300">
                            {s.dealCount} bon(s) plan(s)
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">{whenFr(s.lastChecked)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => toggle(s)}
                        className="btn-ghost !p-1.5"
                        title={s.active ? 'Mettre en pause' : 'Réactiver'}
                      >
                        {s.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => remove(s)}
                        className="btn-ghost !p-1.5 hover:!text-rose-300"
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {hits.length > 0 && (
                    <div className="mt-2 space-y-1 border-t border-line pt-2">
                      {hits.slice(0, 5).map((d) => (
                        <a
                          key={d.id}
                          href={d.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between gap-2 rounded px-1.5 py-1 text-sm hover:bg-white/5"
                        >
                          <span className="truncate text-slate-300">{d.name || d.sourceUrl}</span>
                          <span className="flex shrink-0 items-center gap-1.5">
                            <span className="font-semibold text-emerald-400">{euro(d.price)}</span>
                            <span className="badge-muted">{d.siteDomain}</span>
                            <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
