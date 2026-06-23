'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Sparkles, BellRing, AlertTriangle, ExternalLink } from 'lucide-react';
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

interface PriceAlert {
  alertId: string;
  productId: string;
  name: string | null;
  thresholdPrice: number;
  active: boolean;
  triggeredAt: string | null;
}

interface ConnHealth {
  circuitOpen: boolean;
  parserSuspect?: boolean;
  lastIssue: string | null;
  secondsSinceAttempt: number | null;
}

interface NotifItem {
  key: string;
  type: 'deal' | 'alert' | 'warn';
  name: string;
  sub: string;
  href: string;
  external: boolean;
  ts: number;
}

const SEEN_KEY = 'notif-last-seen';

// Les dates backend sont en UTC naïf (sans suffixe) : on ajoute « Z » sinon le
// navigateur les lit en heure locale -> ts décalé (fausse tri/non-lus/relatif).
const tsOf = (iso: string): number =>
  new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`).getTime();

/** Cloche de notifications : bonnes affaires de la veille (deal-watcher) + alertes
 *  prix déclenchées (un produit surveillé a atteint ton seuil), avec pastille de
 *  non-lus + lien vers les alertes. */
export default function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<NotifItem[]>([]);
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

  const load = useCallback(async () => {
    const [dealsRes, alertsRes, healthRes] = await Promise.all([
      apiFetch<{ deals?: DealHit[] }>('/watch/deals?limit=20').catch(() => ({ deals: [] })),
      apiFetch<{ alerts?: PriceAlert[] }>('/alerts').catch(() => ({ alerts: [] })),
      apiFetch<{ connectors?: Record<string, ConnHealth> }>('/connectors/health').catch(
        () => ({ connectors: {} as Record<string, ConnHealth> })
      ),
    ]);
    const deals: NotifItem[] = (dealsRes.deals ?? []).map((d) => ({
      key: `deal-${d.id}`,
      type: 'deal',
      name: d.name,
      sub: `${euro(d.price)} · ${d.siteDomain}`,
      href: d.sourceUrl,
      external: true,
      ts: tsOf(d.foundAt),
    }));
    const alerts: NotifItem[] = (alertsRes.alerts ?? [])
      .filter((a) => !a.active && a.triggeredAt)
      .map((a) => ({
        key: `alert-${a.alertId}`,
        type: 'alert',
        name: a.name || `${a.productId.slice(0, 24)}…`,
        sub: `seuil atteint · ${euro(a.thresholdPrice)}`,
        href: `/products/${encodeURIComponent(a.productId)}`,
        external: false,
        ts: a.triggeredAt ? tsOf(a.triggeredAt) : 0,
      }));
    // Sources en panne (circuit ouvert) ou parser cassé : on les remonte aussi.
    const warns: NotifItem[] = Object.entries(healthRes.connectors ?? {})
      .filter(([, h]) => h.circuitOpen || h.parserSuspect)
      .map(([name, h]) => ({
        key: `warn-${name}`,
        type: 'warn',
        name: h.parserSuspect ? `Source ${name} : parser à vérifier` : `Source ${name} en panne`,
        sub: h.parserSuspect ? 'page reçue mais 0 résultat' : h.lastIssue || 'circuit ouvert (anti-bot)',
        href: '/settings',
        external: false,
        ts: Date.now() - (h.secondsSinceAttempt ?? 0) * 1000,
      }));
    setItems([...warns, ...deals, ...alerts].sort((x, y) => y.ts - x.ts).slice(0, 30));
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 120000); // rafraîchit toutes les 2 min
    return () => clearInterval(id);
  }, [load]);

  const unread = mounted ? items.filter((it) => it.ts > lastSeen).length : 0;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
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

            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-500">
                Rien à signaler. Surveille un prix ou une recherche depuis « Alertes ».
              </p>
            ) : (
              <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
                {items.map((it) => {
                  const inner = (
                    <span className="flex items-start gap-2.5 px-3 py-2.5 transition-colors hover:bg-[rgb(var(--overlay)/0.05)]">
                      {it.type === 'deal' ? (
                        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      ) : it.type === 'warn' ? (
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                      ) : (
                        <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-slate-200">{it.name}</span>
                        <span className="text-xs text-slate-500">
                          <span className="numeric text-slate-400">{it.sub}</span>
                          <span className="mx-1.5 text-slate-600">·</span>
                          {relativeTime(new Date(it.ts).toISOString())}
                        </span>
                      </span>
                      {it.external && <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600" />}
                    </span>
                  );
                  return (
                    <li key={it.key}>
                      {it.external ? (
                        <a href={it.href} target="_blank" rel="noreferrer">
                          {inner}
                        </a>
                      ) : (
                        <button
                          type="button"
                          className="w-full text-left"
                          onClick={() => {
                            setOpen(false);
                            router.push(it.href);
                          }}
                        >
                          {inner}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
