'use client';
/**
 * EventFlow — Landing Page (B2C)
 * 
 * Hero inmersivo + galería de espacios + features + footer
 * Estilo premium: Playfair Display + Inter, cream/gold/burgundy
 * Sin precios — solo inspiración visual
 */

import Link from 'next/link';
import { motion } from 'framer-motion';

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-50px' },
  transition: { duration: 0.6, ease: 'easeOut' },
};

const staggerContainer = {
  initial: {},
  whileInView: { transition: { staggerChildren: 0.15 } },
};

const spaces = [
  { name: 'Salón Principal', desc: 'Hasta 300 comensales', span: 'md:col-span-2 md:row-span-2', gradient: 'from-amber-900/40 to-burgundy-900/40' },
  { name: 'Terraza', desc: 'Vistas al jardín', span: 'md:col-span-1 md:row-span-1', gradient: 'from-amber-800/30 to-cream-200/30' },
  { name: 'Sala VIP', desc: 'Eventos exclusivos', span: 'md:col-span-1 md:row-span-1', gradient: 'from-burgundy-900/40 to-ink-900/40' },
  { name: 'Jardín', desc: 'Ceremonias al aire libre', span: 'md:col-span-1 md:row-span-1', gradient: 'from-green-900/30 to-cream-200/30' },
  { name: 'Sala de Fiestas', desc: 'Celebraciones íntimas', span: 'md:col-span-1 md:row-span-1', gradient: 'from-gold-800/30 to-burgundy-900/30' },
];

const features = [
  { title: 'Menú Personalizado', desc: 'Diseña tu carta con más de 100 platos seleccionados por nuestros chefs.' },
  { title: 'Espacios Premium', desc: 'Salones versátiles que se adaptan a cada tipo de celebración.' },
  { title: 'Experiencia Única', desc: 'Desde la primera llamada hasta el último baile, nos encargamos de todo.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-cream text-ink">
      {/* ===== HERO ===== */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background gradient simulating a photo */}
        <div className="absolute inset-0 bg-gradient-to-br from-ink-900 via-ink-800 to-burgundy-950" />
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23d4a548\' fill-opacity=\'0.1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
        }} />
        
        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="mb-6"
          >
            <div className="inline-flex items-center gap-3 border border-gold/40 rounded-full px-6 py-2 mb-8">
              <span className="text-gold text-sm tracking-[0.3em] uppercase font-light">Salón de Celebraciones</span>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="font-serif text-5xl md:text-7xl lg:text-8xl text-cream leading-tight mb-6"
          >
            Alboroto
            <span className="block text-gold text-3xl md:text-5xl lg:text-6xl mt-2 italic font-light">
              Eventos
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="text-cream/70 text-lg md:text-xl max-w-2xl mx-auto mb-10 font-light leading-relaxed"
          >
            Cada celebración es única. Diseña tu evento perfecto con nuestro configurador
            interactivo y deja que nosotros nos encarguemos del resto.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.7 }}
          >
            <Link href="/configurador">
              <button className="bg-gold text-ink font-semibold px-10 py-4 rounded-lg text-lg
                hover:bg-amber-400 transition-all duration-300 shadow-lg shadow-gold/20
                hover:shadow-gold/40 hover:scale-105">
                Diseña tu Evento
              </button>
            </Link>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 1 }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2"
          >
            <div className="w-6 h-10 border-2 border-gold/40 rounded-full flex justify-center">
              <motion.div
                animate={{ y: [0, 12, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-1 h-3 bg-gold/60 rounded-full mt-2"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== ESPACIOS (Bento Grid) ===== */}
      <section className="py-24 px-6 bg-paper">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeInUp} className="text-center mb-16">
            <h2 className="font-serif text-4xl md:text-5xl text-ink mb-4">Nuestros Espacios</h2>
            <p className="text-ink-soft/80 text-lg max-w-xl mx-auto">
              Salones versátiles adaptados a cada tipo de celebración
            </p>
          </motion.div>

          <motion.div
            {...staggerContainer}
            className="grid grid-cols-2 md:grid-cols-4 grid-rows-3 gap-4 h-[600px] md:h-[500px]"
          >
            {spaces.map((space, i) => (
              <motion.div
                key={space.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className={`relative rounded-xl overflow-hidden cursor-pointer group ${space.span}
                  bg-gradient-to-br ${space.gradient} border border-gold/20`}
              >
                <div className="absolute inset-0 bg-ink/10 group-hover:bg-ink/0 transition-all duration-500" />
                <div className="absolute inset-0 flex flex-col justify-end p-6">
                  <h3 className="font-serif text-xl md:text-2xl text-cream mb-1">{space.name}</h3>
                  <p className="text-cream/70 text-sm">{space.desc}</p>
                </div>
                {/* Decorative icon */}
                <div className="absolute top-4 right-4 opacity-30 group-hover:opacity-60 transition-opacity">
                  <svg className="w-8 h-8 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section className="py-24 px-6 bg-cream">
        <div className="max-w-5xl mx-auto">
          <motion.div {...fadeInUp} className="text-center mb-16">
            <h2 className="font-serif text-4xl md:text-5xl text-ink mb-4">¿Por qué Alboroto?</h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
                className="bg-paper rounded-xl p-8 border border-gold/20 hover:border-gold/50 transition-all duration-300 hover:shadow-lg hover:shadow-gold/10"
              >
                <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center mb-6">
                  <svg className="w-6 h-6 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <h3 className="font-serif text-xl text-ink mb-3">{f.title}</h3>
                <p className="text-ink-soft/70 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA FINAL ===== */}
      <section className="py-24 px-6 bg-gradient-to-r from-ink-900 to-burgundy-950">
        <div className="max-w-3xl mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-serif text-4xl md:text-5xl text-cream mb-6"
          >
            Tu celebración, tu menú
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="text-cream/60 text-lg mb-10"
          >
            Selecciona tus platos favoritos y envía tu propuesta. Nosotros nos encargamos del resto.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            <Link href="/configurador">
              <button className="bg-gold text-ink font-semibold px-10 py-4 rounded-lg text-lg
                hover:bg-amber-400 transition-all duration-300 shadow-lg shadow-gold/20">
                Empezar a diseñar
              </button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="bg-ink-950 text-cream/50 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <div className="font-serif text-gold text-xl mb-2">Alboroto Eventos</div>
            <p className="text-sm">Salón de Celebraciones</p>
          </div>
          <div className="flex gap-8 text-sm">
            <span>Contacto: info@byalboroto.com</span>
            <span>·</span>
            <span>byalboroto.duckdns.org</span>
          </div>
          <p className="text-xs">© 2025 Alboroto Eventos. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
