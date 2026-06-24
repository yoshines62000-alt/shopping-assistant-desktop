'use client';

import { useEffect, useState } from 'react';
import { LATEST_VERSION } from './changelog';

const STORAGE_KEY = 'changelog-seen';

/** Événement émis par la page /changelog quand la dernière version est vue. */
export const CHANGELOG_SEEN_EVENT = 'changelog-seen';

/** Marque la dernière version comme vue + notifie la nav (pour retirer le point). */
export function markChangelogSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, LATEST_VERSION);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(CHANGELOG_SEEN_EVENT));
}

/** true tant que l'utilisateur n'a pas ouvert la dernière version du changelog. */
export function useChangelogUnseen(): boolean {
  const [unseen, setUnseen] = useState(false);

  useEffect(() => {
    const check = () => {
      try {
        setUnseen(localStorage.getItem(STORAGE_KEY) !== LATEST_VERSION);
      } catch {
        setUnseen(false);
      }
    };
    check();
    window.addEventListener(CHANGELOG_SEEN_EVENT, check);
    return () => window.removeEventListener(CHANGELOG_SEEN_EVENT, check);
  }, []);

  return unseen;
}
