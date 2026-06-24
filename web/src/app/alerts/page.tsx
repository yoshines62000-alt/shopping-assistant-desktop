'use client';

import { useState, useEffect, useCallback, ChangeEvent, FormEvent } from 'react';
import Link from 'next/link';
import type { PriceAlert } from '@shopping-assistant/types';
import { Bell, BellOff, BellRing, Trash2, Settings, Pencil, Check, X } from 'lucide-react';
import PageShell from '@/components/ui/PageShell';
import StatCard from '@/components/ui/StatCard';
import EmptyState from '@/components/ui/EmptyState';
import SavedSearches from '@/components/SavedSearches';
import { apiFetch } from '@/lib/api';
import { toast } from '@/lib/toast';
import { euro, dateFr } from '@/lib/format';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [productId, setProductId] = useState('');
  const [threshold, setThreshold] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');

  const load = useCallback(() => {
    apiFetch<{ alerts?: PriceAlert[] }>('/alerts')
      .then((r) => setAlerts(r.alerts ?? []))
      .catch(() => setAlerts([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createAlert = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/alerts', {
        method: 'POST',
        json: { productId, thresholdPrice: Number(threshold), channels: ['email'] },
      });
      toast.success('Alerte créée');
      setProductId('');
      setThreshold('');
      load();
    } catch {
      toast.error('Erreur lors de la création de l’alerte');
    }
  };

  const removeAlert = async (alert: PriceAlert) => {
    await apiFetch(`/alerts/${alert.alertId}`, { method: 'DELETE' }).catch(() => null);
    load();
  };

  const startEdit = (alert: PriceAlert) => {
    setEditingId(alert.alertId);
    setEditVal(String(alert.thresholdPrice));
  };

  const saveThreshold = async (alert: PriceAlert) => {
    const v = Number(editVal.replace(',', '.'));
    if (!Number.isFinite(v) || v <= 0) {
      toast.error('Seuil invalide');
      return;
    }
    try {
      await apiFetch(`/alerts/${alert.alertId}`, { method: 'PATCH', json: { thresholdPrice: v } });
      setEditingId(null);
      toast.success(`Seuil mis à jour : ${euro(v)}`);
      load();
    } catch {
      toast.error('Mise à jour impossible');
    }
  };

  const handleChange = (setter: (v: string) => void) => (e: ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
  };

  const active = alerts.filter((a) => a.active);
  const triggered = alerts.filter((a) => !a.active && a.triggeredAt);

  return (
    <PageShell
      title="Alertes & surveillances"
      icon={<Bell className="h-6 w-6" />}
      subtitle="Surveille des recherches favorites ou un produit précis — re-scan automatique en fond et notification quand le prix passe sous ta cible"
      actions={
        <Link href="/settings" className="btn-ghost text-xs" title="Configurer le webhook Discord">
          <Settings className="h-4 w-4" /> Configurer Discord
        </Link>
      }
    >
      <div className="space-y-4">
        {alerts.length > 0 && (
          <div className="animate-fade-in grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Alertes actives" value={String(active.length)} tone="accent" />
            <StatCard label="Déclenchées" value={String(triggered.length)} tone={triggered.length > 0 ? 'positive' : 'default'} />
            <StatCard label="Total suivies" value={String(alerts.length)} />
          </div>
        )}

        <SavedSearches />

        <div className="card-pad">
          <h2 className="mb-3 text-sm font-semibold text-slate-100">Créer une alerte</h2>
          <form onSubmit={createAlert}>
            <div className="mb-3 grid gap-3 sm:grid-cols-2">
              <input
                value={productId}
                onChange={handleChange(setProductId)}
                placeholder="ID du produit (URL de l'offre)"
                className="input"
                required
              />
              <input
                type="number"
                value={threshold}
                onChange={handleChange(setThreshold)}
                placeholder="Prix cible (€)"
                className="input"
                min="0"
                step="0.01"
                required
              />
            </div>
            <button type="submit" className="btn-primary">
              <Bell className="h-4 w-4" /> Créer
            </button>
          </form>
        </div>

        <div className="card-pad">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Alertes actives ({active.length})
          </h2>
          {active.length === 0 ? (
            <EmptyState
              icon={<BellOff className="h-6 w-6" />}
              title="Aucune alerte active"
              description="Créez une alerte depuis la page d'un produit ou avec le formulaire ci-dessus."
            />
          ) : (
            <div className="space-y-1.5">
              {active.map((a) => (
                <div
                  key={a.alertId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-line bg-ink/40 px-3 py-2.5"
                >
                  {editingId === a.alertId ? (
                    <span className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-300">
                      <span className="truncate">{a.name || `${a.productId.slice(0, 24)}…`}</span>
                      <span className="shrink-0 text-slate-500">seuil</span>
                      <input
                        type="number"
                        value={editVal}
                        onChange={(e) => setEditVal(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveThreshold(a)}
                        className="input !w-24 !py-1 text-sm"
                        min="0"
                        step="0.01"
                        autoFocus
                      />
                    </span>
                  ) : (
                    <Link
                      href={`/products?id=${encodeURIComponent(a.productId)}`}
                      className="truncate text-sm text-slate-300 hover:text-accent"
                    >
                      {a.name || `${a.productId.slice(0, 24)}…`} — seuil {euro(a.thresholdPrice)}
                    </Link>
                  )}
                  <span className="flex shrink-0 items-center gap-1.5">
                    {editingId === a.alertId ? (
                      <>
                        <button onClick={() => saveThreshold(a)} className="btn-ghost !p-1.5 hover:!text-accent" title="Enregistrer">
                          <Check className="h-4 w-4" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="btn-ghost !p-1.5" title="Annuler">
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="badge-success">ACTIVE</span>
                        <button
                          onClick={() => startEdit(a)}
                          className="btn-ghost !p-1.5 hover:!text-accent"
                          title="Modifier le seuil"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => removeAlert(a)}
                      className="btn-ghost !p-1.5 hover:!text-rose-300"
                      title="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {triggered.length > 0 && (
          <div className="card-pad">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Alertes déclenchées ({triggered.length})
            </h2>
            <div className="space-y-1.5">
              {triggered.map((a) => (
                <div
                  key={a.alertId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5"
                >
                  <Link
                    href={`/products?id=${encodeURIComponent(a.productId)}`}
                    className="flex min-w-0 items-center gap-2 text-sm text-slate-300 hover:text-accent"
                  >
                    <BellRing className="h-4 w-4 shrink-0 text-emerald-400" />
                    <span className="truncate">
                      {a.name || `${a.productId.slice(0, 24)}…`} — seuil {euro(a.thresholdPrice)} atteint
                      {a.triggeredAt && ` le ${dateFr(a.triggeredAt)}`}
                    </span>
                  </Link>
                  <button
                    onClick={() => removeAlert(a)}
                    className="btn-ghost !p-1.5 shrink-0 hover:!text-rose-300"
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
