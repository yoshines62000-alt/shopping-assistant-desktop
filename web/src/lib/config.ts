// Origine de l'API (sans le préfixe /api/v1) : service scraping en direct
// par défaut, ou le BFF Fastify si NEXT_PUBLIC_API_URL pointe sur le port 3001.
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
