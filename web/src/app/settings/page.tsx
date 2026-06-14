'use client';

import { useState, useEffect, FormEvent } from 'react';
import type { AppSettings } from '@shopping-assistant/types';
import { Settings, Save, Download, Check } from 'lucide-react';
import PageShell from '@/components/ui/PageShell';
import ErrorBanner from '@/components/ui/ErrorBanner';
import LoadingBlock from '@/components/ui/LoadingBlock';
import { apiFetch } from '@/lib/api';

const PLATFORM_LABELS: Record<string, string> = {
  ebay: 'eBay',
  vinted: 'Vinted',
  leboncoin: 'Leboncoin',
  autre: 'Autre',
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [fees, setFees] = useState<Record<string, string>>({});
  const [webhook, setWebhook] = useState('');
  const [alertMinutes, setAlertMinutes] = useState('60');
  const [reestimateDays, setReestimateDays] = useState('7');

  useEffect(() => {
    apiFetch<AppSettings>('/settings')
      .then((s) => {
        setSettings(s);
        setFees(
          Object.fromEntries(
            Object.entries(s.platformFees).map(([k, v]) => [k, String(Math.round(v * 1000) / 10)])
          )
        );
        setWebhook(s.discordWebhookUrl);
        setAlertMinutes(String(s.alertCheckMinutes));
        setReestimateDays(String(s.reestimateDays));
      })
      .catch(() => setError('Impossible de charger les réglages.'));
  }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      const updated = await apiFetch<AppSettings>('/settings', {
        method: 'PUT',
        json: {
          platformFees: Object.fromEntries(
            Object.entries(fees).map(([k, v]) => [k, (Number(v) || 0) / 100])
          ),
          discordWebhookUrl: webhook.trim(),
          alertCheckMinutes: Number(alertMinutes) || 60,
          reestimateDays: Number(reestimateDays) || 7,
        },
      });
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError('Sauvegarde impossible (webhook Discord invalide ou taux hors limites ?).');
    }
  };

  const exportBackup = async () => {
    try {
      const data = await apiFetch<unknown>('/admin/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shopping-assistant-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Export impossible. Vérifiez que le service est démarré.");
    }
  };

  return (
    <PageShell
      title="Réglages"
      icon={<Settings className="h-6 w-6" />}
      subtitle="Frais de revente, notifications et tâches automatiques"
    >
      <div className="space-y-4">
        {error && <ErrorBanner message={error} />}
        {!settings && !error && <LoadingBlock label="Chargement des réglages..." />}

        {settings && (
          <form onSubmit={save} className="space-y-4">
            <div className="card-pad">
              <h2 className="mb-1 text-sm font-semibold text-slate-100">
                Frais de revente par plateforme
              </h2>
              <p className="mb-4 text-xs text-slate-500">
                Pourcentage déduit du prix de vente pour calculer le net vendeur des estimations.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Object.keys(fees).map((platform) => (
                  <label key={platform} className="block">
                    <span className="mb-1 block text-xs text-slate-400">
                      {PLATFORM_LABELS[platform] ?? platform}
                    </span>
                    <div className="relative">
                      <input
                        type="number"
                        value={fees[platform]}
                        onChange={(e) => setFees({ ...fees, [platform]: e.target.value })}
                        className="input pr-8"
                        min="0"
                        max="90"
                        step="0.1"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                        %
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="card-pad">
              <h2 className="mb-1 text-sm font-semibold text-slate-100">Notifications Discord</h2>
              <p className="mb-4 text-xs text-slate-500">
                Webhook appelé quand une alerte prix se déclenche (Serveur Discord → Paramètres →
                Intégrations → Webhooks).
              </p>
              <input
                value={webhook}
                onChange={(e) => setWebhook(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                className="input"
                type="url"
              />
            </div>

            <div className="card-pad">
              <h2 className="mb-4 text-sm font-semibold text-slate-100">Tâches automatiques</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-400">
                    Vérification des alertes (minutes)
                  </span>
                  <input
                    type="number"
                    value={alertMinutes}
                    onChange={(e) => setAlertMinutes(e.target.value)}
                    className="input"
                    min="5"
                    max="1440"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-400">
                    Ré-estimation du stock (jours)
                  </span>
                  <input
                    type="number"
                    value={reestimateDays}
                    onChange={(e) => setReestimateDays(e.target.value)}
                    className="input"
                    min="1"
                    max="90"
                  />
                </label>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn-primary">
                {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {saved ? 'Enregistré' : 'Enregistrer'}
              </button>
              <button type="button" onClick={exportBackup} className="btn-secondary">
                <Download className="h-4 w-4" /> Exporter une sauvegarde (JSON)
              </button>
            </div>
          </form>
        )}
      </div>
    </PageShell>
  );
}
