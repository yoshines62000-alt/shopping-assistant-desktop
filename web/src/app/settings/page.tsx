'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import type { AppSettings } from '@shopping-assistant/types';
import { Settings, Save, Download, Check, Upload, Send, Bell, RotateCcw, Wifi } from 'lucide-react';
import PageShell from '@/components/ui/PageShell';
import SecretInput from '@/components/ui/SecretInput';
import ErrorBanner from '@/components/ui/ErrorBanner';
import LoadingBlock from '@/components/ui/LoadingBlock';
import { apiFetch } from '@/lib/api';
import { API_BASE, setApiBase } from '@/lib/config';
import { toast } from '@/lib/toast';
import ScrapingHealth from '@/components/ScrapingHealth';
import AccentPicker from '@/components/AccentPicker';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useI18n } from '@/lib/i18n';

const PLATFORM_LABELS: Record<string, string> = {
  ebay: 'eBay',
  vinted: 'Vinted',
  leboncoin: 'Leboncoin',
  autre: 'Autre',
};

export default function SettingsPage() {
  const { t } = useI18n();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [fees, setFees] = useState<Record<string, string>>({});
  const [webhook, setWebhook] = useState('');
  const [tgToken, setTgToken] = useState('');
  const [tgChat, setTgChat] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [emailFrom, setEmailFrom] = useState('');
  const [emailTo, setEmailTo] = useState('');
  const [alertMinutes, setAlertMinutes] = useState('60');
  const [reestimateDays, setReestimateDays] = useState('7');
  const [favRefreshHours, setFavRefreshHours] = useState('24');
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [testing, setTesting] = useState(false);
  const [backendUrl, setBackendUrl] = useState(API_BASE);
  const [conn, setConn] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const fileInput = useRef<HTMLInputElement>(null);

  const saveBackendUrl = () => {
    setApiBase(backendUrl);
    toast.success('Backend enregistré — rechargement…');
    setTimeout(() => window.location.reload(), 600);
  };

  // Teste l'adresse SAISIE (pas celle enregistrée) en pingant /health, avec latence.
  const testBackend = async () => {
    const url = backendUrl.trim().replace(/\/+$/, '');
    if (!url) {
      toast.error('Renseigne d’abord une adresse de backend');
      return;
    }
    setConn('testing');
    const t0 = performance.now();
    try {
      const res = await fetch(`${url}/health`, { cache: 'no-store' });
      const ms = Math.round(performance.now() - t0);
      if (res.ok) {
        setConn('ok');
        toast.success(`Backend joignable (${ms} ms)`);
      } else {
        setConn('fail');
        toast.error(`Le backend a répondu ${res.status}`);
      }
    } catch {
      setConn('fail');
      toast.error('Backend injoignable à cette adresse');
    }
  };

  // Remplit le formulaire depuis un objet réglages (réutilisé pour « annuler »).
  const hydrate = (s: AppSettings) => {
    setFees(
      Object.fromEntries(
        Object.entries(s.platformFees).map(([k, v]) => [k, String(Math.round(v * 1000) / 10)])
      )
    );
    setWebhook(s.discordWebhookUrl);
    setTgToken(s.telegramBotToken ?? '');
    setTgChat(s.telegramChatId ?? '');
    setSmtpHost(s.smtpHost ?? '');
    setSmtpPort(String(s.smtpPort ?? 587));
    setSmtpUser(s.smtpUser ?? '');
    setSmtpPassword(s.smtpPassword ?? '');
    setEmailFrom(s.emailFrom ?? '');
    setEmailTo(s.emailTo ?? '');
    setAlertMinutes(String(s.alertCheckMinutes));
    setReestimateDays(String(s.reestimateDays));
    setFavRefreshHours(String(s.favoritesRefreshHours ?? 24));
    setWeeklyDigest(!!s.weeklyDigestEnabled);
  };

  useEffect(() => {
    apiFetch<AppSettings>('/settings')
      .then((s) => {
        setSettings(s);
        hydrate(s);
      })
      .catch(() => setError('Impossible de charger les réglages.'));
  }, []);

  const discardChanges = () => {
    if (settings) {
      hydrate(settings);
      toast.info('Modifications annulées');
    }
  };

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
          telegramBotToken: tgToken.trim(),
          telegramChatId: tgChat.trim(),
          smtpHost: smtpHost.trim(),
          smtpPort: Number(smtpPort) || 587,
          smtpUser: smtpUser.trim(),
          smtpPassword: smtpPassword,
          emailFrom: emailFrom.trim(),
          emailTo: emailTo.trim(),
          alertCheckMinutes: Number(alertMinutes) || 60,
          reestimateDays: Number(reestimateDays) || 7,
          favoritesRefreshHours: Number(favRefreshHours),
          weeklyDigestEnabled: weeklyDigest,
        },
      });
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError('Sauvegarde impossible (webhook Discord invalide ou taux hors limites ?).');
    }
  };

  const testNotification = async () => {
    setTesting(true);
    try {
      const res = await apiFetch<{ sent: Record<string, boolean> }>('/settings/test-notification', {
        method: 'POST',
      });
      const ok = Object.entries(res.sent)
        .filter(([, v]) => v)
        .map(([k]) => k);
      toast.success(`Test envoyé : ${ok.join(', ') || 'aucun canal'}`);
    } catch {
      toast.error('Aucun canal configuré ou échec. Pense à enregistrer d’abord.');
    } finally {
      setTesting(false);
    }
  };

  const exportBackup = async () => {
    try {
      const data = await apiFetch<unknown>('/backup/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shopping-assistant-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Export impossible. Vérifiez que le service est démarré.');
    }
  };

  const importBackup = async (file: File) => {
    if (
      !window.confirm(
        'Restaurer cette sauvegarde ? Les tables présentes dans le fichier seront remplacées.'
      )
    )
      return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await apiFetch<{ restored: Record<string, number>; errors: string[] }>(
        '/backup/import',
        { method: 'POST', json: { ...parsed, replace: true } }
      );
      const total = Object.values(res.restored).reduce((s, n) => s + n, 0);
      toast.success(`Restauré : ${total} ligne(s)${res.errors.length ? `, ${res.errors.length} erreur(s)` : ''}`);
    } catch {
      setError('Restauration impossible (fichier invalide ?).');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <PageShell
      title={t('settings.title', 'Réglages')}
      icon={<Settings className="h-6 w-6" />}
      subtitle={t('settings.subtitle', 'Frais de revente, notifications, sauvegarde et tâches automatiques')}
    >
      <div className="space-y-4">
        {error && <ErrorBanner message={error} />}

        <div className="card-pad">
          <h2 className="mb-1 text-sm font-semibold text-slate-100">{t('settings.language', 'Langue')}</h2>
          <p className="mb-4 text-xs text-slate-500">
            {t('settings.languageHelp', "Langue de l'interface (appliquée et mémorisée aussitôt).")}
          </p>
          <LanguageSwitcher />
        </div>

        <div className="card-pad">
          <h2 className="mb-1 text-sm font-semibold text-slate-100">{t('settings.appearance', 'Apparence')}</h2>
          <p className="mb-4 text-xs text-slate-500">
            Couleur d&apos;accent de l&apos;interface (appliquée et mémorisée aussitôt). Le thème
            clair/sombre se change depuis la barre du haut.
          </p>
          <AccentPicker />
        </div>

        <div className="card-pad">
          <h2 className="mb-1 text-sm font-semibold text-slate-100">{t('settings.backend', 'Connexion au backend')}</h2>
          <p className="mb-3 text-xs text-slate-500">
            Adresse du service de recherche. Sur l&apos;app <strong>mobile</strong>, indique l&apos;IP de
            ton PC sur le réseau local (ex. <code className="text-slate-400">http://192.168.1.20:8756</code>) —
            le PC doit faire tourner l&apos;application desktop et le port <strong>8756</strong> doit être
            autorisé dans le pare-feu. Le téléphone et le PC doivent être sur le même Wi-Fi.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              value={backendUrl}
              onChange={(e) => {
                setBackendUrl(e.target.value);
                setConn('idle');
              }}
              placeholder="http://192.168.1.20:8756"
              className="input min-w-[200px] flex-1"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
            />
            <button
              type="button"
              onClick={testBackend}
              disabled={conn === 'testing'}
              className="btn-secondary whitespace-nowrap"
            >
              <Wifi className="h-4 w-4" /> {conn === 'testing' ? t('settings.backendTesting', 'Test…') : t('settings.backendTest', 'Tester')}
            </button>
            <button type="button" onClick={saveBackendUrl} className="btn-secondary whitespace-nowrap">
              {t('settings.backendSave', 'Enregistrer & recharger')}
            </button>
          </div>
          {conn === 'ok' && (
            <p className="mt-2 text-xs text-emerald-400">{t('settings.backendReachable', '✓ Backend joignable à cette adresse.')}</p>
          )}
          {conn === 'fail' && (
            <p className="mt-2 text-xs text-rose-400">
              ✗ Injoignable. Vérifie : même Wi-Fi, pare-feu (port 8756), IP du PC correcte, app desktop lancée.
            </p>
          )}
          <p className="mt-2 text-xs text-slate-600">{t('settings.currently', 'Actuellement')} : {API_BASE || '(non défini)'}</p>
        </div>

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
              <div className="mb-1 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-100">Notifications</h2>
                <button
                  type="button"
                  onClick={testNotification}
                  disabled={testing}
                  className="btn-secondary !px-3 !py-1 text-xs"
                >
                  <Send className="h-3.5 w-3.5" /> {testing ? 'Envoi…' : 'Tester'}
                </button>
              </div>
              <p className="mb-3 text-xs text-slate-500">
                Canaux notifiés quand une alerte prix ou un bon plan se déclenche. Renseigne ceux que
                tu veux (les autres restent inactifs). Enregistre avant de tester.
              </p>

              <label className="mb-3 block">
                <span className="mb-1 block text-xs text-slate-400">Webhook Discord</span>
                <SecretInput
                  value={webhook}
                  onChange={setWebhook}
                  placeholder="https://discord.com/api/webhooks/..."
                />
              </label>

              <div className="mb-3 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-400">Telegram — Bot token</span>
                  <SecretInput
                    value={tgToken}
                    onChange={setTgToken}
                    placeholder="123456:ABC-DEF..."
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-400">Telegram — Chat ID</span>
                  <input
                    value={tgChat}
                    onChange={(e) => setTgChat(e.target.value)}
                    placeholder="ex : 987654321"
                    className="input"
                  />
                </label>
              </div>

              <details className="rounded-lg border border-line bg-ink/30 p-3">
                <summary className="cursor-pointer text-xs font-medium text-slate-300">
                  <Bell className="mr-1 inline h-3.5 w-3.5" /> E-mail (SMTP) — optionnel
                </summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-xs text-slate-400">Destinataire</span>
                    <input
                      value={emailTo}
                      onChange={(e) => setEmailTo(e.target.value)}
                      placeholder="moi@exemple.fr"
                      className="input"
                      type="email"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-slate-400">Serveur SMTP</span>
                    <input
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      placeholder="smtp.gmail.com"
                      className="input"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-slate-400">Port</span>
                    <input
                      type="number"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                      className="input"
                      min="1"
                      max="65535"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-slate-400">Utilisateur</span>
                    <input
                      value={smtpUser}
                      onChange={(e) => setSmtpUser(e.target.value)}
                      placeholder="moi@gmail.com"
                      className="input"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-slate-400">Mot de passe</span>
                    <SecretInput
                      value={smtpPassword}
                      onChange={setSmtpPassword}
                      placeholder="mot de passe d’application"
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-xs text-slate-400">
                      Expéditeur (optionnel, défaut = utilisateur)
                    </span>
                    <input
                      value={emailFrom}
                      onChange={(e) => setEmailFrom(e.target.value)}
                      placeholder="moi@gmail.com"
                      className="input"
                    />
                  </label>
                </div>
              </details>
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
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-400">
                    Rafraîchissement des prix de favoris
                  </span>
                  <select
                    value={favRefreshHours}
                    onChange={(e) => setFavRefreshHours(e.target.value)}
                    className="input"
                  >
                    <option value="0">Désactivé</option>
                    <option value="12">Toutes les 12 h</option>
                    <option value="24">Une fois par jour</option>
                    <option value="48">Tous les 2 jours</option>
                    <option value="168">Une fois par semaine</option>
                  </select>
                </label>
              </div>
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={weeklyDigest}
                  onChange={(e) => setWeeklyDigest(e.target.checked)}
                  className="h-4 w-4 accent-cyan-400"
                />
                Envoyer un <strong>digest hebdomadaire</strong> (baisses de prix + activité) aux canaux de notification
              </label>
            </div>

            <div className="card-pad">
              <h2 className="mb-1 text-sm font-semibold text-slate-100">Sauvegarde des données</h2>
              <p className="mb-4 text-xs text-slate-500">
                Exporte toute ta base (stock, ventes, alertes, historique…) en un fichier JSON, ou
                restaure une sauvegarde précédente. Idéal avant de changer de machine. Les
                identifiants (webhook Discord, token Telegram, mot de passe SMTP) sont{' '}
                <span className="text-slate-400">exclus du fichier</span> pour ta sécurité — ils
                restent en place lors d&apos;une restauration.
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={exportBackup} className="btn-secondary">
                  <Download className="h-4 w-4" /> Télécharger une sauvegarde
                </button>
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="btn-secondary"
                >
                  <Upload className="h-4 w-4" /> Restaurer…
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) importBackup(f);
                  }}
                />
              </div>
            </div>

            <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface/95 p-2">
              <button type="submit" className="btn-primary">
                {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {saved ? 'Enregistré' : 'Enregistrer'}
              </button>
              <button type="button" onClick={discardChanges} className="btn-secondary">
                <RotateCcw className="h-4 w-4" /> Annuler les modifications
              </button>
              <span className="ml-auto pr-1 text-xs text-slate-500">
                Les réglages sont enregistrés localement (inclus dans la sauvegarde).
              </span>
            </div>
          </form>
        )}

        <ScrapingHealth />
      </div>
    </PageShell>
  );
}
