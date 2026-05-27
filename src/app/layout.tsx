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
  title: 'J.Benitez — Salon de Celebraciones Premium',
  description: 'J.Benitez. Salon de celebraciones premium en Sevilla. Configura tu evento perfecto con nuestro disenador interactivo. Mas de 100 platos, espacios unicos y una experiencia inolvidable.',
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
