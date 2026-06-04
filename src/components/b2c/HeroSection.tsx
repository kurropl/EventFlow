'use client';

import Link from 'next/link';


export default function HeroSection() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink">
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-ink via-ink/95 to-burgundy-dark/80" />
      
      {/* Decorative gold lines */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-gold blur-3xl"
        />
        <div
          className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-burgundy blur-3xl"
        />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
        <div>
          <span className="inline-block rounded-full border border-gold/30 bg-gold/10 px-4 py-1.5 text-xs font-medium tracking-widest text-gold-light uppercase">
            J. Benitez
          </span>
        </div>

        <h1
          className="mt-6 font-heading text-5xl font-bold leading-tight text-paper md:text-7xl lg:text-8xl"
        >
          Diseña tu{' '}
          <span className="bg-gradient-to-r from-gold to-gold-light bg-clip-text text-transparent">
            Evento Perfecto
          </span>
        </h1>

        <p
          className="mx-auto mt-6 max-w-2xl text-lg text-cream/70 md:text-xl"
        >
          Crea una experiencia gastronómica única y memorable.
          Elige tu menú, personaliza cada detalle y deja que nosotros nos encarguemos del resto.
        </p>

        <div
          className="mt-10"
        >
          <Link href="/configurador">
            <button
              className="group relative inline-flex items-center gap-2 rounded-full bg-burgundy px-8 py-4 text-lg font-semibold text-paper shadow-lg shadow-burgundy/30 transition-all duration-300 hover:bg-burgundy-dark hover:shadow-xl hover:shadow-burgundy/40"
            >
              Diseña tu Evento
              <svg
                className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </Link>
        </div>

        <div
          className="mt-16 flex justify-center gap-12 text-cream/50"
        >
          <div className="text-center">
            <div className="font-heading text-3xl font-bold text-gold">15+</div>
            <div className="text-sm">Años de experiencia</div>
          </div>
          <div className="text-center">
            <div className="font-heading text-3xl font-bold text-gold">500+</div>
            <div className="text-sm">Eventos realizados</div>
          </div>
          <div className="text-center">
            <div className="font-heading text-3xl font-bold text-gold">118</div>
            <div className="text-sm">Platos en catálogo</div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <svg className="h-6 w-6 text-cream/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>
    </section>
  );
}
