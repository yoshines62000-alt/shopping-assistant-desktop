import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Shopping Assistant',
    short_name: 'ShopAssist',
    description: "Assistant achat / revente : recherche réelle, estimation, stock et comptes",
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0e17',
    theme_color: '#0a0e17',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Estimer une revente', url: '/estimate' },
      { name: 'Scanner un code-barres', url: '/scan' },
      { name: 'Mon stock', url: '/stock' },
    ],
  };
}
