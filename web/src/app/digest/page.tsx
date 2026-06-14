'use client';

import { useEffect, useState } from 'react';
import { BarChart3, TrendingDown, RefreshCw, Bell } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import PageShell from '@/components/ui/PageShell';
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
      title="Digest quotidien"
      icon={<BarChart3 className="h-6 w-6" />}
      subtitle="Baisses de prix récentes"
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
          Actualiser
        </button>
        <button
          type="button"
          onClick={checkPrices}
          className="btn-primary !px-2 !py-1 text-xs"
          disabled={checking}
        >
          <Bell className="h-3 w-3" />
          Vérifier les prix
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400">Chargement...</p>
      ) : drops.length === 0 ? (
        <p className="text-slate-400">Aucune baisse récente.</p>
      ) : (
        <div className="space-y-3">
          {drops.map((d, i) => (
            <a
              key={i}
              href={d.url}
              target="_blank"
              rel="noreferrer"
              className="card-pad block hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-200">{d.product}</span>
                <span className="text-xs text-accent">{d.site}</span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-sm">
                <span className="text-slate-500 line-through">{euro(d.oldPrice)}</span>
                <span className="text-green-400 font-semibold">{euro(d.newPrice)}</span>
                <TrendingDown className="h-3 w-3 text-green-400" />
                <span className="text-green-400">- {euro(d.diff)}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </PageShell>
  );
}