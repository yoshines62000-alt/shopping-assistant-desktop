/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // 'standalone' nécessite des symlinks (EPERM sous Windows hors mode développeur) :
  // activé uniquement pour le build Docker via BUILD_STANDALONE=1.
  ...(process.env.BUILD_STANDALONE === '1' ? { output: 'standalone' } : {}),
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
    formats: ['image/avif', 'image/webp'],
  },
  // Tree-shaking ciblé des barrels (icônes lucide-react) -> bundle plus léger
  // et compilation dev plus rapide (Next ne charge que les icônes utilisées).
  experimental: { optimizePackageImports: ['lucide-react'] },
};

module.exports = nextConfig;
