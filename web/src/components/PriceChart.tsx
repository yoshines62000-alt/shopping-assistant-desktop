'use client';

import { useMemo } from 'react';
import { euro } from '@/lib/format';

/**
 * Graphe d'historique des prix (F6) : ligne du prix dans le temps + repères
 * horizontaux min / médiane / max. SVG responsive (viewBox), sans dépendance.
 */
export default function PriceChart({
  points,
  height = 140,
}: {
  points: { price: number; ts: number }[];
  height?: number;
}) {
  const W = 600;
  const H = height;
  const padX = 8;
  const padY = 16;

  const model = useMemo(() => {
    const pts = points.filter((p) => p.price > 0).sort((a, b) => a.ts - b.ts);
    if (pts.length < 2) return null;
    const prices = pts.map((p) => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const sorted = [...prices].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const span = max - min || 1;

    const x = (i: number) => padX + (i / (pts.length - 1)) * (W - 2 * padX);
    const y = (price: number) => padY + (1 - (price - min) / span) * (H - 2 * padY);

    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.price).toFixed(1)}`).join(' ');
    const area = `${line} L${x(pts.length - 1).toFixed(1)},${H - padY} L${x(0).toFixed(1)},${H - padY} Z`;

    return { pts, min, max, median, x, y, line, area, last: pts[pts.length - 1] };
  }, [points, H]);

  if (!model) return null;

  const ref = (price: number, label: string, color: string) => {
    const yy = model.y(price);
    return (
      <g>
        <line
          x1={padX}
          x2={W - padX}
          y1={yy}
          y2={yy}
          stroke={color}
          strokeWidth={1}
          strokeDasharray="3 3"
          opacity={0.5}
        />
        <text x={W - padX} y={yy - 3} textAnchor="end" fontSize={11} fill={color}>
          {label} {euro(price)}
        </text>
      </g>
    );
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      preserveAspectRatio="none"
      role="img"
      aria-label="Historique des prix"
    >
      <defs>
        <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(34 211 238)" stopOpacity={0.25} />
          <stop offset="100%" stopColor="rgb(34 211 238)" stopOpacity={0} />
        </linearGradient>
      </defs>

      {ref(model.max, 'max', 'rgb(248 113 113)')}
      {ref(model.median, 'méd.', 'rgb(148 163 184)')}
      {ref(model.min, 'min', 'rgb(52 211 153)')}

      <path d={model.area} fill="url(#priceFill)" />
      <path d={model.line} fill="none" stroke="rgb(34 211 238)" strokeWidth={2} />
      <circle
        cx={model.x(model.pts.length - 1)}
        cy={model.y(model.last.price)}
        r={3.5}
        fill="rgb(34 211 238)"
      />
    </svg>
  );
}
