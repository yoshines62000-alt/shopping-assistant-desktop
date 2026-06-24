'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Package } from 'lucide-react';
import ProductHistory from '@/components/ProductHistory';
import PageShell from '@/components/ui/PageShell';

// Page produit basée sur ?id= (et non /products/[id]) : compatible export
// statique (build mobile Capacitor), qui n'aime pas les segments dynamiques.
function ProductContent() {
  const id = useSearchParams().get('id') ?? '';
  if (!id) {
    return (
      <PageShell title="Produit" icon={<Package className="h-6 w-6" />}>
        <p className="text-sm text-slate-500">Aucun produit sélectionné.</p>
      </PageShell>
    );
  }
  return (
    <PageShell title="Produit" icon={<Package className="h-6 w-6" />} subtitle={id}>
      <div className="mx-auto max-w-2xl">
        <ProductHistory productId={id} />
      </div>
    </PageShell>
  );
}

export default function ProductPage() {
  return (
    <Suspense fallback={null}>
      <ProductContent />
    </Suspense>
  );
}
