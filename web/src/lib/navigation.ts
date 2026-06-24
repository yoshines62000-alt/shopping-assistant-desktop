// Source unique de la navigation (sidebar desktop + tiroir mobile).
// Évite la dérive entre les menus (auparavant dupliqués dans Sidebar et Topbar).
import {
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
  Megaphone,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import type { TranslationKey } from './i18n/fr';

export interface NavItem {
  href: string;
  /** Clé i18n du libellé. */
  tkey: TranslationKey;
  /** Libellé français (repli si traduction absente). */
  label: string;
  icon: LucideIcon;
  /** Affiche la pastille du nombre de favoris. */
  badge?: boolean;
}

export const NAV_HOME: NavItem = { href: '/', tkey: 'nav.home', label: 'Accueil', icon: Home };

export const NAV_GROUPS: { labelKey: TranslationKey; label: string; items: NavItem[] }[] = [
  {
    labelKey: 'group.explore',
    label: 'Explorer',
    items: [
      { href: '/search', tkey: 'nav.search', label: 'Recherche', icon: Search },
      { href: '/deals', tkey: 'nav.deals', label: 'Affaires', icon: Sparkles },
      { href: '/arbitrage', tkey: 'nav.arbitrage', label: 'Arbitrage', icon: ArrowLeftRight },
      { href: '/estimate', tkey: 'nav.estimate', label: 'Estimation', icon: Coins },
    ],
  },
  {
    labelKey: 'group.manage',
    label: 'Gérer',
    items: [
      { href: '/stock', tkey: 'nav.stock', label: 'Stock', icon: Package },
      { href: '/accounting', tkey: 'nav.accounting', label: 'Comptes', icon: Wallet },
      { href: '/shopping-list', tkey: 'nav.favorites', label: 'Favoris', icon: Heart, badge: true },
      { href: '/alerts', tkey: 'nav.alerts', label: 'Alertes', icon: Bell },
      { href: '/digest', tkey: 'nav.digest', label: 'Digest', icon: Newspaper },
    ],
  },
];

export const NAV_BOTTOM: NavItem[] = [
  { href: '/scan', tkey: 'nav.scan', label: 'Scanner', icon: ScanBarcode },
  { href: '/changelog', tkey: 'nav.changelog', label: 'Nouveautés', icon: Megaphone },
  { href: '/settings', tkey: 'nav.settings', label: 'Réglages', icon: Settings },
];

/** Renvoie true si le lien doit apparaître actif pour le chemin courant. */
export function isNavActive(href: string, pathname: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}
