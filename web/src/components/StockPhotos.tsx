'use client';

import { useRef, useState } from 'react';
import type { StockItem } from '@shopping-assistant/types';
import { ImagePlus, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { toast } from '@/lib/toast';

const MAX_PHOTOS = 6;
const MAX_DIM = 1000; // redimensionne le plus grand côté à 1000 px

// Redimensionne + compresse une image en data URL JPEG (vignette légère).
function resizeToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('no ctx'));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function StockPhotos({
  item,
  onUpdated,
}: {
  item: StockItem;
  onUpdated: () => void;
}) {
  const photos = item.photos ?? [];
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const save = async (next: string[]) => {
    setBusy(true);
    try {
      await apiFetch(`/stock/${item.id}`, { method: 'PATCH', json: { photos: next } });
      onUpdated();
    } catch {
      toast.error('Enregistrement des photos impossible');
    } finally {
      setBusy(false);
    }
  };

  const add = async (files: FileList) => {
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      toast.error(`Maximum ${MAX_PHOTOS} photos`);
      return;
    }
    setBusy(true);
    try {
      const added: string[] = [];
      for (const file of Array.from(files).slice(0, room)) {
        if (file.type.startsWith('image/')) added.push(await resizeToDataUrl(file));
      }
      if (added.length) await save([...photos, ...added]);
    } catch {
      toast.error('Lecture de l’image impossible');
      setBusy(false);
    } finally {
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-line bg-ink/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Photos ({photos.length}/{MAX_PHOTOS})
        </span>
        <button
          onClick={() => input.current?.click()}
          disabled={busy || photos.length >= MAX_PHOTOS}
          className="btn-secondary !px-3 !py-1 text-xs"
        >
          <ImagePlus className="h-3.5 w-3.5" /> Ajouter
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && add(e.target.files)}
        />
      </div>
      {photos.length === 0 ? (
        <p className="text-xs text-slate-500">
          Aucune photo. Ajoute des photos réelles pour tes annonces (réutilisables dans le brouillon).
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {photos.map((src, i) => (
            <div key={i} className="group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`Photo ${i + 1}`}
                className="h-20 w-20 rounded-lg object-cover ring-1 ring-line"
              />
              <button
                onClick={() => save(photos.filter((_, j) => j !== i))}
                disabled={busy}
                className="absolute -right-1.5 -top-1.5 rounded-full bg-rose-600 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                title="Supprimer"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
