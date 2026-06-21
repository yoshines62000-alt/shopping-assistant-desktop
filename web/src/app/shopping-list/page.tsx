'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { Favorite, FavoriteList } from '@shopping-assistant/types';
import { Heart, Search, Plus, Pencil, Trash2, Tag, RefreshCw, Download, Target, CheckSquare } from 'lucide-react';
import PageShell from '@/components/ui/PageShell';
import EmptyState from '@/components/ui/EmptyState';
import LoadingBlock from '@/components/ui/LoadingBlock';
import ErrorBanner from '@/components/ui/ErrorBanner';
import FavoriteCard from '@/components/FavoriteCard';
import { apiFetch } from '@/lib/api';
import { migrateLocalFavorites } from '@/lib/favorites';
import { downloadCSV } from '@/lib/csv';
import { toast } from '@/lib/toast';
import { euro } from '@/lib/format';

const LIST_COLORS = ['#22d3ee', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#3b82f6', '#ec4899', '#14b8a6'];

export default function FavoritesPage() {
  const [lists, setLists] = useState<FavoriteList[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [activeList, setActiveList] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'recent' | 'priceAsc' | 'priceDesc' | 'gap'>('recent');
  const [onlyUnderTarget, setOnlyUnderTarget] = useState(false);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
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
    // Couleur auto distincte (rotation de la palette).
    const color = LIST_COLORS[lists.length % LIST_COLORS.length];
    await apiFetch('/favorites/lists', { method: 'POST', json: { name, color } }).catch(() => null);
    load();
  };

  const renameList = async (l: FavoriteList) => {
    const name = window.prompt('Renommer la liste :', l.name)?.trim();
    if (!name || name === l.name) return;
    await apiFetch(`/favorites/lists/${l.id}`, { method: 'PATCH', json: { name } }).catch(() => null);
    load();
  };

  const setListColor = async (l: FavoriteList, color: string) => {
    await apiFetch(`/favorites/lists/${l.id}`, { method: 'PATCH', json: { color } }).catch(() => null);
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
  const onFavRemoved = (id: number) => {
    setFavorites((prev) => prev.filter((f) => f.id !== id));
    setSelected((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // --- Sélection multiple (actions en lot) ---
  const toggleSelect = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const clearSelect = () => setSelected(new Set());

  const bulkAddToList = async (listId: number) => {
    const picked = favorites.filter((f) => selected.has(f.id) && !f.listIds.includes(listId));
    await Promise.all(
      picked.map((f) =>
        apiFetch<Favorite>(`/favorites/${f.id}`, {
          method: 'PATCH',
          json: { listIds: [...f.listIds, listId] },
        })
          .then(onFavChanged)
          .catch(() => null)
      )
    );
    const name = lists.find((l) => l.id === listId)?.name ?? 'la liste';
    toast.success(`${picked.length || selected.size} favori(s) rangé(s) dans « ${name} »`);
    clearSelect();
  };

  const bulkRemove = async () => {
    const ids = [...selected];
    if (!window.confirm(`Retirer ${ids.length} favori(s) ?`)) return;
    ids.forEach(onFavRemoved);
    await Promise.all(ids.map((id) => apiFetch(`/favorites/${id}`, { method: 'DELETE' }).catch(() => null)));
    toast.info(`${ids.length} favori(s) retiré(s)`);
  };

  const refreshAll = async () => {
    setRefreshingAll(true);
    try {
      const res = await apiFetch<{ checked: number; changed: number }>('/favorites/refresh-prices', {
        method: 'POST',
      });
      await load();
      toast.success(
        res.checked === 0
          ? 'Aucun favori Amazon/eBay à rafraîchir'
          : `${res.checked} prix vérifié${res.checked > 1 ? 's' : ''} · ${res.changed} modifié${res.changed > 1 ? 's' : ''}`
      );
    } catch {
      toast.error('Rafraîchissement impossible');
    } finally {
      setRefreshingAll(false);
    }
  };

  const exportCsv = () => {
    if (shown.length === 0) return;
    const nameById = new Map(lists.map((l) => [l.id, l.name]));
    downloadCSV(
      `favoris-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Nom', 'Prix', 'Prix cible', 'Site', 'Vendeur', 'Note', 'Listes', 'Note perso', 'Lien'],
      shown.map((f) => [
        f.name,
        f.price,
        f.targetPrice ?? '',
        f.siteDomain,
        f.seller ?? '',
        f.rating ?? '',
        f.listIds.map((id) => nameById.get(id) ?? '').filter(Boolean).join(', '),
        f.notes,
        f.sourceUrl,
      ])
    );
  };

  const gapOf = (f: Favorite) =>
    f.targetPrice && f.targetPrice > 0 ? (f.price - f.targetPrice) / f.targetPrice : Infinity;
  const isUnderTarget = (f: Favorite) =>
    f.targetPrice != null && f.targetPrice > 0 && f.price <= f.targetPrice;
  const scoped = activeList == null ? favorites : favorites.filter((f) => f.listIds.includes(activeList));
  const underCount = scoped.filter(isUnderTarget).length;
  const shown = scoped
    .filter((f) => !onlyUnderTarget || isUnderTarget(f))
    .filter((f) => !query.trim() || f.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => {
      if (sort === 'priceAsc') return a.price - b.price;
      if (sort === 'priceDesc') return b.price - a.price;
      if (sort === 'gap') return gapOf(a) - gapOf(b); // les plus proches/sous la cible d'abord
      return b.addedAt.localeCompare(a.addedAt); // récents
    });
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
                  <span className="ml-1 flex items-center gap-1">
                    {LIST_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setListColor(activeListObj, c)}
                        className={`h-4 w-4 rounded-full ring-1 ring-offset-1 ring-offset-surface ${activeListObj.color === c ? 'ring-slate-300' : 'ring-transparent'}`}
                        style={{ backgroundColor: c }}
                        title="Couleur de la liste"
                        aria-label={`Couleur ${c}`}
                      />
                    ))}
                  </span>
                </span>
              )}
            </div>

            {/* Recherche + tri */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filtrer mes favoris…"
                  className="input !pl-9"
                />
              </div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
                className="input !w-auto"
                title="Trier"
              >
                <option value="recent">Plus récents</option>
                <option value="priceAsc">Prix croissant</option>
                <option value="priceDesc">Prix décroissant</option>
                <option value="gap">Proche de ma cible</option>
              </select>
              {underCount > 0 && (
                <button
                  onClick={() => setOnlyUnderTarget((v) => !v)}
                  className={`badge ${onlyUnderTarget ? 'badge-success' : 'badge-muted'} cursor-pointer`}
                  title="N'afficher que les favoris au prix cible ou en dessous"
                >
                  <Target className="h-3.5 w-3.5" /> Sous ma cible ({underCount})
                </button>
              )}
              <button
                onClick={refreshAll}
                disabled={refreshingAll}
                className="btn-ghost text-sm disabled:opacity-50"
                title="Rafraîchir les prix Amazon/eBay"
              >
                <RefreshCw className={`h-4 w-4 ${refreshingAll ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Rafraîchir</span>
              </button>
              <button onClick={exportCsv} className="btn-ghost text-sm" title="Exporter en CSV">
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">CSV</span>
              </button>
            </div>

            {selected.size > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm">
                <CheckSquare className="h-4 w-4 text-accent" />
                <span className="font-medium text-slate-100">{selected.size} sélectionné{selected.size > 1 ? 's' : ''}</span>
                {lists.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => e.target.value && bulkAddToList(Number(e.target.value))}
                    className="input !w-auto !py-1 text-sm"
                    title="Ranger la sélection dans une liste"
                  >
                    <option value="">Ranger dans…</option>
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                )}
                <button onClick={bulkRemove} className="btn-ghost text-sm hover:!text-rose-300">
                  <Trash2 className="h-3.5 w-3.5" /> Retirer
                </button>
                <button onClick={clearSelect} className="btn-ghost text-sm ml-auto">
                  Annuler
                </button>
              </div>
            )}

            {shown.length === 0 ? (
              <EmptyState
                icon={<Tag className="h-6 w-6" />}
                title={query.trim() || onlyUnderTarget ? 'Aucun résultat' : 'Liste vide'}
                description={
                  onlyUnderTarget
                    ? 'Aucun favori au prix cible ou en dessous pour le moment.'
                    : query.trim()
                      ? 'Aucun favori ne correspond à ta recherche.'
                      : 'Aucun favori dans cette liste. Range-en via le bouton « Listes » sur une carte.'
                }
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
                    selected={selected.has(f.id)}
                    onToggleSelect={toggleSelect}
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
