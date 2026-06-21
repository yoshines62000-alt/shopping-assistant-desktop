'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';
import Link from 'next/link';
import type { AccountingSummary, Sale, Expense, FiscalSummary } from '@shopping-assistant/types';
import { Wallet, Undo2, BookOpenCheck, Package, Download, Plus, Trash2, FileText, RotateCcw } from 'lucide-react';
import PageShell from '@/components/ui/PageShell';
import StatCard from '@/components/ui/StatCard';
import BarChart from '@/components/ui/BarChart';
import ErrorBanner from '@/components/ui/ErrorBanner';
import LoadingBlock from '@/components/ui/LoadingBlock';
import EmptyState from '@/components/ui/EmptyState';
import { apiFetch } from '@/lib/api';
import { euro, dateFr } from '@/lib/format';
import { downloadCSV } from '@/lib/csv';
import { printSaleInvoice } from '@/lib/invoice';

const MONTH_NAMES = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];

function monthLabel(ym: string): string {
  const [year, month] = ym.split('-');
  return `${MONTH_NAMES[Number(month) - 1] ?? month} ${year}`;
}

export default function AccountingPage() {
  const [summary, setSummary] = useState<AccountingSummary | null>(null);
  const [fiscal, setFiscal] = useState<FiscalSummary | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expenseLabel, setExpenseLabel] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('emballage');
  const [salesPlatform, setSalesPlatform] = useState('all');
  const [salesQuery, setSalesQuery] = useState('');

  const load = useCallback(async () => {
    try {
      const [sum, salesData, expensesData, fiscalData] = await Promise.all([
        apiFetch<AccountingSummary>('/accounting/summary'),
        apiFetch<{ sales?: Sale[] }>('/sales'),
        apiFetch<{ expenses?: Expense[] }>('/expenses'),
        apiFetch<FiscalSummary>('/accounting/fiscal').catch(() => null),
      ]);
      setSummary(sum);
      setSales(salesData.sales ?? []);
      setExpenses(expensesData.expenses ?? []);
      setFiscal(fiscalData);
      setError(null);
    } catch {
      setError('Impossible de charger les comptes. Vérifiez que le service est démarré.');
    } finally {
      setLoading(false);
    }
  }, []);

  const addExpense = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/expenses', {
        method: 'POST',
        json: { label: expenseLabel, amount: Number(expenseAmount), category: expenseCategory },
      });
      setExpenseLabel('');
      setExpenseAmount('');
      load();
    } catch {
      setError("Impossible d'ajouter la dépense.");
    }
  };

  const removeExpense = async (expense: Expense) => {
    if (!window.confirm(`Supprimer la dépense « ${expense.label} » (${euro(expense.amount)}) ?`))
      return;
    await apiFetch(`/expenses/${expense.id}`, { method: 'DELETE' }).catch(() => null);
    load();
  };

  const exportSalesCSV = () => {
    downloadCSV(
      `ventes-${new Date().toISOString().split('T')[0]}.csv`,
      ['Date', 'Objet', 'Quantité', 'Prix unitaire (€)', 'Frais (€)', 'Plateforme', 'Total (€)'],
      sales.map((s) => [
        dateFr(s.saleDate),
        s.itemName,
        s.quantity,
        s.unitPrice,
        s.fees,
        s.platform,
        s.total,
      ])
    );
  };

  const exportMonthlyCSV = () => {
    if (!summary) return;
    downloadCSV(
      `bilan-mensuel-${new Date().toISOString().split('T')[0]}.csv`,
      ['Mois', 'Ventes', 'CA (€)', 'Frais (€)', "Coût d'achat (€)", 'Dépenses (€)', 'Bénéfice net (€)'],
      summary.monthly.map((m) => [
        m.month,
        m.salesCount,
        m.revenue,
        m.fees,
        m.cost,
        m.expenses,
        m.profitNet,
      ])
    );
  };

  useEffect(() => {
    load();
  }, [load]);

  const returnSale = async (sale: Sale) => {
    if (
      !window.confirm(
        `Marquer la vente de « ${sale.itemName} » comme retournée ? La quantité revient en stock et la vente est exclue de la compta (mais conservée pour le taux de retour).`
      )
    )
      return;
    await apiFetch(`/sales/${sale.id}/return`, { method: 'POST' }).catch(() => null);
    load();
  };

  const cancelSale = async (sale: Sale) => {
    if (
      !window.confirm(
        `Annuler la vente de « ${sale.itemName} » (${euro(sale.total)}) ? La quantité revient en stock.`
      )
    )
      return;
    await apiFetch(`/sales/${sale.id}`, { method: 'DELETE' }).catch(() => null);
    load();
  };

  const salePlatforms = Array.from(new Set(sales.map((s) => s.platform).filter(Boolean)));
  const filteredSales = sales
    .filter((s) => salesPlatform === 'all' || s.platform === salesPlatform)
    .filter((s) => !salesQuery.trim() || s.itemName.toLowerCase().includes(salesQuery.trim().toLowerCase()));
  const filteredTotal = filteredSales.reduce((sum, s) => sum + s.total, 0);

  return (
    <PageShell
      title="Mes comptes"
      icon={<BookOpenCheck className="h-6 w-6" />}
      subtitle="Bilan achat / revente"
      actions={
        summary && sales.length > 0 ? (
          <>
            <button onClick={exportSalesCSV} className="btn-secondary text-xs">
              <Download className="h-4 w-4" /> Ventes CSV
            </button>
            <button onClick={exportMonthlyCSV} className="btn-secondary text-xs">
              <Download className="h-4 w-4" /> Bilan CSV
            </button>
          </>
        ) : undefined
      }
    >
      <div className="space-y-6">
        {error && <ErrorBanner message={error} />}
        {loading && <LoadingBlock label="Chargement des comptes..." />}

        {summary && (
          <>
            {/* Panneau héros : bénéfice net + tendance animée */}
            <section className="animate-fade-in card-pad relative overflow-hidden">
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-px"
                style={{ background: 'linear-gradient(90deg, transparent, rgb(var(--c-accent) / 0.8), transparent)' }}
              />
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_1.5fr] lg:items-center">
                <div>
                  <p className="section-title">Bénéfice net · total</p>
                  <p
                    className={`numeric mt-1 text-4xl font-bold tracking-tight ${summary.profitNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                  >
                    {summary.profitNet >= 0 ? '+' : ''}
                    {euro(summary.profitNet)}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                    <span>
                      <span className="block text-xs text-slate-500">Chiffre d&apos;affaires</span>
                      <span className="numeric font-semibold text-slate-100">{euro(summary.revenueGross)}</span>
                    </span>
                    <span>
                      <span className="block text-xs text-slate-500">ROI</span>
                      <span className="numeric font-semibold text-accent">
                        {summary.roiPct != null ? `${summary.roiPct} %` : '—'}
                      </span>
                    </span>
                    <span>
                      <span className="block text-xs text-slate-500">Rotation</span>
                      <span className="numeric font-semibold text-slate-100">
                        {summary.avgDaysToSell != null ? `${summary.avgDaysToSell} j` : '—'}
                      </span>
                    </span>
                    <span>
                      <span className="block text-xs text-slate-500">Ventes</span>
                      <span className="numeric font-semibold text-slate-100">{summary.salesCount}</span>
                    </span>
                  </div>
                </div>
                <div>
                  <p className="section-title mb-2">Bénéfice net par mois</p>
                  {summary.monthly.length >= 2 ? (
                    <BarChart
                      values={[...summary.monthly].reverse().map((m) => m.profitNet)}
                      labels={[...summary.monthly]
                        .reverse()
                        .map((m) => MONTH_NAMES[Number(m.month.split('-')[1]) - 1] ?? m.month)}
                      height={150}
                    />
                  ) : (
                    <p className="py-10 text-center text-sm text-slate-500">
                      La tendance apparaîtra dès deux mois d&apos;activité.
                    </p>
                  )}
                </div>
              </div>
            </section>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Investi (total achats)" value={euro(summary.investedTotal)} />
              <StatCard
                label="Revenus de vente"
                value={euro(summary.revenueGross)}
                sub={`dont frais ${euro(summary.feesTotal)}`}
                tone="accent"
              />
              <StatCard
                label="Bénéfice net"
                value={`${summary.profitNet >= 0 ? '+' : ''}${euro(summary.profitNet)}`}
                sub={`${summary.salesCount} vente(s) · ${euro(summary.expensesTotal)} de dépenses`}
                tone={summary.profitNet >= 0 ? 'positive' : 'negative'}
              />
              <StatCard
                label="Stock restant"
                value={euro(summary.stockValue)}
                sub={`${summary.itemsInStock} exemplaire(s)${summary.stockPotentialNet > 0 ? ` · potentiel ~${euro(summary.stockPotentialNet)}` : ''}`}
              />
            </div>

            {(summary.roiPct != null || summary.topProducts.length > 0) && (
              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard
                  label="ROI (marge sur coût vendu)"
                  value={summary.roiPct != null ? `${summary.roiPct} %` : '—'}
                  tone="accent"
                />
                <StatCard
                  label="Rotation moyenne"
                  value={summary.avgDaysToSell != null ? `${summary.avgDaysToSell} j` : '—'}
                  sub="entre achat et vente"
                />
                <div className="card-pad">
                  <p className="mb-2 text-xs text-slate-500">Top produits (bénéfice)</p>
                  {summary.topProducts.length === 0 ? (
                    <p className="text-sm text-slate-500">—</p>
                  ) : (
                    <div className="space-y-1">
                      {summary.topProducts.slice(0, 3).map((p) => (
                        <div key={p.name} className="flex justify-between gap-2 text-sm">
                          <span className="truncate text-slate-300">{p.name}</span>
                          <span
                            className={`shrink-0 font-semibold ${p.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                          >
                            {p.profit >= 0 ? '+' : ''}
                            {euro(p.profit)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {fiscal && fiscal.revenue > 0 && (
              <div className="card-pad">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <h2 className="section-title">Micro-entrepreneur {fiscal.year}</h2>
                  <span className="text-xs text-slate-500">vente de marchandises</span>
                </div>
                <p className="mb-3 text-xs text-slate-500">
                  Estimations indicatives (barèmes {fiscal.year}). CA = ventes encaissées, hors retours.
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <StatCard label={`CA ${fiscal.year}`} value={euro(fiscal.revenue)} tone="accent" />
                  <StatCard
                    label={`Cotisations URSSAF (${Math.round(fiscal.urssafRate * 100)} %)`}
                    value={`~${euro(fiscal.urssafContributions)}`}
                    sub={`+ ${euro(fiscal.liberatoireOption)} si versement libératoire`}
                  />
                  <StatCard
                    label="Plafond micro-BIC"
                    value={`${fiscal.microCeilingPct} %`}
                    sub={`de ${euro(fiscal.microCeiling)}`}
                    tone={fiscal.microExceeded ? 'negative' : undefined}
                  />
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[rgb(var(--overlay)/0.05)]">
                  <div
                    className={`h-full rounded-full ${fiscal.microCeilingPct >= 80 ? 'bg-amber-400' : 'bg-accent'}`}
                    style={{ width: `${Math.min(100, fiscal.microCeilingPct)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {fiscal.vatExceeded ? (
                    <span className="text-amber-300">
                      ⚠️ Seuil de franchise de TVA dépassé ({euro(fiscal.vatFranchise)}) — TVA potentiellement due.
                    </span>
                  ) : (
                    <>Franchise de TVA : il te reste {euro(fiscal.vatFranchise - fiscal.revenue)} avant le seuil de {euro(fiscal.vatFranchise)}.</>
                  )}
                </p>
              </div>
            )}

            {summary.byCategory.filter((c) => c.salesCount > 0 || c.stockValue > 0).length > 0 && (
              <div className="card-pad">
                <h2 className="section-title mb-3">ROI par catégorie</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-500">
                        <th className="py-1 text-left font-medium">Catégorie</th>
                        <th className="py-1 text-right font-medium">Ventes</th>
                        <th className="py-1 text-right font-medium">Bénéfice</th>
                        <th className="py-1 text-right font-medium">ROI</th>
                        <th className="py-1 text-right font-medium">Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.byCategory
                        .filter((c) => c.salesCount > 0 || c.stockValue > 0)
                        .map((c) => (
                          <tr key={c.category} className="border-t border-line/60">
                            <td className="py-1.5 text-slate-200">{c.category}</td>
                            <td className="py-1.5 text-right text-slate-400">{c.salesCount}</td>
                            <td
                              className={`py-1.5 text-right font-semibold ${c.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                            >
                              {c.profit >= 0 ? '+' : ''}
                              {euro(c.profit)}
                            </td>
                            <td className="py-1.5 text-right text-slate-300">
                              {c.roiPct != null ? `${c.roiPct} %` : '—'}
                            </td>
                            <td className="py-1.5 text-right text-slate-400">{euro(c.stockValue)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {summary.monthly.length > 0 && (
              <div className="card-pad">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Détail mensuel
                </h2>
                <div className="overflow-x-auto">
                  <table className="table-base">
                    <thead>
                      <tr>
                        <th>Mois</th>
                        <th>Ventes</th>
                        <th>Chiffre d&apos;affaires</th>
                        <th>Frais</th>
                        <th>Coût d&apos;achat</th>
                        <th>Dépenses</th>
                        <th>Bénéfice net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.monthly.map((m) => (
                        <tr key={m.month}>
                          <td className="text-slate-200">{monthLabel(m.month)}</td>
                          <td className="text-slate-400">{m.salesCount}</td>
                          <td className="text-slate-300">{euro(m.revenue)}</td>
                          <td className="text-slate-400">{euro(m.fees)}</td>
                          <td className="text-slate-400">{euro(m.cost)}</td>
                          <td className="text-slate-400">{euro(m.expenses)}</td>
                          <td
                            className={`font-semibold ${m.profitNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                          >
                            {m.profitNet >= 0 ? '+' : ''}
                            {euro(m.profitNet)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="card-pad">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Dépenses annexes
              </h2>
              <form onSubmit={addExpense} className="mb-3 grid gap-2 sm:grid-cols-[1fr_140px_160px_auto]">
                <input
                  value={expenseLabel}
                  onChange={(e) => setExpenseLabel(e.target.value)}
                  placeholder="Libellé (ex : cartons, essence...)"
                  className="input"
                  required
                  maxLength={300}
                />
                <input
                  type="number"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  placeholder="Montant (€)"
                  className="input"
                  min="0.01"
                  step="0.01"
                  required
                />
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="input"
                >
                  <option value="emballage">Emballage</option>
                  <option value="transport">Transport</option>
                  <option value="abonnement">Abonnement</option>
                  <option value="autre">Autre</option>
                </select>
                <button type="submit" className="btn-primary">
                  <Plus className="h-4 w-4" /> Ajouter
                </button>
              </form>
              {expenses.length === 0 ? (
                <p className="px-1 text-sm text-slate-500">
                  Aucune dépense enregistrée — elles sont déduites du bénéfice net.
                </p>
              ) : (
                <div className="space-y-0.5">
                  {expenses.map((exp) => (
                    <div
                      key={exp.id}
                      className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-[rgb(var(--overlay)/0.05)]"
                    >
                      <div className="min-w-0">
                        <span className="text-sm text-slate-300">{exp.label}</span>
                        <span className="ml-2 text-xs text-slate-500">
                          {exp.category} · {dateFr(exp.expenseDate)}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-semibold text-rose-300">
                          −{euro(exp.amount)}
                        </span>
                        <button
                          onClick={() => removeExpense(exp)}
                          className="btn-ghost !p-1.5 hover:!text-rose-300"
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card-pad">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Historique des ventes
                  {summary.returnedCount > 0 && summary.returnRate != null && (
                    <span className="badge bg-amber-500/15 text-amber-300 normal-case">
                      <RotateCcw className="h-3 w-3" /> {summary.returnedCount} retour(s) · {summary.returnRate} %
                    </span>
                  )}
                </h2>
                {sales.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <input
                      value={salesQuery}
                      onChange={(e) => setSalesQuery(e.target.value)}
                      placeholder="Rechercher une vente…"
                      className="input !w-44 !py-1 !text-xs"
                      aria-label="Rechercher dans les ventes"
                    />
                    {salePlatforms.length > 1 && (
                      <select
                        value={salesPlatform}
                        onChange={(e) => setSalesPlatform(e.target.value)}
                        className="input !w-auto !py-1 !text-xs"
                        aria-label="Filtrer par plateforme"
                      >
                        <option value="all">Toutes les plateformes</option>
                        {salePlatforms.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    )}
                    <span className="whitespace-nowrap text-slate-500">
                      {filteredSales.length} vente(s) ·{' '}
                      <span className="font-semibold text-accent">{euro(filteredTotal)}</span>
                    </span>
                  </div>
                )}
              </div>
              {sales.length === 0 ? (
                <EmptyState
                  icon={<Wallet className="h-6 w-6" />}
                  title="Aucune vente enregistrée"
                  description="Vendez un objet depuis votre stock pour voir vos bénéfices ici."
                  action={
                    <Link href="/stock" className="btn-secondary text-sm">
                      <Package className="h-4 w-4" /> Aller au stock
                    </Link>
                  }
                />
              ) : filteredSales.length === 0 ? (
                <p className="px-1 text-sm text-slate-500">Aucune vente pour cette plateforme.</p>
              ) : (
                <div className="space-y-0.5">
                  {filteredSales.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-[rgb(var(--overlay)/0.05)]"
                    >
                      <div className="min-w-0">
                        <p className={`truncate text-sm ${s.returned ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                          {s.itemName}
                          {s.returned && <span className="ml-2 badge-muted no-underline">Retournée</span>}
                        </p>
                        <p className="text-xs text-slate-500">
                          {dateFr(s.saleDate)} &middot; {s.quantity} × {euro(s.unitPrice)}
                          {s.fees > 0 && <> &middot; frais {euro(s.fees)}</>}
                          {s.platform && <> &middot; {s.platform}</>}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className={`text-sm font-semibold ${s.returned ? 'text-slate-500' : 'text-accent'}`}>
                          {euro(s.total)}
                        </span>
                        <button
                          onClick={() => printSaleInvoice(s)}
                          className="btn-ghost"
                          title="Bon de vente / facture (PDF)"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                        {!s.returned && (
                          <button
                            onClick={() => returnSale(s)}
                            className="btn-ghost hover:!text-amber-300"
                            title="Marquer comme retournée (exclue de la compta)"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => cancelSale(s)}
                          className="btn-ghost hover:!text-rose-300"
                          title="Annuler cette vente (supprime l'enregistrement)"
                        >
                          <Undo2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}
