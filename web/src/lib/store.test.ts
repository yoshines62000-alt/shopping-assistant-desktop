import { useAppStore } from './store';
import type { Product } from '@shopping-assistant/types';

const product = (id: string): Product => ({
  id,
  name: `Produit ${id}`,
  totalPrice: 19.99,
  currency: 'EUR',
  rating: 4.5,
  reviewCount: 12,
  deliveryDays: 2,
  siteDomain: 'example.com',
  sourceUrl: `https://example.com/${id}`,
  seller: 'Vendeur',
  inStock: true,
  raw: {},
  createdAt: new Date(),
  updatedAt: new Date(),
});

beforeEach(() => {
  useAppStore.setState({ shoppingList: [], recentSearches: [] });
});

describe('shopping list store', () => {
  it('ajoute un produit à la liste', () => {
    useAppStore.getState().addToShoppingList(product('a'));
    expect(useAppStore.getState().shoppingList).toHaveLength(1);
    expect(useAppStore.getState().shoppingList[0].id).toBe('a');
  });

  it("n'ajoute pas deux fois le même produit", () => {
    useAppStore.getState().addToShoppingList(product('a'));
    useAppStore.getState().addToShoppingList(product('a'));
    expect(useAppStore.getState().shoppingList).toHaveLength(1);
  });

  it('retire un produit par id', () => {
    useAppStore.getState().addToShoppingList(product('a'));
    useAppStore.getState().addToShoppingList(product('b'));
    useAppStore.getState().removeFromShoppingList('a');
    expect(useAppStore.getState().shoppingList.map((i) => i.id)).toEqual(['b']);
  });

  it('vide la liste', () => {
    useAppStore.getState().addToShoppingList(product('a'));
    useAppStore.getState().clearShoppingList();
    expect(useAppStore.getState().shoppingList).toHaveLength(0);
  });

  it('garde au plus 10 recherches récentes', () => {
    for (let i = 0; i < 12; i++) {
      useAppStore.getState().addSearch(`recherche ${i}`);
    }
    expect(useAppStore.getState().recentSearches).toHaveLength(10);
    expect(useAppStore.getState().recentSearches[0]).toBe('recherche 11');
  });
});
