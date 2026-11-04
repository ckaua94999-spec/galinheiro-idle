import type { Metadata, Viewport } from 'next';
import { Lilita_One, Nunito } from 'next/font/google';
import { Provedores } from '@/cliente/Provedores';
import './globals.css';

// Lilita One: títulos, botões e números de jogo (um peso só). Nunito: texto corrido.
const lilita = Lilita_One({ subsets: ['latin'], weight: '400', variable: '--font-lilita', display: 'swap' });
const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Galinheiro Idle', template: '%s · Galinheiro Idle' },
  description: 'Cuide do seu galinheiro, colete ovos-surpresa, gire a roleta e colecione animais raros.',
  applicationName: 'Galinheiro Idle',
  appleWebApp: { capable: true, title: 'Galinheiro', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  other: { 'mobile-web-app-capable': 'yes' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#49b8ff',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${lilita.variable} ${nunito.variable}`}>
      <body>
        <Provedores>{children}</Provedores>
      </body>
    </html>
  );
}
