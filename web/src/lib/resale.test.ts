import { computeMargin, ageDays, isDormant, computeReprice, DORMANT_DAYS } from './resale';

describe('computeMargin', () => {
  it('calcule net / marge / ROI (achat 20, vente 50, port 4, frais 13%)', () => {
    const r = computeMargin(20, 50, 4, 0.13);
    expect(r.feeAmount).toBeCloseTo(6.5, 2);
    expect(r.net).toBeCloseTo(19.5, 2); // 50 - 6.5 - 4 - 20
    expect(Math.round(r.marginPct)).toBe(39); // 19.5/50
    expect(Math.round(r.roiPct)).toBe(98); // 19.5/20 = 97.5
  });

  it('gère une perte (net négatif)', () => {
    const r = computeMargin(60, 50, 0, 0.1);
    expect(r.net).toBeCloseTo(-15, 2); // 50 - 5 - 0 - 60
    expect(r.marginPct).toBeLessThan(0);
  });

  it('évite la division par zéro (achat/vente à 0)', () => {
    const r = computeMargin(0, 0, 0, 0.1);
    expect(r.marginPct).toBe(0);
    expect(r.roiPct).toBe(0);
  });
});

describe('ageDays / isDormant', () => {
  const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();

  it('compte les jours écoulés', () => {
    expect(ageDays(iso(10))).toBe(10);
    expect(ageDays(iso(0))).toBe(0);
    expect(ageDays(new Date(Date.now() + 86_400_000).toISOString())).toBe(0); // futur -> 0
  });

  it('marque dormant au-delà du seuil, en stock et non vendu', () => {
    expect(isDormant({ remaining: 1, status: 'listed', purchaseDate: iso(DORMANT_DAYS + 5) })).toBe(true);
    expect(isDormant({ remaining: 1, status: 'in_stock', purchaseDate: iso(10) })).toBe(false); // récent
    expect(isDormant({ remaining: 0, status: 'in_stock', purchaseDate: iso(100) })).toBe(false); // épuisé
    expect(isDormant({ remaining: 1, status: 'sold', purchaseDate: iso(100) })).toBe(false); // vendu
  });
});

describe('computeReprice', () => {
  it('conseille de baisser si le marché a chuté (>5%)', () => {
    const r = computeReprice({ status: 'listed', estimatedResale: 40, previousEstimate: 50 });
    expect(r).toEqual({ dir: 'down', movePct: -20, target: 40 });
  });

  it('signale un sous-cotage si le marché a monté (>5%)', () => {
    const r = computeReprice({ status: 'listed', estimatedResale: 55, previousEstimate: 50 });
    expect(r?.dir).toBe('up');
    expect(r?.target).toBe(55);
  });

  it('ne conseille rien sous le seuil de 5% ou hors « en vente »', () => {
    expect(computeReprice({ status: 'listed', estimatedResale: 51, previousEstimate: 50 })).toBeNull();
    expect(computeReprice({ status: 'in_stock', estimatedResale: 40, previousEstimate: 50 })).toBeNull();
    expect(computeReprice({ status: 'listed', estimatedResale: 40, previousEstimate: null })).toBeNull();
    expect(computeReprice({ status: 'listed', estimatedResale: 40, previousEstimate: 0 })).toBeNull();
  });
});
