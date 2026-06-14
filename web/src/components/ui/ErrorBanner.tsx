import { AlertTriangle } from 'lucide-react';

export default function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      {message}
    </div>
  );
}
