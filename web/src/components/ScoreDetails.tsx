import type { ProductScores } from '@shopping-assistant/types';

interface Props {
  scores: ProductScores;
}

const BARS = [
  { key: 'price', label: 'Prix' },
  { key: 'delivery', label: 'Délais' },
  { key: 'reviews', label: 'Avis' },
  { key: 'site', label: 'Site' },
  { key: 'popularity', label: 'Popularité' },
] as const;

export default function ScoreDetails({ scores }: Props) {
  return (
    <div className="rounded-lg border border-line bg-ink/40 p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Détails du score
      </h3>
      <div className="space-y-2">
        {BARS.map(({ key, label }) => {
          const value = scores[key];
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="w-20 text-xs text-slate-400">{label}</span>
              <div className="score-track flex-1">
                <div
                  className="score-fill"
                  style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
                />
              </div>
              <span className="w-10 text-right font-mono text-xs text-slate-300">
                {Math.round(value)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
