'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/** Champ pour valeur sensible (token, mot de passe) : masqué par défaut, avec
 *  bascule afficher/masquer. */
export default function SecretInput({
  value,
  onChange,
  placeholder,
  autoComplete = 'off',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="input !pr-9"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
        title={show ? 'Masquer' : 'Afficher'}
        aria-label={show ? 'Masquer la valeur' : 'Afficher la valeur'}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
