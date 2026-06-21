'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { AccountingSummary, Sale, StockItem } from '@shopping-assistant/types';
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
  Clock,
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
  { href: '/deals', label: 'Bonnes affaires', icon: <Sparkles className="h-4 w-4" />, tint: 'bg-amber-500/10 text-amber-300' },
  { href: '/search', label: 'Rechercher', icon: <Search className="h-4 w-4" />, tint: 'bg-accent/10 text-accent' },
  { href: '/estimate', label: 'Estimer une revente', icon: <Coins className="h-4 w-4" />, tint: 'bg-emerald-500/10 text-emerald-300' },
  { href: '/scan', label: 'Scanner un code-barres', icon: <ScanBarcode className="h-4 w-4" />, tint: 'bg-violet-500/10 text-violet-300' },
  { href: '/stock', label: 'Mon stock', icon: <Package className="h-4 w-4" />, tint: 'bg-sky-500/10 text-sky-300' },
  { href: '/accounting', label: 'Mes comptes', icon: <BookOpenCheck className="h-4 w-4" />, tint: 'bg-teal-500/10 text-teal-300' },
  { href: '/alerts', label: 'Alertes prix', icon: <Bell className="h-4 w-4" />, tint: 'bg-rose-500/10 text-rose-300' },
];

const DORMANT_DAYS = 60;

function dormantCount(items: StockItem[]): number {
  const now = Date.now();
  return items.filter(
    (i) =>
      i.remaining > 0 &&
      i.status !== 'sold' &&
      (now - new Date(i.purchaseDate).getTime()) / 86_400_000 >= DORMANT_DAYS
  ).length;
}

export default function Home() {
  const [summary, setSummary] = useState<AccountingSummary | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [dormant, setDormant] = useState(0);
  const [activeAlerts, setActiveAlerts] = useState(0);
  const [recentDeals, setRecentDeals] = useState(0);

  useEffect(() => {
    apiFetch<AccountingSummary>('/accounting/summary')
      .then(setSummary)
      .catch(() => setSummary(null));
    apiFetch<{ sales?: Sale[] }>('/sales')
      .then((d) => setSales((d.sales ?? []).slice(0, 5)))
      .catch(() => setSales([]));
    apiFetch<{ items?: StockItem[] }>('/stock')
      .then((d) => setDormant(dormantCount(d.items ?? [])))
      .catch(() => setDormant(0));
    apiFetch<{ alerts?: { active: boolean }[] }>('/alerts')
      .then((d) => setActiveAlerts((d.alerts ?? []).filter((a) => a.active).length))
      .catch(() => setActiveAlerts(0));
    apiFetch<{ deals?: { foundAt: string }[] }>('/watch/deals')
      .then((d) => {
        const weekAgo = Date.now() - 7 * 86_400_000;
        setRecentDeals((d.deals ?? []).filter((x) => new Date(x.foundAt).getTime() >= weekAgo).length);
      })
      .catch(() => setRecentDeals(0));
  }, []);

  const followUps = [
    dormant > 0 && {
      href: '/stock',
      icon: <Clock className="h-4 w-4" />,
      label: `${dormant} objet(s) dormant(s)`,
      sub: `en stock > ${DORMANT_DAYS} j`,
      tone: 'text-amber-300',
    },
    activeAlerts > 0 && {
      href: '/alerts',
      icon: <Bell className="h-4 w-4" />,
      label: `${activeAlerts} alerte(s) active(s)`,
      sub: 'surveillance prix',
      tone: 'text-sky-300',
    },
    recentDeals > 0 && {
      href: '/alerts',
      icon: <Sparkles className="h-4 w-4" />,
      label: `${recentDeals} bon(s) plan(s)`,
      sub: '7 derniers jours',
      tone: 'text-emerald-300',
    },
  ].filter(Boolean) as { href: string; icon: JSX.Element; label: string; sub: string; tone: string }[];

  const currentMonth = new Date().toISOString().slice(0, 7);
  const thisMonth = summary?.monthly.find((m) => m.month === currentMonth);
  const hasActivity = !!summary && (summary.itemsTotal > 0 || summary.salesCount > 0);

  // Séries mensuelles en ordre chronologique (l'API renvoie le plus récent d'abord)
  const monthlyChrono = summary ? [...summary.monthly].reverse() : [];
  const profitSeries = monthlyChrono.map((m) => m.profitNet);
  const monthLabels = monthlyChrono.map((m) => monthShort(m.month));
  const netNow = thisMonth ? thisMonth.profitNet : (summary?.profitNet ?? 0);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      {/* Hero « command center » : bandeau verre pleine largeur */}
      <section className="animate-rise relative overflow-hidden rounded-2xl border border-line bg-surface/50 p-7 backdrop-blur-md sm:p-9">
        {/* Halos décoratifs internes */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-70 blur-3xl"
          style={{ background: 'radial-gradient(closest-side, rgb(var(--c-accent) / 0.22), transparent 70%)' }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgb(var(--c-accent) / 0.8), transparent)' }}
        />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
              <Sparkles className="h-3 w-3" /> Achat malin · Revente rentable
            </span>
            <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">
              <span className="brand-text">Shopping Assistant</span>
            </h1>
            <p className="mt-3 text-lg text-slate-400">
              Votre poste de pilotage pour acheter malin et revendre rentable.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
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
          </div>
          {/* Emblème animé */}
          <div className="relative hidden shrink-0 md:block">
            <div className="absolute inset-0 animate-glow-pulse rounded-3xl bg-accent/20 blur-2xl" />
            <div className="relative flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-br from-accent to-accent-deep text-white shadow-glow ring-1 ring-accent/30">
              <ShoppingBag className="h-12 w-12" />
            </div>
          </div>
        </div>
      </section>

      <OnboardingChecklist
        hasStock={!!summary && summary.itemsTotal > 0}
        hasSale={!!summary && summary.salesCount > 0}
      />

      {followUps.length > 0 && (
        <section className="animate-fade-in mt-10">
          <h2 className="section-title mb-3">À suivre</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {followUps.map((f) => (
              <Link
                key={f.label}
                href={f.href}
                className="card-pad flex items-center gap-3 transition-colors hover:bg-[rgb(var(--overlay)/0.05)]"
              >
                <span className={`flex h-9 w-9 items-center justify-center rounded-lg bg-[rgb(var(--overlay)/0.05)] ${f.tone}`}>
                  {f.icon}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-100">{f.label}</span>
                  <span className="block text-xs text-slate-500">{f.sub}</span>
                </span>
                <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-slate-600" />
              </Link>
            ))}
          </div>
        </section>
      )}

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
              <span className={`tile-icon ${q.tint}`}>{q.icon}</span>
              {q.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
