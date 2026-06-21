import type { ReactNode } from 'react';

interface PageShellProps {
  title: string;
  icon?: ReactNode;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

/** Gabarit commun des pages : titre, sous-titre, zone d'actions, contenu. */
export default function PageShell({ title, icon, subtitle, actions, children }: PageShellProps) {
  return (
    <div className="animate-rise mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <header className="relative mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-5">
        {/* Liseré néon sous l'en-tête */}
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-px"
          style={{ background: 'linear-gradient(90deg, rgb(var(--c-accent) / 0.6), transparent 60%)' }}
        />
        <div className="flex items-center gap-3.5">
          {icon && (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent shadow-glow ring-1 ring-accent/25">
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">{title}</h1>
            {subtitle && <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      {children}
    </div>
  );
}
