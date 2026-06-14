'use client';

import type { FormEvent } from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Loader2, Filter, Store, Truck, X, History, Mic } from 'lucide-react';
import type { IntentParams } from '@shopping-assistant/types';
import { apiFetch } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useAppStore } from '@/lib/store';

// SpeechRecognition types for TypeScript
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}
interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  length: number;
}
interface SpeechRecognitionAlternative {
  transcript: string;
}
interface SpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (e: SpeechRecognitionEvent) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}

export interface SearchFilters {
  minPrice?: string;
  maxPrice?: string;
  maxDays?: string;
  minRating?: string;
  site?: string;
  priority?: string;
}

interface SearchFormProps {
  onSearch?: (query: string, intent: IntentParams | null) => void;
  initialQuery?: string;
  initialFilters?: SearchFilters;
}

const SITE_OPTIONS = [
  { value: 'all', label: 'Tous les sites' },
  { value: 'amazon', label: 'Amazon.fr' },
  { value: 'ebay', label: 'eBay.fr' },
  { value: 'vinted', label: 'Vinted.fr' },
];

const POPULAR_SUGGESTIONS = [
  'casque bluetooth',
  'lego',
  'smartphone',
  'airpods',
  'nintendo switch',
  'playstation 5',
  'samsung galaxy',
  'apple watch',
];

export default function SearchForm({ onSearch, initialQuery = '', initialFilters }: SearchFormProps) {
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [showFilters, setShowFilters] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [maxPrice, setMaxPrice] = useState(initialFilters?.maxPrice ?? '');
  const [minPrice, setMinPrice] = useState(initialFilters?.minPrice ?? '');
  const [maxDays, setMaxDays] = useState(initialFilters?.maxDays ?? '');
  const [minRating, setMinRating] = useState(initialFilters?.minRating ?? '');
  const [site, setSite] = useState(initialFilters?.site ?? 'all');
  const [priority, setPriority] = useState<'price' | 'quality' | 'speed' | 'balanced'>(
    (initialFilters?.priority as 'price' | 'quality' | 'speed' | 'balanced') ?? 'balanced'
  );
  const [listening, setListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const recentSearches = useAppStore((s) => s.recentSearches);
  const addSearch = useAppStore((s) => s.addSearch);

  useEffect(() => {
    if (initialQuery) setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const parseQuery = useCallback((q: string): { query: string; excludeKeywords: string[] } => {
    // Exclusion "-mot" uniquement en debut ou apres un espace, pour ne pas
    // casser les termes a trait d'union ("t-shirt", "spider-man", "lego 75192-1").
    const excludeMatches = q.matchAll(/(?:^|\s)-([a-zA-Z0-9]+)/g);
    const excludeKeywords = Array.from(excludeMatches).map((m) => m[1].toLowerCase());
    const cleanedQuery = q.replace(/(?:^|\s)-[a-zA-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
    return { query: cleanedQuery, excludeKeywords };
  }, []);

  const parseOptionalNumber = (value: string) => {
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const buildIntent = useCallback(() => {
    const minPriceEur = parseOptionalNumber(minPrice);
    const maxPriceEur = parseOptionalNumber(maxPrice);
    const maxDeliveryDays = parseOptionalNumber(maxDays);
    const minRatingValue = parseOptionalNumber(minRating);

    if (minPriceEur !== null && minPriceEur < 0) {
      toast.error('Le prix minimum doit être positif');
      return null;
    }
    if (maxPriceEur !== null && maxPriceEur < 0) {
      toast.error('Le prix maximum doit être positif');
      return null;
    }
    if (minPriceEur !== null && maxPriceEur !== null && minPriceEur > maxPriceEur) {
      toast.error('Le prix minimum ne peut pas dépasser le prix maximum');
      return null;
    }
    if (maxDeliveryDays !== null && maxDeliveryDays < 1) {
      toast.error('Le délai maximum doit être supérieur à 0');
      return null;
    }
    if (minRatingValue !== null && (minRatingValue < 0 || minRatingValue > 5)) {
      toast.error('La note minimale doit être comprise entre 0 et 5');
      return null;
    }

    return {
      minPriceEur,
      maxPriceEur,
      maxDeliveryDays,
      minRating: minRatingValue,
    };
  }, [maxDays, maxPrice, minPrice, minRating]);

  const handleSubmit = async (e?: FormEvent<HTMLFormElement>, overrideQuery?: string) => {
    if (e) e.preventDefault();
    // overrideQuery : la voix et les suggestions soumettent la valeur reconnue
    // directement, car `query` (closure/state) serait encore l'ancienne valeur.
    const trimmed = (overrideQuery ?? query).trim();
    if (!trimmed) return;
    addSearch(trimmed); // historise la recherche (recherches recentes)

    setLoading(true);
    try {
      const { query: cleanQuery, excludeKeywords } = parseQuery(trimmed);
      const filterIntent = buildIntent();
      if (!filterIntent) return;
      const intent = await apiFetch<IntentParams>('/intent', {
        method: 'POST',
        json: {
          query: cleanQuery,
          excludeKeywords: excludeKeywords.length > 0 ? excludeKeywords : undefined,
          ...filterIntent,
          priority,
        },
      });
      // /intent ne recoit que la requete texte : il ignore les filtres saisis et
      // ne renvoie pas le site. On fait donc primer les valeurs EXPLICITES du
      // formulaire sur ce que /intent a deduit, et on rattache le site. Sans ca,
      // les champs prix/note/priorite du formulaire n'etaient jamais appliques.
      const enriched: IntentParams = {
        ...intent,
        ...(filterIntent.minPriceEur != null ? { minPriceEur: filterIntent.minPriceEur } : {}),
        ...(filterIntent.maxPriceEur != null ? { maxPriceEur: filterIntent.maxPriceEur } : {}),
        ...(filterIntent.maxDeliveryDays != null ? { maxDeliveryDays: filterIntent.maxDeliveryDays } : {}),
        ...(filterIntent.minRating != null ? { minRating: filterIntent.minRating } : {}),
        ...(priority !== 'balanced' ? { priority } : {}),
        site: site !== 'all' ? site : undefined,
      };
      onSearch?.(intent?.query || cleanQuery, enriched);
      setShowSuggestions(false);
    } catch {
      onSearch?.(trimmed, site !== 'all' ? { site } : null);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length > 0) {
      debounceRef.current = setTimeout(() => setShowSuggestions(true), 300);
    } else {
      setShowSuggestions(false);
    }
  };

  const clearFilters = () => {
    setMaxPrice('');
    setMinPrice('');
    setMaxDays('');
    setMinRating('');
    setSite('all');
    setPriority('balanced');
  };

  const hasActiveFilters = maxPrice || minPrice || maxDays || minRating || site !== 'all' || priority !== 'balanced';

  // Menu de saisie : recherches recentes (en premier) puis suggestions populaires.
  const lowerQuery = query.toLowerCase();
  const recentMatches = recentSearches.filter((s) => s.toLowerCase().includes(lowerQuery));
  const popularMatches = POPULAR_SUGGESTIONS.filter(
    (s) => s.toLowerCase().includes(lowerQuery) && !recentMatches.includes(s)
  );
  const suggestions = [
    ...recentMatches.map((text) => ({ text, recent: true })),
    ...popularMatches.map((text) => ({ text, recent: false })),
  ].slice(0, 6);

  const startVoiceRecognition = () => {
    const SR = (window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (!SR) {
      toast.error('Reconnaissance vocale non supportée par ce navigateur');
      return;
    }
    const recognition = new (SR as new () => SpeechRecognition)();
    recognition.lang = 'fr-FR';
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
      // Soumettre avec le transcript explicite (setQuery est asynchrone).
      handleSubmit(undefined, transcript);
    };
    recognition.onend = () => {
      setListening(false);
    };
    setListening(true);
    recognition.start();
  };

  return (
    <form
      onSubmit={(e) => handleSubmit(e)}
      className="flex flex-col gap-3 sm:flex-row"
      aria-label="Formulaire de recherche"
    >
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          ref={inputRef}
          type="text"
          name="query"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => query.length > 0 && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder="Ex : casque bluetooth, lego 75192, airpods pro 2... (utilisez -mot pour exclure)"
          className="input pl-9 pr-28"
          required
          aria-label="Rechercher des produits"
        />
        <kbd className="absolute right-10 top-1/2 hidden -translate-y-1/2 rounded border border-line-strong bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 sm:block">
          Ctrl+K
        </kbd>
        <button
          type="button"
          onClick={startVoiceRecognition}
          className={`absolute right-3 top-1/2 -translate-y-1/2 ${listening ? 'text-accent' : ''}`}
          aria-label="Recherche vocale"
          title="Recherche vocale"
        >
          <Mic className="h-4 w-4" />
        </button>
        
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-10 mt-1 rounded-lg border border-line bg-ink p-2 shadow-lg">
            {suggestions.map(({ text, recent }) => (
              <button
                key={text}
                type="button"
                onClick={() => { setQuery(text); setShowSuggestions(false); handleSubmit(undefined, text); }}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-white/5"
              >
                {recent ? (
                  <History className="h-3 w-3 text-accent" />
                ) : (
                  <Search className="h-3 w-3 text-slate-500" />
                )}
                {text}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowFilters(!showFilters)}
        className={`btn-secondary relative whitespace-nowrap ${hasActiveFilters ? 'ring-2 ring-accent' : ''}`}
        aria-label="Filtres avancés"
      >
        <Filter className="h-4 w-4" />
        Filtres
        {hasActiveFilters && (
          <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-accent text-[10px]" title="Filtres actifs">
            •
          </span>
        )}
      </button>

      <button type="submit" disabled={loading} className="btn-primary whitespace-nowrap">
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyse...
          </>
        ) : (
          <>
            <Search className="h-4 w-4" />
            Rechercher
          </>
        )}
      </button>

      {showFilters && (
        <div className="col-span-full grid gap-3 rounded-lg border border-line bg-ink/30 p-4 sm:grid-cols-3">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-slate-500" />
            <select
              value={site}
              onChange={(e) => setSite(e.target.value)}
              className="input w-full"
              aria-label="Site marchand"
            >
              {SITE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Prix min</label>
            <input
              type="number"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder="Min (€)"
              className="input w-full"
              min="0"
              step="0.01"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Prix max</label>
            <input
              type="number"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="Max (€)"
              className="input w-full"
              min="0"
              step="0.01"
            />
          </div>

          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-slate-500" />
            <input
              type="number"
              value={maxDays}
              onChange={(e) => setMaxDays(e.target.value)}
              placeholder="Délai max (jours)"
              className="input w-full"
              min="1"
              step="1"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Note min</label>
            <input
              type="number"
              value={minRating}
              onChange={(e) => setMinRating(e.target.value)}
              placeholder="Min (sur 5)"
              className="input w-full"
              min="0"
              max="5"
              step="0.1"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Priorité</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as typeof priority)}
              className="input w-full"
              aria-label="Priorité de tri"
            >
              <option value="balanced">Équilibré</option>
              <option value="price">Prix</option>
              <option value="quality">Qualité</option>
              <option value="speed">Rapidité</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="btn-ghost col-span-full justify-self-start !px-2 !py-1 text-xs"
            >
              <X className="h-3 w-3" />
              Tout effacer
            </button>
          )}
        </div>
      )}
    </form>
  );
}