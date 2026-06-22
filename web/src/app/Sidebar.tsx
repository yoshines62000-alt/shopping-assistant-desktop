'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Home,
  Search,
  Sparkles,
  ArrowLeftRight,
  Coins,
  Package,
  Wallet,
  Heart,
  Bell,
  Newspaper,
  ScanBarcode,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react';
import { useFavorites, migrateLocalFavorites } from '@/lib/favorites';
import clsx from 'clsx';

interface Item {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: boolean;
}

const GROUPS: { label: string; items: Item[] }[] = [
  {
    label: 'Explorer',
    items: [
      { href: '/search', label: 'Recherche', icon: Search },
      { href: '/deals', label: 'Affaires', icon: Sparkles },
      { href: '/arbitrage', label: 'Arbitrage', icon: ArrowLeftRight },
      { href: '/estimate', label: 'Estimation', icon: Coins },
    ],
  },
  {
    label: 'Gérer',
    items: [
      { href: '/stock', label: 'Stock', icon: Package },
      { href: '/accounting', label: 'Comptes', icon: Wallet },
      { href: '/shopping-list', label: 'Favoris', icon: Heart, badge: true },
      { href: '/alerts', label: 'Alertes', icon: Bell },
      { href: '/digest', label: 'Digest', icon: Newspaper },
    ],
  },
];

const BOTTOM: Item[] = [
  { href: '/scan', label: 'Scanner', icon: ScanBarcode },
  { href: '/settings', label: 'Réglages', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
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
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  const renderItem = (item: Item) => {
    const active = isActive(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        title={collapsed ? item.label : undefined}
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
        {!collapsed && <span className="truncate">{item.label}</span>}
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
        <div className="mb-1">{renderItem({ href: '/', label: 'Accueil', icon: Home })}</div>

        {GROUPS.map((g) => (
          <div key={g.label} className="mt-4">
            {!collapsed && <p className="side-group-label">{g.label}</p>}
            <div className="space-y-0.5">{g.items.map(renderItem)}</div>
          </div>
        ))}
      </nav>

      {/* Bas : utilitaires + repli */}
      <div className="space-y-0.5 border-t border-line px-3 py-3">
        {BOTTOM.map(renderItem)}
        <button
          onClick={toggle}
          className={clsx('side-link w-full', collapsed && 'justify-center')}
          title={collapsed ? 'Déplier le menu' : 'Replier le menu'}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-[18px] w-[18px] shrink-0" />
          ) : (
            <PanelLeftClose className="h-[18px] w-[18px] shrink-0" />
          )}
          {!collapsed && <span>Replier</span>}
        </button>
      </div>
    </aside>
  );
}
