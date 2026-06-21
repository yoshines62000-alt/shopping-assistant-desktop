interface BarChartProps {
  /** Valeurs dans l'ordre chronologique (anciennes → récentes). */
  values: number[];
  /** Étiquette courte sous chaque barre (mois, etc.). */
  labels?: string[];
  height?: number;
  /** Couleur selon le signe : accent si ≥ 0, rose si < 0. */
  signed?: boolean;
}

/**
 * Mini graphique en barres SVG, sans dépendance, accordé au thème (suit l'accent
 * via currentColor). Zéro centré ; barres en dégradé + glow, apparition animée.
 */
export default function BarChart({ values, labels = [], height = 130, signed = true }: BarChartProps) {
  if (values.length === 0) return null;

  const max = Math.max(1, ...values.map((v) => Math.abs(v)));
  const gap = 6;
  const n = values.length;
  const width = 560;
  const labelH = labels.length > 0 ? 16 : 0;
  const chartH = height - labelH;
  const mid = chartH / 2;
  const barW = (width - gap * (n - 1)) / n;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full text-accent"
      role="img"
      aria-label="Bénéfice net par mois"
    >
      <defs>
        <linearGradient id="bar-pos" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id="bar-neg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fb7185" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#fb7185" stopOpacity="1" />
        </linearGradient>
        <filter id="bar-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Ligne du zéro */}
      <line x1="0" y1={mid} x2={width} y2={mid} stroke="rgba(148,163,184,0.18)" strokeWidth="1" />

      {values.map((v, i) => {
        const x = i * (barW + gap);
        const h = (Math.abs(v) / max) * (mid - 4);
        const positive = !signed || v >= 0;
        const y = v >= 0 ? mid - h : mid;
        return (
          <g key={i} filter="url(#bar-glow)">
            <rect
              x={x}
              y={y}
              width={barW}
              height={Math.max(2, h)}
              rx="3"
              fill={positive ? 'url(#bar-pos)' : 'url(#bar-neg)'}
              style={{
                transformBox: 'view-box',
                transformOrigin: `0 ${mid}px`,
                animation: `bar-grow 0.55s cubic-bezier(0.22,1,0.36,1) ${i * 45}ms both`,
              }}
            >
              <title>{v.toFixed(2)} €</title>
            </rect>
            {labels[i] && (
              <text
                x={x + barW / 2}
                y={height - 4}
                textAnchor="middle"
                fontSize="10"
                fill="rgba(148,163,184,0.8)"
              >
                {labels[i]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
