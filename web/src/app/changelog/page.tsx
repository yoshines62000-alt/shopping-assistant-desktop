'use client';

import { useEffect } from 'react';
import { Megaphone } from 'lucide-react';
import PageShell from '@/components/ui/PageShell';
import { CHANGELOG, LATEST_VERSION, type ChangelogEntry } from '@/lib/changelog';
import { useI18n } from '@/lib/i18n';

export default function ChangelogPage() {
  const { t, locale } = useI18n();

  // Marque la dernière version comme vue (sert à l'indicateur « nouveautés »).
  useEffect(() => {
    try {
      localStorage.setItem('changelog-seen', LATEST_VERSION);
    } catch {
      /* ignore */
    }
  }, []);

  const fmtDate = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  const sections: { key: keyof Pick<ChangelogEntry, 'added' | 'improved' | 'fixed'>; label: string; color: string }[] = [
    { key: 'added', label: t('changelog.added', 'Ajouté'), color: 'text-emerald-400' },
    { key: 'improved', label: t('changelog.improved', 'Amélioré'), color: 'text-accent' },
    { key: 'fixed', label: t('changelog.fixed', 'Corrigé'), color: 'text-amber-400' },
  ];

  return (
    <PageShell
      title={t('changelog.title', 'Nouveautés')}
      icon={<Megaphone className="h-6 w-6" />}
      subtitle={t('changelog.subtitle', 'Les améliorations et corrections, version par version')}
    >
      <div className="mx-auto max-w-2xl space-y-4">
        {CHANGELOG.map((rel) => (
          <div key={rel.version} className="card-pad animate-fade-in">
            <div className="mb-3 flex items-center gap-3">
              <span className="font-mono text-sm font-semibold text-slate-100">v{rel.version}</span>
              {rel.version === LATEST_VERSION && (
                <span className="badge-success">{t('changelog.current', 'Version actuelle')}</span>
              )}
              <span className="ml-auto text-xs text-slate-500">{fmtDate(rel.date)}</span>
            </div>
            <div className="space-y-3">
              {sections.map((s) => {
                const items = rel[s.key];
                if (!items || items.length === 0) return null;
                return (
                  <div key={s.key}>
                    <p className={`mb-1 text-xs font-semibold uppercase tracking-wide ${s.color}`}>{s.label}</p>
                    <ul className="space-y-1">
                      {items.map((item, i) => (
                        <li key={i} className="flex gap-2 text-sm text-slate-300">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-500" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
