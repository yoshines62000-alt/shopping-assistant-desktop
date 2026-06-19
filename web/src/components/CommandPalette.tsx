'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Sparkles,
  GitCompareArrows,
  Coins,
  Package,
  BookOpenCheck,
  Heart,
  Bell,
  Newspaper,
  ScanBarcode,
  Settings,
  Home,
} from 'lucide-react';

interface Command {
  label: string;
  href: string;
  icon: JSX.Element;
  keywords?: string;
}

const COMMANDS: Command[] = [
  { label: 'Accueil', href: '/', icon: <Home className="h-4 w-4" />, keywords: 'dashboard tableau de bord' },
  { label: 'Recherche', href: '/search', icon: <Search className="h-4 w-4" /> },
  { label: 'Bonnes affaires', href: '/deals', icon: <Sparkles className="h-4 w-4" />, keywords: 'deals flips' },
  { label: 'Arbitrage', href: '/arbitrage', icon: <GitCompareArrows className="h-4 w-4" /> },
  { label: 'Estimation de revente', href: '/estimate', icon: <Coins className="h-4 w-4" />, keywords: 'prix marge' },
  { label: 'Mon stock', href: '/stock', icon: <Package className="h-4 w-4" />, keywords: 'inventaire dormant' },
  { label: 'Mes comptes', href: '/accounting', icon: <BookOpenCheck className="h-4 w-4" />, keywords: 'compta bénéfice csv' },
  { label: 'Mes favoris', href: '/shopping-list', icon: <Heart className="h-4 w-4" />, keywords: 'liste coeur' },
  { label: 'Alertes & surveillances', href: '/alerts', icon: <Bell className="h-4 w-4" />, keywords: 'deal-watcher notifications' },
  { label: 'Digest', href: '/digest', icon: <Newspaper className="h-4 w-4" /> },
  { label: 'Scanner un code-barres', href: '/scan', icon: <ScanBarcode className="h-4 w-4" /> },
  { label: 'Réglages', href: '/settings', icon: <Settings className="h-4 w-4" />, keywords: 'sauvegarde telegram email frais' },
];

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return COMMANDS;
    return COMMANDS.filter(
      (c) => c.label.toLowerCase().includes(term) || (c.keywords ?? '').includes(term)
    );
  }, [q]);

  const close = useCallback(() => {
    setOpen(false);
    setQ('');
    setActive(0);
  }, []);

  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router]
  );

  // Ouverture globale Ctrl/Cmd+K.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') {
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => setActive(0), [q]);

  if (!open) return null;

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      go(results[active].href);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 p-4 pt-[12vh] backdrop-blur-sm"
      onClick={close}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-line bg-ink shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onListKey}
            placeholder="Aller à… (tape pour filtrer)"
            className="w-full bg-transparent py-3 text-sm text-slate-100 outline-none placeholder:text-slate-600"
          />
          <kbd className="rounded border border-line px-1.5 py-0.5 text-[10px] text-slate-500">Esc</kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto p-1">
          {results.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-slate-500">Aucun résultat</li>
          )}
          {results.map((c, i) => (
            <li key={c.href}>
              <button
                onMouseEnter={() => setActive(i)}
                onClick={() => go(c.href)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${
                  i === active ? 'bg-accent/15 text-slate-100' : 'text-slate-300'
                }`}
              >
                <span className="text-accent">{c.icon}</span>
                {c.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
