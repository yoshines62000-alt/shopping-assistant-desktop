import { Loader2 } from 'lucide-react';

export default function LoadingBlock({ label = 'Chargement...' }: { label?: string }) {
  return (
    <div className="card flex items-center justify-center gap-3 px-6 py-10 text-sm text-slate-400">
      <Loader2 className="h-4 w-4 animate-spin text-accent" />
      {label}
    </div>
  );
}
