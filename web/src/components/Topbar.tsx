'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Search,
  Command,
  Sparkles,
  ArrowLeftRight,
  Coins,
  Package,
  Wallet,
  Heart,
  Bell,
  ShoppingBag,
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import BackendStatus from '@/components/BackendStatus';
import NotificationBell from '@/components/NotificationBell';
import clsx from 'clsx';

const MOBILE_LINKS = [
  { href: '/search', label: 'Recherche', icon: Search },
  { href: '/deals', label: 'Affaires', icon: Sparkles },
  { href: '/arbitrage', label: 'Arbitrage', icon: ArrowLeftRight },
  { href: '/estimate', label: 'Estimation', icon: Coins },
  { href: '/stock', label: 'Stock', icon: Package },
  { href: '/accounting', label: 'Comptes', icon: Wallet },
  { href: '/shopping-list', label: 'Favoris', icon: Heart },
  { href: '/alerts', label: 'Alertes', icon: Bell },
];

function openPalette() {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
}

export default function Topbar() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ink/90">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
        {/* Marque (mobile uniquement, la sidebar la porte sur desktop) */}
        <Link href="/" className="flex items-center gap-2 md:hidden">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-deep text-white">
            <ShoppingBag className="h-4 w-4" />
          </span>
        </Link>

        {/* Déclencheur palette de commandes */}
        <button
          onClick={openPalette}
          className="group flex items-center gap-2 rounded-lg border border-line-strong bg-surface/60 px-3 py-1.5 text-sm text-slate-400 transition-colors hover:border-accent/40 hover:text-slate-200"
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Rechercher une page…</span>
          <span className="ml-2 hidden items-center gap-0.5 rounded border border-line-strong px-1.5 py-0.5 font-mono text-[10px] text-slate-500 sm:flex">
            <Command className="h-3 w-3" /> K
          </span>
        </button>

        <div className="ml-auto flex items-center gap-2">
          <BackendStatus />
          <NotificationBell />
          <ThemeToggle />
        </div>
      </div>

      {/* Navigation horizontale de repli (petits écrans) */}
      <nav className="flex items-center gap-1 overflow-x-auto px-3 pb-2 md:hidden">
        {MOBILE_LINKS.map((l) => {
          const active = pathname.startsWith(l.href);
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={clsx('nav-link inline-flex shrink-0 items-center gap-1.5', active && 'nav-link-active')}
            >
              <Icon className="h-4 w-4" /> {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
