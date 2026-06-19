'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { ACCENTS, applyAccent, currentTheme, getSavedAccent, saveAccent } from '@/lib/accent';

/** Sélecteur de couleur d'accent : applique et mémorise le choix immédiatement. */
export default function AccentPicker() {
  const [active, setActive] = useState('cyan');

  useEffect(() => setActive(getSavedAccent()), []);

  const pick = (id: string) => {
    setActive(id);
    saveAccent(id);
    applyAccent(id, currentTheme());
  };

  return (
    <div className="flex flex-wrap gap-2.5">
      {ACCENTS.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => pick(a.id)}
          title={a.label}
          aria-label={a.label}
          aria-pressed={active === a.id}
          className={`flex h-9 w-9 items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-surface transition-transform hover:scale-110 ${
            active === a.id ? 'ring-slate-300' : 'ring-transparent'
          }`}
          style={{ backgroundColor: a.swatch }}
        >
          {active === a.id && <Check className="h-4 w-4 text-white" />}
        </button>
      ))}
    </div>
  );
}
