'use client';

import { useI18n } from '@/lib/i18n';

export default function Footer() {
  const { t } = useI18n();
  return (
    <footer className="mt-12 border-t border-line py-5">
      <div className="page-container text-center text-xs text-slate-600">
        Shopping Assistant &middot; {t('foot.tagline', 'recherche réelle Amazon + eBay · estimations basées sur les ventes conclues')}
      </div>
    </footer>
  );
}
