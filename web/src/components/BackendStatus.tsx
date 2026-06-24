'use client';

import { useState, useEffect } from 'react';
import { API_BASE } from '@/lib/config';
import { useI18n } from '@/lib/i18n';

type State = 'checking' | 'online' | 'offline';

/**
 * Voyant de connexion au backend. Ping `/health` (hors préfixe /api/v1)
 * toutes les 20 s. Rassure l'utilisateur si un serveur est tombé.
 */
export default function BackendStatus() {
  const { t } = useI18n();
  const [state, setState] = useState<State>('checking');

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const res = await fetch(`${API_BASE}/health`, { cache: 'no-store' });
        if (active) setState(res.ok ? 'online' : 'offline');
      } catch {
        if (active) setState('offline');
      }
    };
    check();
    const id = setInterval(check, 20000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const label =
    state === 'online'
      ? t('status.online', 'Services connectés')
      : state === 'offline'
        ? t('status.offline', 'Services hors ligne')
        : t('status.checking', 'Connexion…');
  const dot =
    state === 'online' ? 'bg-emerald-400' : state === 'offline' ? 'bg-rose-400' : 'bg-slate-500';

  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs text-slate-500"
      title={
        state === 'offline'
          ? "Backend injoignable. Vérifie qu'il tourne (et, sur mobile, l'adresse dans Réglages → Connexion au backend)."
          : label
      }
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot} ${state === 'checking' ? 'animate-pulse' : ''}`} />
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}
