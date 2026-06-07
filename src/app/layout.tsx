import type { Metadata } from 'next';
import { Playfair_Display, Inter } from 'next/font/google';
import './globals.css';

const playfair = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-heading',
});

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
});

export const metadata: Metadata = {
  title: 'J. Benitez — Salón de Celebraciones Premium en Sevilla',
  description: 'Celebra tu evento especial en J. Benitez. Bodas, comuniones, bautizos y eventos corporativos con servicio de catering premium.',
  metadataBase: new URL('https://eventcater.duckdns.org'),
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'J. Benitez — Salón de Celebraciones Premium en Sevilla',
    description: 'Celebra tu evento especial en J. Benitez. Bodas, comuniones, bautizos y eventos corporativos con servicio de catering premium.',
    url: 'https://eventcater.duckdns.org',
    siteName: 'J. Benitez',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'J. Benitez — Salón de Celebraciones Premium en Sevilla',
    description: 'Celebra tu evento especial en J. Benitez. Bodas, comuniones, bautizos y eventos corporativos.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${playfair.variable} ${inter.variable}`}>
      <body className="font-body min-h-screen bg-paper text-ink">
        {children}
      </body>
    </html>
  );
}
