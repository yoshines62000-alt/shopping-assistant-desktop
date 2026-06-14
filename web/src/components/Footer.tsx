import BackendStatus from '@/components/BackendStatus';

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-line py-6">
      <div className="page-container flex flex-col items-center justify-between gap-2 text-center text-xs text-slate-500 sm:flex-row sm:text-left">
        <span>
          Shopping Assistant &middot; recherche réelle Amazon + eBay &middot; estimations basées sur
          les ventes conclues
        </span>
        <BackendStatus />
      </div>
    </footer>
  );
}
