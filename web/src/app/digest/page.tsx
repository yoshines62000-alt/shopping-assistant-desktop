'use client';

import { useEffect, useState } from 'react';
import { BarChart3, TrendingDown, RefreshCw, Bell } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { apiFetch } from '@/lib/api';
import PageShell from '@/components/ui/PageShell';
import EmptyState from '@/components/ui/EmptyState';
import LoadingBlock from '@/components/ui/LoadingBlock';
import { euro } from '@/lib/format';

interface PriceDrop {
  product: string;
  site: string;
  oldPrice: number;
  newPrice: number;
  diff: number;
  url: string;
}

export default function DigestPage() {
  const { t } = useI18n();
  const [drops, setDrops] = useState<PriceDrop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [checking, setChecking] = useState(false);

  const fetchDigest = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ priceDrops: PriceDrop[] }>('/digest/daily');
      setDrops(data.priceDrops || []);
    } catch {
      setDrops([]);
    } finally {
      setLoading(false);
    }
  };

  const checkPrices = async () => {
    setChecking(true);
    try {
      await apiFetch('/watch/check-prices', { method: 'POST' });
      await fetchDigest();
    } catch {
      // ignore
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    fetchDigest();
  }, []);

  return (
    <PageShell
      title={t('page.digest.title', 'Digest quotidien')}
      icon={<BarChart3 className="h-6 w-6" />}
      subtitle={t('page.digest.sub', 'Baisses de prix récentes')}
    >
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={async () => {
            setRefetching(true);
            await fetchDigest();
            setRefetching(false);
          }}
          className="btn-secondary !px-2 !py-1 text-xs"
          disabled={refetching}
        >
          <RefreshCw className={`h-3 w-3 ${refetching ? 'animate-spin' : ''}`} />
          {t('dig.refresh')}
        </button>
        <button
          type="button"
          onClick={checkPrices}
          className="btn-primary !px-2 !py-1 text-xs"
          disabled={checking}
        >
          <Bell className="h-3 w-3" />
          {t('dig.checkPrices')}
        </button>
      </div>

      {loading ? (
        <LoadingBlock label={t('dig.loading')} />
      ) : drops.length === 0 ? (
        <EmptyState
          icon={<TrendingDown className="h-6 w-6" />}
          title={t('dig.noDrops')}
          description={t('dig.noDropsDesc')}
        />
      ) : (
        <div className="space-y-3">
          {drops.map((d, i) => (
            <a
              key={i}
              href={d.url}
              target="_blank"
              rel="noreferrer"
              className="card-pad card-hover animate-rise block"
              style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-200">{d.product}</span>
                <span className="text-xs text-accent">{d.site}</span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-sm">
                <span className="text-slate-500 line-through">{euro(d.oldPrice)}</span>
                <span className="numeric font-semibold text-emerald-400">{euro(d.newPrice)}</span>
                <TrendingDown className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400">− {euro(d.diff)}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </PageShell>
  );
}