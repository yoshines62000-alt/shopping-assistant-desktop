import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="card max-w-md p-8 text-center">
        <h2 className="brand-text text-6xl font-bold">404</h2>
        <p className="mt-3 text-slate-400">Cette page n&apos;existe pas.</p>
        <Link href="/" className="btn-primary mt-5">
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
