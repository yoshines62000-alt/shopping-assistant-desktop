'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Menu, X, ShoppingBag } from 'lucide-react';
import { useFavorites } from '@/lib/favorites';
import { NAV_HOME, NAV_GROUPS, NAV_BOTTOM, isNavActive, type NavItem } from '@/lib/navigation';
import { useI18n } from '@/lib/i18n';
import clsx from 'clsx';

/**
 * Navigation mobile (< md) : bouton hamburger + tiroir latéral donnant accès à
 * TOUTES les pages (la sidebar desktop est masquée sur petit écran). Indispensable
 * pour atteindre Réglages / Scanner / Digest depuis un téléphone.
 */
export default function MobileNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const { favoriteIds } = useFavorites();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  // Ferme le tiroir à chaque changement de page.
  useEffect(() => setOpen(false), [pathname]);
  // Bloque le défilement de la page tant que le tiroir est ouvert.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const favCount = mounted ? favoriteIds.size : 0;

  const renderItem = (item: NavItem) => {
    const active = isNavActive(item.href, pathname);
    const Icon = item.icon;
    return (
      <Link key={item.href} href={item.href} className={clsx('side-link', active && 'side-link-active')}>
        <span className="relative flex shrink-0 items-center justify-center">
          <Icon className="h-[18px] w-[18px]" />
          {item.badge && favCount > 0 && (
            <span className="absolute -right-2 -top-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-ink">
              {favCount}
            </span>
          )}
        </span>
        <span className="truncate">{t(item.tkey, item.label)}</span>
        {active && <span aria-hidden className="side-glow" />}
      </Link>
    );
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-ghost !p-2 md:hidden"
        aria-label={t('nav.openMenu', 'Ouvrir le menu')}
        title={t('nav.openMenu', 'Ouvrir le menu')}
      >
        <Menu className="h-5 w-5" />
      </button>

      <div
        className={clsx('fixed inset-0 z-50 md:hidden', open ? 'pointer-events-auto' : 'pointer-events-none')}
        aria-hidden={!open}
      >
        {/* Voile */}
        <div
          onClick={() => setOpen(false)}
          className={clsx('absolute inset-0 bg-black/60 transition-opacity duration-200', open ? 'opacity-100' : 'opacity-0')}
        />
        {/* Panneau coulissant */}
        <aside
          className={clsx(
            'safe-pt absolute left-0 top-0 flex h-full w-[82%] max-w-xs flex-col border-r border-line bg-surface shadow-2xl transition-transform duration-200',
            open ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="flex h-16 items-center justify-between gap-2 px-4">
            <Link href="/" className="flex items-center gap-2.5" title="Accueil">
              <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-deep text-white shadow-glow ring-1 ring-accent/30">
                <ShoppingBag className="h-5 w-5" />
              </span>
              <span className="brand-text text-base font-bold tracking-tight">Shopping Assistant</span>
            </Link>
            <button
              onClick={() => setOpen(false)}
              className="btn-ghost !p-2"
              aria-label={t('nav.closeMenu', 'Fermer le menu')}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-3 pb-6">
            <div className="mb-1">{renderItem(NAV_HOME)}</div>
            {NAV_GROUPS.map((g) => (
              <div key={g.labelKey} className="mt-4">
                <p className="side-group-label">{t(g.labelKey, g.label)}</p>
                <div className="space-y-0.5">{g.items.map(renderItem)}</div>
              </div>
            ))}
            <div className="mt-4 space-y-0.5 border-t border-line pt-3">{NAV_BOTTOM.map(renderItem)}</div>
          </nav>
        </aside>
      </div>
    </>
  );
}
