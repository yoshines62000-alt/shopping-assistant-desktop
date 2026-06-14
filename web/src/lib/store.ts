import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product } from '@shopping-assistant/types';

interface ShoppingListItem {
  id: string;
  product: Product;
  addedAt: string;
}

interface WatchItem {
  id: string;
  productId: string;
  targetPrice?: number;
  /** Alerte backend correspondante, pour pouvoir la supprimer au retrait du favori. */
  alertId?: string;
  addedAt: string;
}

interface AppState {
  recentSearches: string[];
  shoppingList: ShoppingListItem[];
  watchList: WatchItem[];
  addSearch: (query: string) => void;
  clearHistory: () => void;
  addToShoppingList: (product: Product) => void;
  removeFromShoppingList: (productId: string) => void;
  clearShoppingList: () => void;
  addToWatchList: (productId: string, targetPrice?: number, alertId?: string) => void;
  removeFromWatchList: (productId: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      recentSearches: [],
      shoppingList: [],
      watchList: [],
      addSearch: (query) =>
        set((state) => ({
          // Dedup : remonte la requete en tete sans doublon.
          recentSearches: [query, ...state.recentSearches.filter((q) => q !== query)].slice(0, 10),
        })),
      clearHistory: () => set({ recentSearches: [] }),
      addToShoppingList: (product) =>
        set((state) => {
          const exists = state.shoppingList.find((item) => item.id === product.id);
          if (exists) return state;
          return { shoppingList: [...state.shoppingList, { id: product.id, product, addedAt: new Date().toISOString() }] };
        }),
      removeFromShoppingList: (productId) =>
        set((state) => ({
          shoppingList: state.shoppingList.filter((item) => item.id !== productId),
        })),
      clearShoppingList: () => set({ shoppingList: [] }),
      addToWatchList: (productId, targetPrice, alertId) =>
        set((state) => {
          const exists = state.watchList.find((item) => item.productId === productId);
          if (exists) return state;
          return { watchList: [...state.watchList, { id: `${productId}-${Date.now()}`, productId, targetPrice, alertId, addedAt: new Date().toISOString() }] };
        }),
      removeFromWatchList: (productId) =>
        set((state) => ({
          watchList: state.watchList.filter((item) => item.productId !== productId),
        })),
    }),
    { name: 'shopping-assistant-storage', partialize: (state) => ({ recentSearches: state.recentSearches, shoppingList: state.shoppingList, watchList: state.watchList }) }
  )
);