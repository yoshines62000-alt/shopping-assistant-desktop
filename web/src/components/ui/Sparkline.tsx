interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
}

/** Courbe SVG minimaliste (historique / tendance) — glow + tracé animé, suit l'accent. */
export default function Sparkline({ values, width = 560, height = 120 }: SparklineProps) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 8;

  const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2);
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last = values[values.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full text-accent"
      role="img"
      aria-label={`Évolution, de ${min.toFixed(2)} à ${max.toFixed(2)} euros`}
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
        <filter id="spark-glow" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <polygon
        points={`${pad},${height - pad} ${points} ${width - pad},${height - pad}`}
        fill="url(#spark-fill)"
      />
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        filter="url(#spark-glow)"
        pathLength={1}
        style={{ strokeDasharray: 1, animation: 'spark-draw 1.1s ease-out both' }}
      />
      <circle cx={x(values.length - 1)} cy={y(last)} r="3.5" fill="currentColor" filter="url(#spark-glow)" />
    </svg>
  );
}
