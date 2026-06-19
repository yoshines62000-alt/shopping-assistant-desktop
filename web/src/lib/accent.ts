// Personnalisation de la couleur d'accent. S'appuie sur les variables CSS du
// thème (--c-accent / --c-accent-deep, en triplets RGB). Chaque preset fournit
// une teinte par thème (vive en sombre, plus profonde en clair pour le contraste).

export type ThemeName = 'dark' | 'light';

export interface Accent {
  id: string;
  label: string;
  swatch: string; // couleur d'aperçu de la pastille
  dark: { accent: string; deep: string };
  light: { accent: string; deep: string };
}

export const ACCENTS: Accent[] = [
  { id: 'cyan', label: 'Cyan', swatch: '#22d3ee', dark: { accent: '34 211 238', deep: '8 145 178' }, light: { accent: '8 145 178', deep: '14 116 144' } },
  { id: 'violet', label: 'Violet', swatch: '#8b5cf6', dark: { accent: '139 92 246', deep: '124 58 237' }, light: { accent: '124 58 237', deep: '109 40 217' } },
  { id: 'emerald', label: 'Émeraude', swatch: '#10b981', dark: { accent: '16 185 129', deep: '5 150 105' }, light: { accent: '5 150 105', deep: '4 120 87' } },
  { id: 'amber', label: 'Ambre', swatch: '#f59e0b', dark: { accent: '245 158 11', deep: '217 119 6' }, light: { accent: '217 119 6', deep: '180 83 9' } },
  { id: 'rose', label: 'Rose', swatch: '#f43f5e', dark: { accent: '244 63 94', deep: '225 29 72' }, light: { accent: '225 29 72', deep: '190 18 60' } },
  { id: 'blue', label: 'Bleu', swatch: '#3b82f6', dark: { accent: '59 130 246', deep: '37 99 235' }, light: { accent: '37 99 235', deep: '29 78 216' } },
];

export const DEFAULT_ACCENT = 'cyan';

export function getSavedAccent(): string {
  try {
    return localStorage.getItem('accent') || DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT;
  }
}

export function applyAccent(id: string, theme: ThemeName): void {
  const a = ACCENTS.find((x) => x.id === id) ?? ACCENTS[0];
  const v = theme === 'light' ? a.light : a.dark;
  const root = document.documentElement;
  root.style.setProperty('--c-accent', v.accent);
  root.style.setProperty('--c-accent-deep', v.deep);
}

export function saveAccent(id: string): void {
  try {
    localStorage.setItem('accent', id);
  } catch {
    /* localStorage indisponible */
  }
}

export function currentTheme(): ThemeName {
  return (document.documentElement.dataset.theme as ThemeName) || 'dark';
}
