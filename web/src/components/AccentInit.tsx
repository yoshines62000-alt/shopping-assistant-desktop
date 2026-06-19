'use client';

import { useEffect } from 'react';
import { applyAccent, currentTheme, getSavedAccent } from '@/lib/accent';

/**
 * Applique la couleur d'accent enregistrée au chargement, et la réapplique
 * automatiquement quand le thème change (la teinte diffère clair/sombre).
 * Ne rend rien — monté une fois dans le layout.
 */
export default function AccentInit() {
  useEffect(() => {
    const sync = () => applyAccent(getSavedAccent(), currentTheme());
    sync();
    const observer = new MutationObserver((mutations) => {
      if (mutations.some((m) => m.attributeName === 'data-theme')) sync();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return null;
}
