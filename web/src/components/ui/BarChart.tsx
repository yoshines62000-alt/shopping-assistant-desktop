interface BarChartProps {
  /** Valeurs dans l'ordre chronologique (anciennes → récentes). */
  values: number[];
  /** Étiquette courte sous chaque barre (mois, etc.). */
  labels?: string[];
  height?: number;
  /** Couleur selon le signe : vert si ≥ 0, rose si < 0. */
  signed?: boolean;
}

/**
 * Mini graphique en barres SVG, sans dépendance, accordé au thème.
 * Zéro centré : les valeurs négatives descendent sous la ligne médiane.
 */
export default function BarChart({
  values,
  labels = [],
  height = 120,
  signed = true,
}: BarChartProps) {
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
      className="w-full"
      role="img"
      aria-label="Bénéfice net par mois"
    >
      {/* Ligne du zéro */}
      <line x1="0" y1={mid} x2={width} y2={mid} stroke="rgba(148,163,184,0.18)" strokeWidth="1" />
      {values.map((v, i) => {
        const x = i * (barW + gap);
        const h = (Math.abs(v) / max) * (mid - 4);
        const positive = v >= 0;
        const y = positive ? mid - h : mid;
        const fill = !signed || positive ? '#22d3ee' : '#fb7185';
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={Math.max(1, h)}
              rx="2"
              fill={fill}
              opacity={0.85}
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
