'use client';

import Link from 'next/link';
import { Search, Command, ShoppingBag } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import BackendStatus from '@/components/BackendStatus';
import NotificationBell from '@/components/NotificationBell';
import MobileNav from '@/components/MobileNav';
import { useI18n } from '@/lib/i18n';

function openPalette() {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
}

export default function Topbar() {
  const { t } = useI18n();
  return (
    <header className="safe-pt sticky top-0 z-30 border-b border-line bg-ink/90">
      <div className="flex h-14 items-center gap-2 px-4 sm:gap-3 sm:px-6">
        {/* Menu mobile + marque (la sidebar les porte sur desktop) */}
        <MobileNav />
        <Link href="/" className="flex items-center gap-2 md:hidden" title="Accueil">
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
          <span className="hidden sm:inline">{t('topbar.searchPage', 'Rechercher une page…')}</span>
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
    </header>
  );
}
