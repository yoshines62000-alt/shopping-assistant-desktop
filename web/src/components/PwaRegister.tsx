'use client';

import { useEffect } from 'react';

/** Enregistre le service worker (installabilité PWA). */
export default function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* PWA optionnelle : ignore les échecs (ex. contexte non sécurisé) */
      });
    }
  }, []);
  return null;
}
