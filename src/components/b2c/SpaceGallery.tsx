'use client';

import { motion } from 'framer-motion';
import { SPACES } from '@/data/catalog';

const container = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function SpaceGallery() {
  return (
    <section className="bg-cream py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          <span className="text-sm font-medium tracking-widest text-gold uppercase">
            Nuestros Espacios
          </span>
          <h2 className="mt-3 font-heading text-4xl font-bold text-ink md:text-5xl">
            Espacios para Cada Momento
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-ink/60">
            Desde íntimas reuniones hasta grandes celebraciones, tenemos el espacio perfecto para ti.
          </p>
        </motion.div>

        <motion.div
          className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-4 md:grid-rows-3 md:gap-5"
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
        >
          {SPACES.map((space, index) => (
            <motion.div
              key={space.name}
              variants={item}
              className={`group relative overflow-hidden rounded-2xl border border-cream-dark bg-paper shadow-sm ${space.span}`}
              whileHover={{ y: -4, transition: { duration: 0.3 } }}
            >
              {/* Placeholder background */}
              <div className="absolute inset-0 bg-gradient-to-br from-cream/50 to-cream-dark/50 transition-all duration-500 group-hover:from-cream-dark/50 group-hover:to-gold/10" />
              
              {/* Decorative icon */}
              <div className="absolute right-4 top-4 text-5xl opacity-20 transition-all duration-500 group-hover:opacity-40 group-hover:scale-110">
                {index === 0 ? '🏛️' : index === 1 ? '🌿' : index === 2 ? '👑' : index === 3 ? '🌺' : index === 4 ? '🎈' : '🎊'}
              </div>

              <div className="relative z-10 flex flex-col justify-end p-6">
                <h3 className="font-heading text-xl font-bold text-ink md:text-2xl">
                  {space.name}
                </h3>
                <p className="mt-2 text-sm text-ink/60">
                  {space.description}
                </p>
                <div className="mt-3 flex items-center gap-1 text-sm font-medium text-gold opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <span>Descubrir más</span>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
              </div>

              {/* Gold border on hover */}
              <div className="absolute inset-0 rounded-2xl border-2 border-transparent transition-all duration-300 group-hover:border-gold/40" />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
