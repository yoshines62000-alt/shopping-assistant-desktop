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

/** Appelle l'API (`/api/v1` + path) et renvoie le JSON typé, ou lève ApiError. */
export async function apiFetch<T>(path: string, init: ApiInit = {}): Promise<T> {
  const { json, headers, ...rest } = init;
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
}
