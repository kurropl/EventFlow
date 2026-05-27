'use client';

import { motion } from 'framer-motion';

export default function LandingFooter() {
  return (
    <footer className="border-t border-cream-dark bg-cream">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-10 md:grid-cols-3">
          {/* Brand */}
          <div>
            <h3 className="font-heading text-2xl font-bold text-ink">
              J. Benitez
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-ink/60">
              Creamos experiencias gastronómicas únicas e inolvidables.
              Cada evento es una oportunidad para superar expectativas.
            </p>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-heading text-lg font-semibold text-ink">Contacto</h4>
            <div className="mt-4 space-y-2 text-sm text-ink/60">
              <p className="flex items-center gap-2">
                <svg className="h-4 w-4 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                +34 900 000 000
              </p>
              <p className="flex items-center gap-2">
                <svg className="h-4 w-4 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                info@alborotoeventos.es
              </p>
              <p className="flex items-center gap-2">
                <svg className="h-4 w-4 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Sevilla, España
              </p>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-heading text-lg font-semibold text-ink">Enlaces</h4>
            <div className="mt-4 space-y-2">
              <a href="/" className="block text-sm text-ink/60 transition-colors hover:text-gold">
                Inicio
              </a>
              <a href="/configurador" className="block text-sm text-ink/60 transition-colors hover:text-gold">
                Diseña tu Evento
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-cream-dark pt-8 text-center text-sm text-ink/40">
          <p>© {new Date().getFullYear()} J. Benitez. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
