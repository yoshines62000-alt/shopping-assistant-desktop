import { Package } from 'lucide-react';
import ProductHistory from '@/components/ProductHistory';
import PageShell from '@/components/ui/PageShell';

interface Props {
  params: { id: string };
}

export default function ProductPage({ params }: Props) {
  const id = params?.id ?? '';

  if (!id) return null;

  return (
    <PageShell title="Produit" icon={<Package className="h-6 w-6" />} subtitle={id}>
      <div className="mx-auto max-w-2xl">
        <ProductHistory productId={id} />
      </div>
    </PageShell>
  );
}
