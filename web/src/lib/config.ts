// Origine de l'API (sans le préfixe /api/v1).
//
// Ordre de résolution :
//  1. localStorage `apiBase` — réglé à l'exécution (indispensable sur mobile :
//     l'app pointe vers le backend du PC sur le réseau local, ex.
//     http://192.168.x.y:8000, dont l'IP n'est pas connue au moment du build).
//  2. NEXT_PUBLIC_API_URL — figé au build (desktop / web).
//  3. http://localhost:8000 — défaut (service scraping en direct).
const BUILD_DEFAULT = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

function resolveApiBase(): string {
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem('apiBase');
      if (saved && saved.trim()) return saved.trim().replace(/\/+$/, '');
    } catch {
      /* localStorage indisponible */
    }
  }
  return BUILD_DEFAULT;
}

export const API_BASE = resolveApiBase();

/** Enregistre l'URL du backend (ex. http://192.168.1.20:8000). API_BASE étant
 *  résolu à l'import, l'appelant doit recharger pour que ça prenne effet partout. */
export function setApiBase(url: string): void {
  try {
    window.localStorage.setItem('apiBase', url.trim().replace(/\/+$/, ''));
  } catch {
    /* ignore */
  }
}
