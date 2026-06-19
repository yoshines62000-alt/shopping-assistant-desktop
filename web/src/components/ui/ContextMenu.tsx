'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface ContextMenuItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
  separatorBefore?: boolean;
}

/**
 * Menu contextuel (clic droit) réutilisable. Enveloppe un contenu ; au clic
 * droit, ouvre un menu d'actions positionné au curseur (rendu en portail pour
 * éviter tout rognage). Se ferme au clic ailleurs, au scroll ou via Échap.
 */
export default function ContextMenu({ items, children }: { items: ContextMenuItem[]; children: ReactNode }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPos(null);
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [pos]);

  const open = (e: React.MouseEvent) => {
    e.preventDefault();
    const w = 220;
    const h = items.length * 38 + 12;
    setPos({
      x: Math.min(e.clientX, window.innerWidth - w - 8),
      y: Math.min(e.clientY, window.innerHeight - h - 8),
    });
  };

  return (
    <div onContextMenu={open}>
      {children}
      {mounted && pos &&
        createPortal(
          <div
            className="animate-fade-in fixed z-[120] min-w-[210px] overflow-hidden rounded-xl border border-line-strong bg-surface/95 p-1 shadow-card-hover backdrop-blur-md"
            style={{ left: pos.x, top: pos.y, boxShadow: 'var(--shadow-card-hover)' }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            {items.map((it, i) => (
              <div key={i}>
                {it.separatorBefore && <div className="my-1 h-px bg-line" />}
                <button
                  type="button"
                  onClick={() => {
                    setPos(null);
                    it.onClick();
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-[rgb(var(--overlay)/0.06)] ${
                    it.danger ? 'text-rose-300' : 'text-slate-200'
                  }`}
                >
                  <span className={it.danger ? 'text-rose-400' : 'text-accent'}>{it.icon}</span>
                  {it.label}
                </button>
              </div>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
