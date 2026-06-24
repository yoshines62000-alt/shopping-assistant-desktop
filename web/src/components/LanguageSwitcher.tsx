'use client';

import { useI18n, LOCALES } from '@/lib/i18n';
import clsx from 'clsx';

/** Boutons de choix de langue (drapeau + nom natif). Applique aussitôt. */
export default function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  return (
    <div className="flex flex-wrap gap-2">
      {LOCALES.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLocale(l.code)}
          aria-pressed={locale === l.code}
          className={clsx(
            'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors',
            locale === l.code
              ? 'border-accent/50 bg-accent/10 text-slate-100'
              : 'border-line bg-surface/60 text-slate-400 hover:border-accent/40 hover:text-slate-200'
          )}
        >
          <span aria-hidden className="text-base leading-none">
            {l.flag}
          </span>
          {l.label}
        </button>
      ))}
    </div>
  );
}
