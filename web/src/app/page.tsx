'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { AccountingSummary, Sale, StockItem, Favorite } from '@shopping-assistant/types';
import {
  Search,
  Sparkles,
  Bell,
  TrendingUp,
  BarChart3,
  ArrowRight,
  Clock,
  Heart,
  Target,
  Package,
  Wallet,
  RefreshCw,
} from 'lucide-react';
import StatCard from '@/components/ui/StatCard';
import Sparkline from '@/components/ui/Sparkline';
import BarChart from '@/components/ui/BarChart';
import OnboardingChecklist from '@/components/OnboardingChecklist';
import { apiFetch } from '@/lib/api';
import { toast } from '@/lib/toast';
import { euro, dateFr } from '@/lib/format';

const MONTHS = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];

function monthShort(ym: string): string {
  const m = Number(ym.split('-')[1]);
  return MONTHS[m - 1] ?? ym;
}

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
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [refreshingFavs, setRefreshingFavs] = useState(false);

  const refreshFavoritePrices = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (refreshingFavs) return;
    setRefreshingFavs(true);
    try {
      const res = await apiFetch<{ checked: number; changed: number }>('/favorites/refresh-prices', {
        method: 'POST',
      });
      const d = await apiFetch<{ favorites?: Favorite[] }>('/favorites');
      setFavorites(d.favorites ?? []);
      toast.success(
        res.checked === 0
          ? 'Aucun favori Amazon/eBay à rafraîchir'
          : `${res.checked} prix vérifié${res.checked > 1 ? 's' : ''} · ${res.changed} modifié${res.changed > 1 ? 's' : ''}`
      );
    } catch {
      toast.error('Rafraîchissement impossible');
    } finally {
      setRefreshingFavs(false);
    }
  };

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
    apiFetch<{ favorites?: Favorite[] }>('/favorites')
      .then((d) => setFavorites(d.favorites ?? []))
      .catch(() => setFavorites([]));
  }, []);

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

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

  const favUnderTarget = favorites.filter(
    (f) => f.targetPrice != null && f.targetPrice > 0 && f.price <= f.targetPrice
  ).length;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      {/* En-tête du tableau de bord */}
      <header className="animate-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-title mb-1">Tableau de bord</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-100">
            Bonjour <span className="brand-text">👋</span>
          </h1>
          <p className="mt-1 text-sm capitalize text-slate-500">{today}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/search" className="btn-secondary">
            <Search className="h-4 w-4" /> Rechercher
          </Link>
          <Link href="/deals" className="btn-primary">
            <Sparkles className="h-4 w-4" /> Bonnes affaires
          </Link>
        </div>
      </header>

      {/* À suivre — bandeau actionnable */}
      {followUps.length > 0 && (
        <section className="animate-fade-in mt-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {followUps.map((f) => (
              <Link
                key={f.label}
                href={f.href}
                className="card-pad card-hover flex items-center gap-3"
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

      {/* Nouvel utilisateur : on guide plutôt que d'afficher des zéros */}
      {!hasActivity && (
        <OnboardingChecklist
          hasStock={!!summary && summary.itemsTotal > 0}
          hasSale={!!summary && summary.salesCount > 0}
        />
      )}

      {/* KPI principaux */}
      {hasActivity && summary && (
        <section className="animate-fade-in mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="kpi text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Bénéfice net {thisMonth ? 'ce mois-ci' : 'total'}
              </p>
              <p
                className={`numeric mt-1.5 text-2xl font-bold tracking-tight ${netNow >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
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
              label="Potentiel net"
              value={summary.stockPotentialNet > 0 ? `~${euro(summary.stockPotentialNet)}` : '—'}
              tone="accent"
            />
            <StatCard
              label="ROI global"
              value={summary.roiPct != null ? `${summary.roiPct} %` : '—'}
              sub={summary.avgDaysToSell != null ? `rotation ~${summary.avgDaysToSell} j` : undefined}
            />
          </div>

          {/* Graphe bénéfice + dernières ventes */}
          <div className="grid gap-3 lg:grid-cols-5">
            <div className="card-pad lg:col-span-3">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="section-title flex items-center gap-1.5">
                  <BarChart3 className="h-3.5 w-3.5" /> Bénéfice net par mois
                </h2>
                <Link href="/accounting" className="text-xs text-accent hover:text-cyan-300">
                  Comptes détaillés →
                </Link>
              </div>
              {profitSeries.length >= 2 ? (
                <BarChart values={profitSeries} labels={monthLabels} />
              ) : (
                <p className="py-8 text-center text-sm text-slate-500">
                  Pas encore assez d&apos;historique — encore une vente ou deux et la tendance apparaît.
                </p>
              )}
            </div>
            <div className="card-pad lg:col-span-2">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="section-title flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" /> Dernières ventes
                </h2>
                <Link href="/accounting" className="text-xs text-accent hover:text-cyan-300">
                  Tout voir →
                </Link>
              </div>
              {sales.length > 0 ? (
                <div className="space-y-0.5">
                  {sales.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-3 px-1 py-1.5">
                      <span className="truncate text-sm text-slate-300">{s.itemName}</span>
                      <span className="flex shrink-0 items-center gap-3 text-sm">
                        <span className="text-xs text-slate-500">{dateFr(s.saleDate)}</span>
                        <span className="numeric font-semibold text-accent">{euro(s.total)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-slate-500">Aucune vente enregistrée.</p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Raccourcis « état » : favoris + stock + comptes (toujours utiles) */}
      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <Link href="/shopping-list" className="card-pad card-hover">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent ring-1 ring-accent/15">
              <Heart className="h-5 w-5" />
            </span>
            <div>
              <p className="numeric text-2xl font-bold text-slate-100">{favorites.length}</p>
              <p className="text-xs text-slate-500">favori(s) enregistré(s)</p>
            </div>
            {favorites.length > 0 && (
              <button
                onClick={refreshFavoritePrices}
                disabled={refreshingFavs}
                className="btn-ghost ml-auto !p-1.5 disabled:opacity-50"
                title="Rafraîchir les prix des favoris (Amazon/eBay)"
                aria-label="Rafraîchir les prix des favoris"
              >
                <RefreshCw className={`h-4 w-4 ${refreshingFavs ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
          {favUnderTarget > 0 && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
              <Target className="h-3 w-3" /> {favUnderTarget} sous ma cible
            </p>
          )}
        </Link>

        <Link href="/stock" className="card-pad card-hover">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-300 ring-1 ring-sky-500/15">
              <Package className="h-5 w-5" />
            </span>
            <div>
              <p className="numeric text-2xl font-bold text-slate-100">
                {summary ? summary.itemsInStock : '—'}
              </p>
              <p className="text-xs text-slate-500">en stock</p>
            </div>
          </div>
          {dormant > 0 && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
              <Clock className="h-3 w-3" /> {dormant} dormant(s)
            </p>
          )}
        </Link>

        <Link href="/accounting" className="card-pad card-hover">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/15">
              <Wallet className="h-5 w-5" />
            </span>
            <div>
              <p
                className={`numeric text-2xl font-bold ${(summary?.profitNet ?? 0) >= 0 ? 'text-slate-100' : 'text-rose-400'}`}
              >
                {summary ? euro(summary.profitNet) : '—'}
              </p>
              <p className="text-xs text-slate-500">bénéfice net total</p>
            </div>
          </div>
        </Link>
      </section>
    </div>
  );
}
