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
  title: 'EventFlow — J. Benitez',
  description: 'Configurador de menús y eventos para J. Benitez. Crea propuestas personalizadas para bodas, cumpleaños, eventos corporativos y más.',
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
