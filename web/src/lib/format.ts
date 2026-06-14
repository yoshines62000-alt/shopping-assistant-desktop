export function euro(value: number | undefined | null): string {
  return (value ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

export function dateFr(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR');
}