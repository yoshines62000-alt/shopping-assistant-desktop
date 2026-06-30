'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';
import { Radar, Trash2, ExternalLink, Play, Pause, Tag } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import { apiFetch } from '@/lib/api';
import { toast } from '@/lib/toast';
import { euro } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

interface SavedSearch {
  id: number;
  query: string;
  targetPrice: number;
  site: string | null;
  active: boolean;
  intervalMinutes: number;
  seeded: boolean;
  lastChecked: string | null;
  dealCount: number;
}

const INTERVAL_OPTIONS = [
  { value: 0, label: 'Fréquent' },
  { value: 60, label: '≥ 1 h' },
  { value: 360, label: '≥ 6 h' },
  { value: 1440, label: '≥ 24 h' },
];

function intervalLabel(min: number): string {
  return INTERVAL_OPTIONS.find((o) => o.value === min)?.label ?? `≥ ${Math.round(min / 60)} h`;
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

export default function SavedSearches() {
  const { t, locale } = useI18n();
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [deals, setDeals] = useState<DealHit[]>([]);
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState('');
  const [site, setSite] = useState('');
  const [interval, setIntervalMin] = useState('0');

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
      toast.error(t('sav.errInvalid'));
      return;
    }
    try {
      await apiFetch('/watch/searches', {
        method: 'POST',
        json: {
          query: query.trim(),
          targetPrice: Number(target),
          site: site || null,
          intervalMinutes: Number(interval) || 0,
        },
      });
      toast.success(t('sav.added'));
      setQuery('');
      setTarget('');
      setSite('');
      setIntervalMin('0');
      load();
    } catch {
      toast.error(t('sav.errAdd'));
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
    if (!window.confirm(t('sav.confirmDel'))) return;
    await apiFetch(`/watch/searches/${s.id}`, { method: 'DELETE' }).catch(() => null);
    load();
  };

  const dealsFor = (id: number) => deals.filter((d) => d.savedSearchId === id);

  return (
    <div className="space-y-4">
      <div className="card-pad">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Radar className="h-4 w-4 text-accent" /> {t('sav.watchSearch')}
        </h2>
        <p className="mb-3 text-xs text-slate-500">{t('sav.help')}</p>
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto_auto]">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('sav.placeholderQuery')}
            className="input"
            maxLength={300}
            required
          />
          <input
            type="number"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={t('sav.placeholderPrice')}
            className="input sm:w-32"
            min="0"
            step="0.01"
            required
          />
          <select value={site} onChange={(e) => setSite(e.target.value)} className="input sm:w-32">
            <option value="">{t('form.allSites')}</option>
            <option value="amazon">Amazon</option>
            <option value="ebay">eBay</option>
            <option value="vinted">Vinted</option>
            <option value="leboncoin">Leboncoin</option>
          </select>
          <select
            value={interval}
            onChange={(e) => setIntervalMin(e.target.value)}
            className="input sm:w-28"
            title={t('sav.minFreq')}
          >
            {INTERVAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.value === 0 ? t('sav.frequent') : o.label}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-primary">
            <Radar className="h-4 w-4" /> {t('sav.watch')}
          </button>
        </form>
      </div>

      <div className="card-pad">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {t('sav.watchedTitle')} ({searches.length})
        </h2>
        {searches.length === 0 ? (
          <EmptyState
            icon={<Radar className="h-6 w-6" />}
            title={t('sav.noWatch')}
            description={t('sav.noWatchDesc')}
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
                          <span className="badge-success">{t('sav.active')}</span>
                        ) : (
                          <span className="badge-muted">{t('sav.paused')}</span>
                        )}
                        {s.intervalMinutes > 0 && (
                          <span className="badge-muted">{intervalLabel(s.intervalMinutes)}</span>
                        )}
                        {!s.seeded && (
                          <span
                            className="badge bg-sky-500/15 text-sky-300"
                            title={t('sav.baselineTitle')}
                          >
                            {t('sav.baseline')}
                          </span>
                        )}
                        {s.dealCount > 0 && (
                          <span className="badge bg-amber-500/15 text-amber-300">
                            {s.dealCount} {t('sav.deals')}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {s.lastChecked
                          ? `${t('sav.checkedOn')} ${new Date(s.lastChecked).toLocaleString(locale)}`
                          : t('sav.neverChecked')}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => toggle(s)}
                        className="btn-ghost !p-1.5"
                        title={s.active ? t('sav.pause') : t('sav.resume')}
                      >
                        {s.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => remove(s)}
                        className="btn-ghost !p-1.5 hover:!text-rose-300"
                        title={t('stock.delete')}
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
                          className="flex items-center justify-between gap-2 rounded px-1.5 py-1 text-sm hover:bg-[rgb(var(--overlay)/0.05)]"
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
