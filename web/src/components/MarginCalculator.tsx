'use client';

import { useMemo, useState } from 'react';
import type { AppSettings } from '@shopping-assistant/types';
import { Calculator } from 'lucide-react';
import { euro } from '@/lib/format';

const PLATFORM_LABELS: Record<string, string> = {
  ebay: 'eBay',
  vinted: 'Vinted',
  leboncoin: 'Leboncoin',
  autre: 'Autre',
};

const DEFAULT_FEES: Record<string, number> = { ebay: 0.13, vinted: 0, leboncoin: 0, autre: 0.1 };

/**
 * Calculateur de marge détaillé (F5) : prix d'achat + prix de vente + frais
 * plateforme (taux des réglages) + port à ta charge → bénéfice net, marge et ROI.
 */
export default function MarginCalculator({ settings }: { settings: AppSettings | null }) {
  const fees = useMemo(() => settings?.platformFees ?? DEFAULT_FEES, [settings]);
  const [platform, setPlatform] = useState('ebay');
  const [buy, setBuy] = useState('');
  const [sell, setSell] = useState('');
  const [shipping, setShipping] = useState('0');

  const r = useMemo(() => {
    const b = Number(buy) || 0;
    const s = Number(sell) || 0;
    const ship = Number(shipping) || 0;
    const feeRate = fees[platform] ?? 0;
    const feeAmount = s * feeRate;
    const net = s - feeAmount - ship - b;
    const margin = s > 0 ? (net / s) * 100 : 0; // marge sur prix de vente
    const roi = b > 0 ? (net / b) * 100 : 0; // retour sur l'achat
    return { feeRate, feeAmount, net, margin, roi, hasInput: b > 0 || s > 0 };
  }, [buy, sell, shipping, platform, fees]);

  return (
    <div className="card-pad">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-100">
        <Calculator className="h-4 w-4" /> Calculateur de marge
      </h2>
      <p className="mb-4 text-xs text-slate-500">
        Frais plateforme appliqués depuis tes réglages. Le port est compté comme une charge.
      </p>

      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-400">Plateforme</span>
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="input">
            {Object.keys(fees).map((k) => (
              <option key={k} value={k}>
                {PLATFORM_LABELS[k] ?? k} ({Math.round((fees[k] ?? 0) * 100)}%)
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-400">Prix d&apos;achat (€)</span>
          <input
            type="number"
            value={buy}
            onChange={(e) => setBuy(e.target.value)}
            className="input"
            min="0"
            step="0.01"
            placeholder="0"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-400">Prix de vente (€)</span>
          <input
            type="number"
            value={sell}
            onChange={(e) => setSell(e.target.value)}
            className="input"
            min="0"
            step="0.01"
            placeholder="0"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-400">Port à ta charge (€)</span>
          <input
            type="number"
            value={shipping}
            onChange={(e) => setShipping(e.target.value)}
            className="input"
            min="0"
            step="0.01"
          />
        </label>
      </div>

      {r.hasInput && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={`Frais (${Math.round(r.feeRate * 100)}%)`} value={`-${euro(r.feeAmount)}`} tone="muted" />
          <Stat
            label="Bénéfice net"
            value={`${r.net >= 0 ? '+' : ''}${euro(r.net)}`}
            tone={r.net >= 0 ? 'good' : 'bad'}
          />
          <Stat
            label="Marge"
            value={`${r.margin >= 0 ? '' : ''}${r.margin.toFixed(0)}%`}
            tone={r.margin >= 0 ? 'good' : 'bad'}
          />
          <Stat label="ROI / achat" value={`${r.roi.toFixed(0)}%`} tone={r.roi >= 0 ? 'good' : 'bad'} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: 'good' | 'bad' | 'muted' }) {
  const cls =
    tone === 'good' ? 'text-emerald-400' : tone === 'bad' ? 'text-rose-400' : 'text-slate-300';
  return (
    <div className="rounded-lg border border-line bg-ink/40 px-3 py-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-lg font-semibold ${cls}`}>{value}</div>
    </div>
  );
}
