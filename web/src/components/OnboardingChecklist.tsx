'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Package, Wallet, Check, X, Sparkles } from 'lucide-react';
import { useAppStore } from '@/lib/store';

const DISMISS_KEY = 'onboarding-dismissed';

/**
 * Guide de prise en main affiché tant que les 3 premières étapes ne sont pas
 * faites (et que l'utilisateur ne l'a pas masqué). La progression est dérivée
 * de l'état réel : recherches récentes (local) + stock / ventes (compta).
 */
export default function OnboardingChecklist({
  hasStock,
  hasSale,
}: {
  hasStock: boolean;
  hasSale: boolean;
}) {
  const recentSearches = useAppStore((s) => s.recentSearches);
  // Caché par défaut pour éviter un flash avant lecture du localStorage (SSR).
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === '1');
  }, []);

  const steps = [
    {
      done: recentSearches.length > 0,
      label: 'Lance ta première recherche',
      href: '/search',
      icon: <Search className="h-4 w-4" />,
    },
    {
      done: hasStock,
      label: 'Ajoute un objet à ton stock',
      href: '/stock',
      icon: <Package className="h-4 w-4" />,
    },
    {
      done: hasSale,
      label: 'Enregistre ta première vente',
      href: '/accounting',
      icon: <Wallet className="h-4 w-4" />,
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  if (dismissed || doneCount === steps.length) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  return (
    <section className="card-pad animate-fade-in relative mt-10">
      <button
        onClick={dismiss}
        className="btn-ghost absolute right-2 top-2 !p-1.5"
        aria-label="Masquer le guide"
        title="Masquer le guide"
      >
        <X className="h-4 w-4" />
      </button>
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-100">
        <Sparkles className="h-4 w-4 text-accent" /> Premiers pas
        <span className="text-xs font-normal text-slate-500">({doneCount}/3)</span>
      </h2>
      <p className="mb-3 text-xs text-slate-500">Trois étapes pour prendre l&apos;app en main.</p>
      <div className="space-y-1.5">
        {steps.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors ${
              s.done
                ? 'border-emerald-500/20 bg-emerald-500/5 text-slate-400'
                : 'border-line bg-ink/40 text-slate-200 hover:border-accent/40'
            }`}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                s.done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-accent/10 text-accent'
              }`}
            >
              {s.done ? <Check className="h-3.5 w-3.5" /> : s.icon}
            </span>
            <span className={s.done ? 'line-through' : ''}>{s.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
