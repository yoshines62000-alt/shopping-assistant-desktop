'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { AccountingSummary, Sale } from '@shopping-assistant/types';
import {
  Search,
  Coins,
  Package,
  ShoppingBag,
  BookOpenCheck,
  Bell,
  ScanBarcode,
  TrendingUp,
  BarChart3,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import StatCard from '@/components/ui/StatCard';
import Sparkline from '@/components/ui/Sparkline';
import BarChart from '@/components/ui/BarChart';
import OnboardingChecklist from '@/components/OnboardingChecklist';
import { apiFetch } from '@/lib/api';
import { euro, dateFr } from '@/lib/format';

const MONTHS = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];

function monthShort(ym: string): string {
  const m = Number(ym.split('-')[1]);
  return MONTHS[m - 1] ?? ym;
}

const quickLinks = [
  { href: '/deals', label: 'Bonnes affaires', icon: <Sparkles className="h-4 w-4" /> },
  { href: '/search', label: 'Rechercher', icon: <Search className="h-4 w-4" /> },
  { href: '/estimate', label: 'Estimer une revente', icon: <Coins className="h-4 w-4" /> },
  { href: '/scan', label: 'Scanner un code-barres', icon: <ScanBarcode className="h-4 w-4" /> },
  { href: '/stock', label: 'Mon stock', icon: <Package className="h-4 w-4" /> },
  { href: '/accounting', label: 'Mes comptes', icon: <BookOpenCheck className="h-4 w-4" /> },
  { href: '/alerts', label: 'Alertes prix', icon: <Bell className="h-4 w-4" /> },
];

export default function Home() {
  const [summary, setSummary] = useState<AccountingSummary | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);

  useEffect(() => {
    apiFetch<AccountingSummary>('/accounting/summary')
      .then(setSummary)
      .catch(() => setSummary(null));
    apiFetch<{ sales?: Sale[] }>('/sales')
      .then((d) => setSales((d.sales ?? []).slice(0, 5)))
      .catch(() => setSales([]));
  }, []);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const thisMonth = summary?.monthly.find((m) => m.month === currentMonth);
  const hasActivity = !!summary && (summary.itemsTotal > 0 || summary.salesCount > 0);

  // Séries mensuelles en ordre chronologique (l'API renvoie le plus récent d'abord)
  const monthlyChrono = summary ? [...summary.monthly].reverse() : [];
  const profitSeries = monthlyChrono.map((m) => m.profitNet);
  const monthLabels = monthlyChrono.map((m) => monthShort(m.month));
  const netNow = thisMonth ? thisMonth.profitNet : (summary?.profitNet ?? 0);

  return (
    <div className="page-container py-10">
      {/* Hero */}
      <section className="animate-rise mx-auto max-w-2xl text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 shadow-glow">
          <ShoppingBag className="h-7 w-7 text-accent" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
          <span className="brand-text">Shopping Assistant</span>
        </h1>
        <p className="mt-3 text-lg text-slate-400">
          L&apos;assistant qui facilite vos achats / reventes.
        </p>

        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/deals" className="btn-primary">
            <Sparkles className="h-4 w-4" /> Bonnes affaires
          </Link>
          <Link href="/search" className="btn-secondary">
            <Search className="h-4 w-4" /> Rechercher
          </Link>
          <Link href="/estimate" className="btn-secondary">
            <Coins className="h-4 w-4" /> Estimer une revente
          </Link>
          <Link href="/scan" className="btn-secondary">
            <ScanBarcode className="h-4 w-4" /> Scanner
          </Link>
        </div>
      </section>

      <OnboardingChecklist
        hasStock={!!summary && summary.itemsTotal > 0}
        hasSale={!!summary && summary.salesCount > 0}
      />

      {hasActivity && summary && (
        <section className="animate-fade-in mt-12 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Votre activité</h2>
            <Link
              href="/accounting"
              className="flex items-center gap-1 text-xs text-accent hover:text-cyan-300"
            >
              Comptes détaillés <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* KPI — le premier intègre une mini-courbe de tendance */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="kpi text-center">
              <p className="text-xs text-slate-500">
                Bénéfice net {thisMonth ? 'ce mois-ci' : 'total'}
              </p>
              <p
                className={`mt-1 text-2xl font-bold tracking-tight ${netNow >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
              >
                {netNow >= 0 ? '+' : ''}
                {euro(netNow)}
              </p>
              {profitSeries.length >= 2 ? (
                <div className="mt-2">
                  <Sparkline values={profitSeries} height={36} />
                </div>
              ) : (
                <p className="mt-1 text-xs text-slate-500">
                  {thisMonth ? `${thisMonth.salesCount} vente(s) ce mois` : `${summary.salesCount} vente(s)`}
                </p>
              )}
            </div>
            <StatCard
              label="Stock"
              value={euro(summary.stockValue)}
              sub={`${summary.itemsInStock} exemplaire(s)`}
            />
            <StatCard
              label="Potentiel de revente net"
              value={summary.stockPotentialNet > 0 ? `~${euro(summary.stockPotentialNet)}` : '—'}
              tone="accent"
            />
            <StatCard
              label="ROI global"
              value={summary.roiPct != null ? `${summary.roiPct} %` : '—'}
              sub={summary.avgDaysToSell != null ? `rotation ~${summary.avgDaysToSell} j` : undefined}
            />
          </div>

          {/* Tendance + dernières ventes */}
          <div className="grid gap-3 lg:grid-cols-5">
            {profitSeries.length >= 2 && (
              <div className="card-pad lg:col-span-3">
                <h3 className="section-title mb-3 flex items-center gap-1.5">
                  <BarChart3 className="h-3.5 w-3.5" /> Bénéfice net par mois
                </h3>
                <BarChart values={profitSeries} labels={monthLabels} />
              </div>
            )}
            {sales.length > 0 && (
              <div className={`card-pad ${profitSeries.length >= 2 ? 'lg:col-span-2' : 'lg:col-span-5'}`}>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="section-title flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" /> Dernières ventes
                  </h3>
                  <Link href="/accounting" className="text-xs text-accent hover:text-cyan-300">
                    Tout voir →
                  </Link>
                </div>
                <div className="space-y-0.5">
                  {sales.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-3 px-1 py-1.5">
                      <span className="truncate text-sm text-slate-300">{s.itemName}</span>
                      <span className="flex shrink-0 items-center gap-3 text-sm">
                        <span className="text-xs text-slate-500">{dateFr(s.saleDate)}</span>
                        <span className="font-semibold text-accent">{euro(s.total)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Accès rapides */}
      <section className="mt-10">
        <h2 className="section-title mb-3">Accès rapides</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {quickLinks.map((q) => (
            <Link key={q.href} href={q.href} className="tile">
              <span className="tile-icon">{q.icon}</span>
              {q.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
