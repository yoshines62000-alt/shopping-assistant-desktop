export function euro(value: number | undefined | null): string {
  return (value ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

export function dateFr(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR');
}

/** Durée écoulée en français court : « à l'instant », « il y a 3 h », « il y a 2 j ».
 * Les timestamps backend sont en UTC naïf (sans suffixe) : on ajoute « Z » pour
 * éviter que le navigateur les lise en heure locale. */
export function relativeTime(iso: string): string {
  const norm = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`;
  const diffMs = Date.now() - new Date(norm).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return '';
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}