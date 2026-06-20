'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Keyboard, X } from 'lucide-react';

// Raccourcis « aller à » façon chord (g puis lettre), inspirés de GitHub/Linear.
const GOTO: Record<string, { href: string; label: string }> = {
  h: { href: '/', label: 'Accueil' },
  r: { href: '/search', label: 'Recherche' },
  a: { href: '/deals', label: 'Affaires' },
  s: { href: '/stock', label: 'Stock' },
  c: { href: '/accounting', label: 'Comptes' },
  f: { href: '/shopping-list', label: 'Favoris' },
  e: { href: '/estimate', label: 'Estimation' },
  v: { href: '/alerts', label: 'Alertes & surveillances' },
};

function isTyping(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
}

export default function KeyboardShortcuts() {
  const router = useRouter();
  const [help, setHelp] = useState(false);
  const pendingG = useRef(false);
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setHelp(false);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;

      // Aide
      if (e.key === '?') {
        e.preventDefault();
        setHelp((h) => !h);
        return;
      }
      // Focus recherche
      if (e.key === '/') {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>(
          'input[type="text"], input[type="search"], input:not([type])'
        );
        if (input) input.focus();
        else router.push('/search');
        return;
      }
      // Chord « g » puis lettre
      if (pendingG.current) {
        pendingG.current = false;
        if (gTimer.current) clearTimeout(gTimer.current);
        const dest = GOTO[e.key.toLowerCase()];
        if (dest) {
          e.preventDefault();
          router.push(dest.href);
        }
        return;
      }
      if (e.key.toLowerCase() === 'g') {
        pendingG.current = true;
        if (gTimer.current) clearTimeout(gTimer.current);
        gTimer.current = setTimeout(() => (pendingG.current = false), 1200);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  if (!help) return null;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={() => setHelp(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-xl border border-line bg-surface shadow-card-hover"
        style={{ boxShadow: 'var(--shadow-card-hover)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Keyboard className="h-4 w-4 text-accent" /> Raccourcis clavier
          </h2>
          <button onClick={() => setHelp(false)} className="btn-ghost !p-1" aria-label="Fermer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-1 p-3 text-sm">
          <Row keys={['Ctrl', 'K']} label="Palette de commandes" />
          <Row keys={['/']} label="Aller à la recherche" />
          <Row keys={['?']} label="Afficher cette aide" />
          <div className="my-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Aller à (g puis…)
          </div>
          {Object.entries(GOTO).map(([k, v]) => (
            <Row key={k} keys={['g', k]} label={v.label} />
          ))}
          <div className="mt-2 px-1 text-xs text-slate-500">
            Clic droit sur un produit pour les actions rapides.
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg px-1 py-1.5">
      <span className="text-slate-300">{label}</span>
      <span className="flex items-center gap-1">
        {keys.map((k, i) => (
          <kbd
            key={i}
            className="rounded border border-line-strong bg-ink/60 px-1.5 py-0.5 font-mono text-xs text-slate-300"
          >
            {k}
          </kbd>
        ))}
      </span>
    </div>
  );
}
