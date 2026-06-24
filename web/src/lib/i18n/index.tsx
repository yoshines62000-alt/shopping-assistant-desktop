'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { fr, type TranslationKey } from './fr';
import { en } from './en';
import { es } from './es';
import { de } from './de';
import { it } from './it';

export type Locale = 'fr' | 'en' | 'es' | 'de' | 'it';

const DICTS: Record<Locale, Record<TranslationKey, string>> = { fr, en, es, de, it };

/** Langues proposées (libellés en langue native = endonymes). */
export const LOCALES: { code: Locale; label: string; flag: string }[] = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
];

const STORAGE_KEY = 'locale';
const isLocale = (v: unknown): v is Locale =>
  typeof v === 'string' && LOCALES.some((l) => l.code === v);

type TFn = (key: TranslationKey, fallback?: string) => string;

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: TFn;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  // Démarre en FR (rendu statique/SSR) puis adopte la langue mémorisée au montage.
  const [locale, setLocaleState] = useState<Locale>('fr');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (isLocale(saved)) {
        setLocaleState(saved);
        document.documentElement.lang = saved;
      }
    } catch {
      /* localStorage indisponible */
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = l;
  }, []);

  // Repli : langue courante -> français -> texte fourni -> clé brute.
  const t = useCallback<TFn>(
    (key, fallback) => DICTS[locale][key] ?? fr[key] ?? fallback ?? key,
    [locale]
  );

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

/** Hook i18n. En dehors du provider (ex. test isolé), renvoie le français. */
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  return { locale: 'fr', setLocale: () => {}, t: (key, fallback) => fr[key] ?? fallback ?? key };
}
