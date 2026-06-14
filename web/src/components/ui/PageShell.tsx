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
    <div className="page-container py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
            {icon && <span className="text-accent">{icon}</span>}
            {title}
          </h1>
          {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </header>
      {children}
    </div>
  );
}
