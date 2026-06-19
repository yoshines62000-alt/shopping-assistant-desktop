'use client';

import { useState } from 'react';
import { ImageOff } from 'lucide-react';

/**
 * Vignette produit unifiée : affiche l'image si disponible, sinon un placeholder
 * cohérent (icône sur fond discret). Garantit des listes alignées et soignées
 * même quand certaines offres n'ont pas de photo. Utilisée partout où l'on liste
 * des produits (recherche, affaires, arbitrage, comparaison, stock).
 */
const SIZES = {
  sm: 'h-12 w-12',
  md: 'h-16 w-16',
  lg: 'h-20 w-20',
} as const;

export default function ProductThumb({
  src,
  alt = '',
  size = 'md',
  className = '',
  onClick,
}: {
  src?: string | null;
  alt?: string;
  size?: keyof typeof SIZES;
  className?: string;
  onClick?: () => void;
}) {
  const [broken, setBroken] = useState(false);
  const box = `${SIZES[size]} shrink-0 overflow-hidden rounded-lg ring-1 ring-line ${className}`;
  const showImg = src && !broken;

  const content = showImg ? (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className="h-full w-full object-cover"
      onError={() => setBroken(true)}
    />
  ) : (
    <div className="flex h-full w-full items-center justify-center bg-surface-raised text-slate-600">
      <ImageOff className="h-5 w-5" />
    </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${box} transition-opacity hover:opacity-80`} title="Voir les photos">
        {content}
      </button>
    );
  }
  return <div className={box}>{content}</div>;
}
