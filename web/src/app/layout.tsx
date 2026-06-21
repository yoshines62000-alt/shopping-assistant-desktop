import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import Nav from './Nav';
import Footer from '@/components/Footer';
import PwaRegister from '@/components/PwaRegister';
import Toaster from '@/components/ui/Toaster';
import CommandPalette from '@/components/CommandPalette';
import AccentInit from '@/components/AccentInit';
import KeyboardShortcuts from '@/components/KeyboardShortcuts';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
// Police d'affichage géométrique (titres/marque) + mono technique (données/labels)
// pour l'identité « futuriste ».
const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display', weight: ['500', '600', '700'] });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', weight: ['400', '500', '600'] });

export const metadata: Metadata = {
  title: 'Shopping Assistant — Achat / Revente',
  description:
    "Recherche multi-sites réelle, estimation du prix de revente et suivi de stock : l'assistant qui facilite l'achat / revente",
  appleWebApp: { capable: true, title: 'ShopAssist', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
};

export const viewport: Viewport = {
  themeColor: '#07090d',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      className={`${inter.variable} ${display.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Anti-flash : applique le thème enregistré avant le premier rendu. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t;}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="flex min-h-screen flex-col">
        <PwaRegister />
        <Nav />
        <div className="flex-1">{children}</div>
        <Footer />
        <Toaster />
        <CommandPalette />
        <AccentInit />
        <KeyboardShortcuts />
      </body>
    </html>
  );
}