'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ShoppingBag, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useFavorites, migrateLocalFavorites } from '@/lib/favorites';
import { NAV_HOME, NAV_GROUPS, NAV_BOTTOM, isNavActive, type NavItem } from '@/lib/navigation';
import { useI18n } from '@/lib/i18n';
import clsx from 'clsx';

type Item = NavItem;

export default function Sidebar() {
  const pathname = usePathname();
  const { t } = useI18n();
  const { favoriteIds, loaded, load } = useFavorites();
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setCollapsed(localStorage.getItem('sidebar-collapsed') === '1');
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    if (!loaded) migrateLocalFavorites().then(load);
  }, [loaded, load]);

  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem('sidebar-collapsed', c ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !c;
    });

  const favCount = mounted ? favoriteIds.size : 0;

  const renderItem = (item: Item) => {
    const active = isNavActive(item.href, pathname);
    const Icon = item.icon;
    const label = t(item.tkey, item.label);
    return (
      <Link
        key={item.href}
        href={item.href}
        title={collapsed ? label : undefined}
        className={clsx('side-link', active && 'side-link-active', collapsed && 'justify-center')}
      >
        <span className="relative flex shrink-0 items-center justify-center">
          <Icon className="h-[18px] w-[18px]" />
          {item.badge && favCount > 0 && (
            <span className="absolute -right-2 -top-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-ink">
              {favCount}
            </span>
          )}
        </span>
        {!collapsed && <span className="truncate">{label}</span>}
        {active && <span aria-hidden className="side-glow" />}
      </Link>
    );
  };

  return (
    <aside
      className={clsx(
        'sticky top-0 z-40 hidden h-screen shrink-0 flex-col border-r border-line bg-surface/95 transition-[width] duration-200 md:flex',
        collapsed ? 'w-[72px]' : 'w-60'
      )}
    >
      {/* Marque */}
      <div className={clsx('flex h-16 items-center gap-2.5 px-4', collapsed && 'justify-center px-0')}>
        <Link href="/" className="flex items-center gap-2.5" title="Accueil">
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-deep text-white shadow-glow ring-1 ring-accent/30">
            <ShoppingBag className="h-5 w-5" />
          </span>
          {!collapsed && <span className="brand-text text-base font-bold tracking-tight">Shopping Assistant</span>}
        </Link>
      </div>

      {/* Accueil */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <div className="mb-1">{renderItem(NAV_HOME)}</div>

        {NAV_GROUPS.map((g) => (
          <div key={g.labelKey} className="mt-4">
            {!collapsed && <p className="side-group-label">{t(g.labelKey, g.label)}</p>}
            <div className="space-y-0.5">{g.items.map(renderItem)}</div>
          </div>
        ))}
      </nav>

      {/* Bas : utilitaires + repli */}
      <div className="space-y-0.5 border-t border-line px-3 py-3">
        {NAV_BOTTOM.map(renderItem)}
        <button
          onClick={toggle}
          className={clsx('side-link w-full', collapsed && 'justify-center')}
          title={collapsed ? t('nav.expand', 'Déplier') : t('nav.collapse', 'Replier')}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-[18px] w-[18px] shrink-0" />
          ) : (
            <PanelLeftClose className="h-[18px] w-[18px] shrink-0" />
          )}
          {!collapsed && <span>{t('nav.collapse', 'Replier')}</span>}
        </button>
      </div>
    </aside>
  );
}
