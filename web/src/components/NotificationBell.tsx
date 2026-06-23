'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Bell, Sparkles, ExternalLink } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { euro, relativeTime } from '@/lib/format';

interface DealHit {
  id: number;
  name: string;
  price: number;
  sourceUrl: string;
  siteDomain: string;
  foundAt: string;
}

const SEEN_KEY = 'notif-last-seen';

/** Cloche de notifications : bonnes affaires repérées par la veille (deal-watcher),
 *  avec pastille de non-lus + lien vers les alertes. */
export default function NotificationBell() {
  const [deals, setDeals] = useState<DealHit[]>([]);
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setLastSeen(Number(localStorage.getItem(SEEN_KEY) || 0));
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(() => {
    apiFetch<{ deals?: DealHit[] }>('/watch/deals?limit=20')
      .then((d) => setDeals(d.deals ?? []))
      .catch(() => setDeals([]));
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 120000); // rafraîchit toutes les 2 min
    return () => clearInterval(id);
  }, [load]);

  const unread = mounted ? deals.filter((d) => new Date(d.foundAt).getTime() > lastSeen).length : 0;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      // Ouvrir = tout marquer comme lu.
      const now = Date.now();
      setLastSeen(now);
      try {
        localStorage.setItem(SEEN_KEY, String(now));
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <div className="relative">
      <button
        onClick={toggle}
        className="nav-link relative !px-2"
        title="Notifications"
        aria-label={`Notifications${unread > 0 ? ` (${unread} non lues)` : ''}`}
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-ink">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Capture le clic extérieur */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-50 mt-2 w-[min(92vw,22rem)] overflow-hidden rounded-xl border border-line-strong bg-surface shadow-card-hover">
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <span className="text-sm font-semibold text-slate-100">Notifications</span>
              <Link
                href="/alerts"
                onClick={() => setOpen(false)}
                className="text-xs text-accent hover:text-cyan-300"
              >
                Alertes & surveillances →
              </Link>
            </div>

            {deals.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-500">
                Aucune bonne affaire pour l&apos;instant. Surveille une recherche depuis « Alertes ».
              </p>
            ) : (
              <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
                {deals.map((d) => (
                  <li key={d.id}>
                    <a
                      href={d.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-start gap-2.5 px-3 py-2.5 transition-colors hover:bg-[rgb(var(--overlay)/0.05)]"
                    >
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-slate-200">{d.name}</span>
                        <span className="text-xs text-slate-500">
                          <span className="numeric font-semibold text-accent">{euro(d.price)}</span>
                          <span className="mx-1.5 text-slate-600">·</span>
                          {d.siteDomain}
                          <span className="mx-1.5 text-slate-600">·</span>
                          {relativeTime(d.foundAt)}
                        </span>
                      </span>
                      <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
