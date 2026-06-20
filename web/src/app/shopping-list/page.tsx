'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { Favorite, FavoriteList } from '@shopping-assistant/types';
import { Heart, Search, Plus, Pencil, Trash2, Tag } from 'lucide-react';
import PageShell from '@/components/ui/PageShell';
import EmptyState from '@/components/ui/EmptyState';
import LoadingBlock from '@/components/ui/LoadingBlock';
import ErrorBanner from '@/components/ui/ErrorBanner';
import FavoriteCard from '@/components/FavoriteCard';
import { apiFetch } from '@/lib/api';
import { migrateLocalFavorites } from '@/lib/favorites';
import { euro } from '@/lib/format';

export default function FavoritesPage() {
  const [lists, setLists] = useState<FavoriteList[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [activeList, setActiveList] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [l, f] = await Promise.all([
        apiFetch<{ lists: FavoriteList[] }>('/favorites/lists'),
        apiFetch<{ favorites: Favorite[] }>('/favorites'),
      ]);
      setLists(l.lists);
      setFavorites(f.favorites);
      setError(null);
    } catch {
      setError('Impossible de charger les favoris. Vérifie que le service est démarré.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    migrateLocalFavorites().then(load);
  }, [load]);

  const createList = async () => {
    const name = window.prompt('Nom de la nouvelle liste ?')?.trim();
    if (!name) return;
    await apiFetch('/favorites/lists', { method: 'POST', json: { name } }).catch(() => null);
    load();
  };

  const renameList = async (l: FavoriteList) => {
    const name = window.prompt('Renommer la liste :', l.name)?.trim();
    if (!name || name === l.name) return;
    await apiFetch(`/favorites/lists/${l.id}`, { method: 'PATCH', json: { name } }).catch(() => null);
    load();
  };

  const deleteList = async (l: FavoriteList) => {
    if (!window.confirm(`Supprimer la liste « ${l.name} » ? (les favoris sont conservés)`)) return;
    if (activeList === l.id) setActiveList(null);
    await apiFetch(`/favorites/lists/${l.id}`, { method: 'DELETE' }).catch(() => null);
    load();
  };

  const onFavChanged = (updated: Favorite) =>
    setFavorites((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
  const onFavRemoved = (id: number) => setFavorites((prev) => prev.filter((f) => f.id !== id));

  const shown =
    activeList == null ? favorites : favorites.filter((f) => f.listIds.includes(activeList));
  const total = shown.reduce((s, f) => s + f.price, 0);
  const activeListObj = lists.find((l) => l.id === activeList);
  // Compteurs calculés côté client -> réactifs quand on (dé)tague un favori.
  const countFor = (listId: number) => favorites.filter((f) => f.listIds.includes(listId)).length;

  return (
    <PageShell
      title="Mes favoris"
      icon={<Heart className="h-6 w-6" />}
      subtitle={
        favorites.length > 0
          ? `${shown.length} favori${shown.length > 1 ? 's' : ''}${activeListObj ? ` dans « ${activeListObj.name} »` : ''} · total ${euro(total)}`
          : undefined
      }
    >
      <div className="space-y-4">
        {error && <ErrorBanner message={error} />}
        {loading && <LoadingBlock label="Chargement des favoris..." />}

        {!loading && favorites.length === 0 && !error && (
          <EmptyState
            icon={<Heart className="h-6 w-6" />}
            title="Aucun favori"
            description="Appuie sur le ♥ d'un résultat de recherche pour l'ajouter, puis range-le dans des listes ici."
            action={
              <Link href="/search" className="btn-primary text-sm">
                <Search className="h-4 w-4" /> Rechercher
              </Link>
            }
          />
        )}

        {!loading && favorites.length > 0 && (
          <>
            {/* Barre de listes (étiquettes) */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setActiveList(null)}
                className={`${activeList == null ? 'btn-primary' : 'btn-secondary'} !px-3 !py-1 text-xs`}
              >
                Tous ({favorites.length})
              </button>
              {lists.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setActiveList(l.id)}
                  className={`${activeList === l.id ? 'btn-primary' : 'btn-secondary'} inline-flex items-center gap-1.5 !px-3 !py-1 text-xs`}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: l.color || 'rgb(var(--c-accent))' }}
                  />
                  {l.name} ({countFor(l.id)})
                </button>
              ))}
              <button onClick={createList} className="btn-ghost !px-2.5 !py-1 text-xs" title="Nouvelle liste">
                <Plus className="h-3.5 w-3.5" /> Liste
              </button>
              {activeListObj && (
                <span className="ml-1 inline-flex items-center gap-1">
                  <button
                    onClick={() => renameList(activeListObj)}
                    className="btn-ghost !p-1.5"
                    title="Renommer la liste"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => deleteList(activeListObj)}
                    className="btn-ghost !p-1.5 hover:!text-rose-300"
                    title="Supprimer la liste"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              )}
            </div>

            {shown.length === 0 ? (
              <EmptyState
                icon={<Tag className="h-6 w-6" />}
                title="Liste vide"
                description="Aucun favori dans cette liste. Range-en via le bouton « Listes » sur une carte."
              />
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {shown.map((f) => (
                  <FavoriteCard
                    key={f.id}
                    fav={f}
                    lists={lists}
                    onChanged={onFavChanged}
                    onRemoved={onFavRemoved}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}
