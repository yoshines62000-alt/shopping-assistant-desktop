import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import Nav from './Nav';
import Footer from '@/components/Footer';
import PwaRegister from '@/components/PwaRegister';
import Toaster from '@/components/ui/Toaster';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Shopping Assistant — Achat / Revente',
  description:
    "Recherche multi-sites réelle, estimation du prix de revente et suivi de stock : l'assistant qui facilite l'achat / revente",
  appleWebApp: { capable: true, title: 'ShopAssist', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
};

export const viewport: Viewport = {
  themeColor: '#0a0e17',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={inter.variable}>
      <body className="flex min-h-screen flex-col">
        <PwaRegister />
        <Nav />
        <div className="flex-1">{children}</div>
        <Footer />
        <Toaster />
      </body>
    </html>
  );
}