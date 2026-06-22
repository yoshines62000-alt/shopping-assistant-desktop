'use client';

import { Check, AlertCircle, Info, X } from 'lucide-react';
import { useToastStore, type ToastType } from '@/lib/toast';

const STYLES: Record<ToastType, { icon: React.ReactNode; ring: string; text: string }> = {
  success: {
    icon: <Check className="h-4 w-4" />,
    ring: 'border-emerald-500/30',
    text: 'text-emerald-300',
  },
  error: {
    icon: <AlertCircle className="h-4 w-4" />,
    ring: 'border-rose-500/30',
    text: 'text-rose-300',
  },
  info: {
    icon: <Info className="h-4 w-4" />,
    ring: 'border-accent/30',
    text: 'text-accent',
  },
};

/** Pile de notifications en bas à droite. Monté une fois dans le layout.
 *  Région live persistante -> les lecteurs d'écran annoncent chaque toast. */
export default function Toaster() {
  const { toasts, dismiss } = useToastStore();

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,22rem)] flex-col gap-2"
    >
      {toasts.map((t) => {
        const s = STYLES[t.type];
        return (
          <div
            key={t.id}
            role="status"
            className={`animate-toast-in pointer-events-auto flex items-start gap-2.5 rounded-lg border ${s.ring} bg-surface-raised p-3 shadow-card-hover`}
          >
            <span className={`mt-0.5 shrink-0 ${s.text}`}>{s.icon}</span>
            <p className="flex-1 text-sm text-slate-200">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-slate-500 hover:text-slate-300"
              aria-label="Fermer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
