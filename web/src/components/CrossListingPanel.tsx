'use client';

import { useMemo, useState } from 'react';
import type { StockItem } from '@shopping-assistant/types';
import { Copy, Check, X } from 'lucide-react';
import { euro } from '@/lib/format';
import { toast } from '@/lib/toast';

type Platform = 'ebay' | 'vinted' | 'leboncoin';

interface Draft {
  title: string;
  description: string;
  price: number;
}

const PLATFORMS: { key: Platform; label: string; titleMax: number }[] = [
  { key: 'ebay', label: 'eBay', titleMax: 80 },
  { key: 'vinted', label: 'Vinted', titleMax: 100 },
  { key: 'leboncoin', label: 'Leboncoin', titleMax: 50 },
];

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

function buildDraft(item: StockItem, platform: Platform, titleMax: number): Draft {
  // Prix conseillé : l'estimation de revente si dispo, sinon une marge sur l'achat.
  const price = Math.round((item.estimatedResale ?? item.purchasePrice * 1.4) * 100) / 100;
  const notes = item.notes?.trim();
  const title = clip(item.name.trim(), titleMax);

  const common = [
    item.name.trim(),
    notes ? `État / détails : ${notes}` : 'Bon état général, photos réelles disponibles.',
  ];

  let body: string[];
  if (platform === 'ebay') {
    body = [
      ...common,
      '',
      'Envoi rapide et soigné sous 24-48 h. Paiement sécurisé.',
      'N’hésitez pas à poser vos questions avant achat.',
    ];
  } else if (platform === 'vinted') {
    body = [
      ...common,
      '',
      'Vendu car ne me sert plus 🙂 Prix négociable via offre.',
      'Lots possibles, regarde mon dressing !',
    ];
  } else {
    body = [
      ...common,
      '',
      'Remise en main propre possible ou envoi à vos frais.',
      'Annonce sérieuse, contactez-moi pour plus d’infos.',
    ];
  }

  return { title, description: body.join('\n'), price };
}

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copié`);
  } catch {
    toast.error('Copie impossible (clipboard indisponible)');
  }
}

export default function CrossListingPanel({
  item,
  onClose,
}: {
  item: StockItem;
  onClose: () => void;
}) {
  const [platform, setPlatform] = useState<Platform>('ebay');
  const meta = PLATFORMS.find((p) => p.key === platform)!;
  const draft = useMemo(() => buildDraft(item, platform, meta.titleMax), [item, platform, meta.titleMax]);
  const [copiedAll, setCopiedAll] = useState(false);

  const copyAll = async () => {
    await copy(`${draft.title}\n\n${draft.description}\n\nPrix : ${euro(draft.price)}`, 'Annonce');
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1500);
  };

  return (
    <div className="mt-3 rounded-lg border border-line bg-ink/40 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {PLATFORMS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPlatform(p.key)}
              className={`${platform === p.key ? 'btn-primary' : 'btn-secondary'} !px-3 !py-1 text-xs`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="btn-ghost" title="Fermer">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3">
        {item.photos && item.photos.length > 0 && (
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Photos ({item.photos.length}) — clic droit → enregistrer pour ton annonce
            </label>
            <div className="flex flex-wrap gap-2">
              {item.photos.map((src, i) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={i}
                  src={src}
                  alt={`Photo ${i + 1}`}
                  className="h-16 w-16 rounded-lg object-cover ring-1 ring-line"
                />
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Titre <span className="text-slate-600">({draft.title.length}/{meta.titleMax})</span>
            </label>
            <button onClick={() => copy(draft.title, 'Titre')} className="btn-ghost !p-1" title="Copier le titre">
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="rounded-md bg-ink/60 px-2 py-1.5 text-sm text-slate-100">{draft.title}</p>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Description
            </label>
            <button
              onClick={() => copy(draft.description, 'Description')}
              className="btn-ghost !p-1"
              title="Copier la description"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
          <pre className="whitespace-pre-wrap rounded-md bg-ink/60 px-2 py-1.5 text-sm text-slate-300">
            {draft.description}
          </pre>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">
            Prix conseillé : <span className="font-semibold text-accent">{euro(draft.price)}</span>
            {item.estimatedResale == null && (
              <span className="text-xs text-slate-500"> (marge ~40 % faute d’estimation)</span>
            )}
          </span>
          <button onClick={copyAll} className="btn-secondary !px-3 !py-1.5 text-xs">
            {copiedAll ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            Copier tout
          </button>
        </div>
      </div>
    </div>
  );
}
