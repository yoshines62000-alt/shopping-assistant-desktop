import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="animate-fade-in flex flex-col items-center rounded-xl border border-dashed border-line-strong bg-surface/40 px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent ring-1 ring-accent/15">
        {icon}
      </div>
      <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
      {description && <p className="mt-1.5 max-w-sm text-sm text-slate-400">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
