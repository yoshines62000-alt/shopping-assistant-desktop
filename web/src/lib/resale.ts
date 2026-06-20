import type { StockItem } from '@shopping-assistant/types';

// Logique financière pure (testable, hors composants) : marge, stock dormant,
// suggestion de re-tarification. Centralise les calculs d'argent.

export interface MarginResult {
  feeAmount: number;
  net: number;
  marginPct: number; // marge sur le prix de vente
  roiPct: number; // retour sur le prix d'achat
}

/** Marge nette d'une revente : vente − frais (taux) − port − achat. */
export function computeMargin(buy: number, sell: number, shipping: number, feeRate: number): MarginResult {
  const feeAmount = sell * feeRate;
  const net = sell - feeAmount - shipping - buy;
  return {
    feeAmount,
    net,
    marginPct: sell > 0 ? (net / sell) * 100 : 0,
    roiPct: buy > 0 ? (net / buy) * 100 : 0,
  };
}

export const DORMANT_DAYS = 60;

/** Nombre de jours écoulés depuis une date ISO (0 si dans le futur). */
export function ageDays(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return ms > 0 ? Math.floor(ms / 86_400_000) : 0;
}

/** Objet « dormant » : encore en stock (non vendu) au-delà du seuil de jours. */
export function isDormant(
  item: Pick<StockItem, 'remaining' | 'status' | 'purchaseDate'>,
  days = DORMANT_DAYS
): boolean {
  return item.remaining > 0 && item.status !== 'sold' && ageDays(item.purchaseDate) >= days;
}

export type RepriceDir = 'down' | 'up';
export interface Reprice {
  dir: RepriceDir;
  movePct: number; // variation du marché depuis la dernière estimation
  target: number; // prix conseillé (= estimation actuelle)
}

/** Suggestion de re-tarification pour un objet EN VENTE quand le marché a bougé
 *  de plus de 5 % depuis la dernière estimation. */
export function computeReprice(
  item: Pick<StockItem, 'status' | 'estimatedResale' | 'previousEstimate'>
): Reprice | null {
  if (item.status !== 'listed' || item.estimatedResale == null || item.previousEstimate == null) {
    return null;
  }
  if (item.previousEstimate <= 0) return null;
  const move = (item.estimatedResale - item.previousEstimate) / item.previousEstimate;
  if (move <= -0.05) return { dir: 'down', movePct: Math.round(move * 100), target: item.estimatedResale };
  if (move >= 0.05) return { dir: 'up', movePct: Math.round(move * 100), target: item.estimatedResale };
  return null;
}
