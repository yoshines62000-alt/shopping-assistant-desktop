'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ShoppingBag, Settings, ScanBarcode } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import clsx from 'clsx';

const navItems = [
  { href: '/search', label: 'Recherche' },
  { href: '/deals', label: 'Affaires' },
  { href: '/arbitrage', label: 'Arbitrage' },
  { href: '/estimate', label: 'Estimation' },
  { href: '/stock', label: 'Stock' },
  { href: '/accounting', label: 'Comptes' },
  { href: '/shopping-list', label: 'Liste' },
  { href: '/alerts', label: 'Alertes' },
  { href: '/digest', label: 'Digest' },
];

export default function Nav() {
  const pathname = usePathname();
  const { shoppingList } = useAppStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const listCount = mounted ? shoppingList.length : 0;

  return (
    <nav className="sticky top-0 z-50 border-b border-line bg-ink/80 backdrop-blur-md">
      <div className="page-container flex h-14 items-center justify-between gap-3">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-bold tracking-tight">
          <ShoppingBag className="h-5 w-5 text-accent" />
          <span className="brand-text hidden sm:inline">Shopping Assistant</span>
        </Link>

        <div className="flex items-center gap-0.5 overflow-x-auto whitespace-nowrap sm:gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={clsx('nav-link', pathname.startsWith(item.href) && 'nav-link-active')}
            >
              {item.label}
              {item.href === '/shopping-list' && listCount > 0 && (
                <span className="ml-1.5 inline-flex h-4 min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-ink">
                  {listCount}
                </span>
              )}
            </Link>
          ))}
          <Link
            href="/scan"
            className={clsx('nav-link !px-2', pathname.startsWith('/scan') && 'nav-link-active')}
            title="Scanner un code-barres"
            aria-label="Scanner un code-barres"
          >
            <ScanBarcode className="h-4 w-4" />
          </Link>
          <Link
            href="/settings"
            className={clsx(
              'nav-link !px-2',
              pathname.startsWith('/settings') && 'nav-link-active'
            )}
            title="Réglages"
            aria-label="Réglages"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </nav>
  );
}