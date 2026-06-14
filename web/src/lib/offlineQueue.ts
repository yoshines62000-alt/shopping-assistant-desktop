'use client';

// File d'attente simple persistée en localStorage : utile en brocante quand le
// reseau est intermittent (on met les recherches en attente et on les traite au
// retour de la connexion).

const PREFIX = 'sa-queue:';

export function readQueue(key: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function writeQueue(key: string, items: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(items));
  } catch {
    /* quota / mode prive : on ignore */
  }
}

export function enqueue(key: string, item: string): string[] {
  const items = readQueue(key);
  if (!items.includes(item)) items.push(item);
  writeQueue(key, items);
  return items;
}
