'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
  viewport: { once: true },
};

const features = [
  {
    icon: (
      <svg className="h-8 w-8 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    title: 'Menú Personalizado',
    description: 'Elige entre más de 118 platos del catálogo Alboroto y crea una carta única para tu evento.',
  },
  {
    icon: (
      <svg className="h-8 w-8 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    title: 'Espacios Premium',
    description: 'Salón Principal, Terraza, Sala VIP y más. Cada espacio diseñado para crear momentos inolvidables.',
  },
  {
    icon: (
      <svg className="h-8 w-8 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
    title: 'Experiencia Única',
    description: 'Desde la propuesta hasta el último detalle, nos encargamos de todo para que tú solo disfrutes.',
  },
];

export default function FeaturesSection() {
  return (
    <section className="bg-paper py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          className="text-center"
          {...fadeInUp}
        >
          <span className="text-sm font-medium tracking-widest text-gold uppercase">
            ¿Por Qué Elegirnos?
          </span>
          <h2 className="mt-3 font-heading text-4xl font-bold text-ink md:text-5xl">
            Una Experiencia a Tu Medida
          </h2>
        </motion.div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              className="group rounded-2xl border border-cream-dark bg-paper p-8 shadow-sm transition-all duration-300 hover:border-gold/30 hover:shadow-md"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.15 }}
              viewport={{ once: true }}
            >
              <div className="mb-5 inline-flex rounded-xl bg-cream p-3 transition-transform duration-300 group-hover:scale-110">
                {feature.icon}
              </div>
              <h3 className="font-heading text-xl font-bold text-ink">
                {feature.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-ink/60">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="mt-14 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          <Link href="/configurador">
            <Button size="lg" className="rounded-full bg-burgundy px-10 text-base shadow-lg shadow-burgundy/20 hover:bg-burgundy-dark">
              Comienza a Diseñar
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
