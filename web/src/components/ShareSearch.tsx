'use client';

import { Share2, Check } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

export default function ShareSearch() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = `${window.location.origin}/search?q=${encodeURIComponent(query)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Recherche Shopping Assistant', url });
      } catch {
        /* user cancelled */
      }
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!query) return null;

  return (
    <button onClick={share} className="btn-secondary text-xs" title="Partager cette recherche">
      {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      {copied ? 'Copié !' : 'Partager'}
    </button>
  );
}
