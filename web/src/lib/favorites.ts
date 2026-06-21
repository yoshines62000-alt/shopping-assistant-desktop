import { create } from 'zustand';
import type { Product, Favorite } from '@shopping-assistant/types';
import { apiFetch } from '@/lib/api';

// Favoris persistés côté backend (listes, annotations, inclus dans la sauvegarde).
// Ce store léger garde juste l'ensemble des productIds favoris pour l'état du
// cœur dans les résultats de recherche, et synchronise avec l'API.

interface FavoritesState {
  favoriteIds: Set<string>;
  loaded: boolean;
  load: () => Promise<void>;
  isFavorite: (productId: string) => boolean;
  toggle: (product: Product) => Promise<void>;
  /** Ajoute aux favoris avec un prix cible défini d'emblée (favori intelligent). */
  addWithTarget: (product: Product, targetPrice: number) => Promise<void>;
}

function productPayload(p: Product) {
  return {
    productId: p.id,
    name: p.name,
    price: p.totalPrice,
    siteDomain: p.siteDomain,
    sourceUrl: p.sourceUrl,
    imageUrl: p.imageUrl ?? null,
    seller: p.seller ?? null,
    rating: p.rating ?? null,
    reviewCount: p.reviewCount ?? null,
    deliveryDays: p.deliveryDays ?? null,
  };
}

export const useFavorites = create<FavoritesState>((set, get) => ({
  favoriteIds: new Set(),
  loaded: false,
  load: async () => {
    try {
      const data = await apiFetch<{ favorites: Favorite[] }>('/favorites');
      set({ favoriteIds: new Set(data.favorites.map((f) => f.productId)), loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  isFavorite: (productId) => get().favoriteIds.has(productId),
  toggle: async (product) => {
    const ids = get().favoriteIds;
    const next = new Set(ids);
    if (ids.has(product.id)) {
      next.delete(product.id);
      set({ favoriteIds: next });
      await apiFetch(`/favorites/by-product/${encodeURIComponent(product.id)}`, { method: 'DELETE' }).catch(() => null);
    } else {
      next.add(product.id);
      set({ favoriteIds: next });
      await apiFetch('/favorites', { method: 'POST', json: productPayload(product) }).catch(() => {
        // rollback si échec
        const rb = new Set(get().favoriteIds);
        rb.delete(product.id);
        set({ favoriteIds: rb });
      });
    }
  },
  addWithTarget: async (product, targetPrice) => {
    const next = new Set(get().favoriteIds);
    next.add(product.id);
    set({ favoriteIds: next });
    await apiFetch('/favorites', {
      method: 'POST',
      json: { ...productPayload(product), targetPrice },
    }).catch(() => {
      const rb = new Set(get().favoriteIds);
      rb.delete(product.id);
      set({ favoriteIds: rb });
    });
  },
}));

/**
 * Migration unique des anciens favoris locaux (store zustand persisté) vers le
 * backend, puis rechargement. Idempotent via un drapeau localStorage.
 */
export async function migrateLocalFavorites(): Promise<void> {
  try {
    if (localStorage.getItem('favorites-migrated')) return;
    const raw = localStorage.getItem('shopping-assistant-storage');
    const parsed = raw ? JSON.parse(raw) : null;
    const old: { product: Product }[] = parsed?.state?.shoppingList ?? [];
    if (old.length > 0) {
      await apiFetch('/favorites/import', {
        method: 'POST',
        json: { favorites: old.map((item) => productPayload(item.product)) },
      }).catch(() => null);
    }
    localStorage.setItem('favorites-migrated', '1');
  } catch {
    /* migration best-effort */
  }
}
