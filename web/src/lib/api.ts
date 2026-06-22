import { API_BASE } from './config';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiInit extends Omit<RequestInit, 'body'> {
  /** Corps JSON : sérialisé et Content-Type ajoutés automatiquement */
  json?: unknown;
}

// Déduplication des GET concurrents : si plusieurs composants demandent la même
// ressource au même moment (ex. sidebar + accueil chargent /favorites au montage),
// on partage une seule requête réseau. Vidé dès la résolution -> aucun risque de
// péremption (les mutations passent par des POST/PUT/DELETE non concernés).
const inflight = new Map<string, Promise<unknown>>();

/** Appelle l'API (`/api/v1` + path) et renvoie le JSON typé, ou lève ApiError. */
export async function apiFetch<T>(path: string, init: ApiInit = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const method = (rest.method ?? 'GET').toUpperCase();
  const dedupable = method === 'GET' && json === undefined;
  const key = `${method} ${path}`;

  if (dedupable && inflight.has(key)) {
    return inflight.get(key) as Promise<T>;
  }

  const run = (async () => {
    const res = await fetch(`${API_BASE}/api/v1${path}`, {
      ...rest,
      headers: {
        ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : undefined,
    });
    if (!res.ok) {
      throw new ApiError(res.status, `HTTP ${res.status}`);
    }
    return res.json() as Promise<T>;
  })();

  if (dedupable) {
    inflight.set(key, run);
    run.finally(() => inflight.delete(key)).catch(() => {});
  }
  return run;
}
