type Tone = 'default' | 'accent' | 'positive' | 'negative';

const TONE_CLASSES: Record<Tone, string> = {
  default: 'text-slate-100',
  accent: 'text-accent',
  positive: 'text-emerald-400',
  negative: 'text-rose-400',
};

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
}

export default function StatCard({ label, value, sub, tone = 'default' }: StatCardProps) {
  return (
    <div className="card-pad text-center">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold tracking-tight ${TONE_CLASSES[tone]}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}
