'use client';
/**
 * EventFlow — Landing Page (B2C) Rediseñada
 * 
 * Hero con video de fondo + galería masonry con imágenes reales
 * Animaciones premium con Framer Motion
 * Estilo elegante: serif headlines, cream/gold/burgundy palette
 */

import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';

// ============================================================
// Image assets from Unsplash (free, high-quality event venue photos)
// ============================================================
const HERO_IMAGES = [
  'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1920&q=80', // elegant event hall
  'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=1920&q=80', // wedding reception
  'https://images.unsplash.com/photo-1530023367847-a683933f4672?w=1920&q=80', // elegant table setting
];

const GALLERY_IMAGES = [
  {
    src: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800&q=80',
    title: 'Salón Principal',
    desc: 'Hasta 300 comensales',
    span: 'md:col-span-2 md:row-span-2',
  },
  {
    src: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800&q=80',
    title: 'Terraza',
    desc: 'Vistas al jardín',
    span: 'md:col-span-1 md:row-span-1',
  },
  {
    src: 'https://images.unsplash.com/photo-1530023367847-a683933f4672?w=800&q=80',
    title: 'Sala VIP',
    desc: 'Eventos exclusivos',
    span: 'md:col-span-1 md:row-span-1',
  },
  {
    src: 'https://images.unsplash.com/photo-1478146059778-26028b07395a?w=800&q=80',
    title: 'Jardín',
    desc: 'Ceremonias al aire libre',
    span: 'md:col-span-1 md:row-span-1',
  },
  {
    src: 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=800&q=80',
    title: 'Sala de Fiestas',
    desc: 'Celebraciones íntimas',
    span: 'md:col-span-1 md:row-span-1',
  },
  {
    src: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80',
    title: 'Gastronomía',
    desc: 'Más de 100 platos',
    span: 'md:col-span-2 md:row-span-1',
  },
];

const FEATURES = [
  {
    icon: '🍽️',
    title: 'Menú Personalizado',
    desc: 'Diseña tu carta con más de 100 platos seleccionados por nuestros chefs. Cada celebración merece un menú a medida.',
    image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80',
  },
  {
    icon: '✨',
    title: 'Espacios Premium',
    desc: 'Salones versátiles que se adaptan a cada tipo de celebración. Desde bodas íntimas hasta grandes eventos corporativos.',
    image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=600&q=80',
  },
  {
    icon: '🎉',
    title: 'Experiencia Única',
    desc: 'Desde la primera llamada hasta el último baile, nos encargamos de todo. Tu único trabajo es disfrutar.',
    image: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=600&q=80',
  },
];

const TESTIMONIALS = [
  {
    text: 'Nuestra boda fue exactamente como la soñamos. El equipo de Alboroto se encargó de cada detalle.',
    author: 'María & Carlos',
    event: 'Boda — Junio 2025',
  },
  {
    text: 'La comida es espectacular. Nuestros invitados aún hablan de los postres meses después.',
    author: 'Familia García',
    event: 'Comunión — Marzo 2025',
  },
  {
    text: 'Organizamos nuestra cena de empresa aquí y fue un éxito total. Profesionalidad y calidad.',
    author: 'TechCorp Solutions',
    event: 'Evento Corporativo — Enero 2025',
  },
];

// ============================================================
// Animations
// ============================================================
const fadeInUp = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-50px' },
  transition: { duration: 0.7, ease: 'easeOut' },
};

const fadeIn = {
  initial: { opacity: 0 },
  whileInView: { opacity: 1 },
  viewport: { once: true },
  transition: { duration: 0.8 },
};

const staggerContainer = {
  initial: {},
  whileInView: { transition: { staggerChildren: 0.12 } },
};

const staggerItem = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

// ============================================================
// Components
// ============================================================

function HeroSection() {
  const videoRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: videoRef,
    offset: ['start start', 'end start'],
  });
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 1.1]);

  // Auto-rotate hero images
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section ref={videoRef} className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Image slideshow background */}
      <div className="absolute inset-0">
        {HERO_IMAGES.map((img, i) => (
          <motion.div
            key={img}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: i === currentImageIndex ? 1 : 0 }}
            transition={{ duration: 1.5 }}
          >
            <img
              src={img}
              alt=""
              className="w-full h-full object-cover"
              loading="eager"
            />
          </motion.div>
        ))}
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-ink-900/70 via-ink-900/50 to-ink-950" />
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4a548' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      {/* Content */}
      <motion.div
        style={{ opacity, scale }}
        className="relative z-10 text-center px-6 max-w-5xl mx-auto"
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="inline-flex items-center gap-3 mb-8"
        >
          <span className="h-px w-8 bg-gold/60" />
          <span className="text-gold/80 text-sm tracking-[0.35em] uppercase font-light">
            Salón de Celebraciones Premium
          </span>
          <span className="h-px w-8 bg-gold/60" />
        </motion.div>

        {/* Main heading */}
        <motion.h1
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="font-serif text-5xl sm:text-6xl md:text-7xl lg:text-8xl text-cream leading-[1.1] mb-8"
        >
          <span className="block">Donde cada</span>
          <span className="block text-gold/90 italic font-light mt-2">
            celebración
          </span>
          <span className="block">se convierte</span>
          <span className="block text-gold/90 italic font-light mt-2">en un recuerdo</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.9 }}
          className="text-cream/60 text-lg md:text-xl max-w-2xl mx-auto mb-12 font-light leading-relaxed"
        >
          Diseña tu evento perfecto con nuestro configurador interactivo.
          Más de 100 platos, espacios únicos y una experiencia que no olvidarás.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.1 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <Link href="/configurador" className="inline-block">
            <span className="bg-gold text-ink font-semibold px-10 py-4 rounded-lg text-lg
              hover:bg-amber-400 transition-all duration-300 shadow-lg shadow-gold/20
              hover:shadow-gold/40 hover:scale-105 cursor-pointer select-none">
              Diseña tu Evento
            </span>
          </Link>
          <Link href="#espacios" className="inline-block">
            <span className="border border-cream/30 text-cream font-light px-10 py-4 rounded-lg text-lg
              hover:bg-cream/10 transition-all duration-300 cursor-pointer select-none">
              Ver Espacios
            </span>
          </Link>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 1 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
        >
          <div className="w-6 h-10 border-2 border-gold/30 rounded-full flex justify-center">
            <motion.div
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-1 h-3 bg-gold/50 rounded-full mt-2"
            />
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}

function SpacesGallery() {
  return (
    <section id="espacios" className="py-24 md:py-32 px-6 bg-cream">
      <div className="max-w-7xl mx-auto">
        <motion.div
          {...fadeInUp}
          className="text-center mb-16 md:mb-20"
        >
          <span className="text-gold text-sm tracking-[0.3em] uppercase font-light block mb-4">
            Nuestros Espacios
          </span>
          <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-ink mb-6">
            El escenario perfecto
          </h2>
          <p className="text-ink-soft/70 text-lg max-w-xl mx-auto leading-relaxed">
            Salones versátiles adaptados a cada tipo de celebración, desde íntimas reuniones
            hasta grandes eventos con más de 300 invitados.
          </p>
        </motion.div>

        {/* Masonry Grid */}
        <motion.div
          {...staggerContainer}
          className="grid grid-cols-2 md:grid-cols-4 grid-rows-3 gap-4 h-[500px] md:h-[600px]"
        >
          {GALLERY_IMAGES.map((space, i) => (
            <motion.div
              key={space.title}
              {...staggerItem}
              transition={{ delay: i * 0.08 }}
              className={`relative rounded-2xl overflow-hidden cursor-pointer group ${space.span}`}
            >
              <img
                src={space.src}
                alt={space.title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                loading="lazy"
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-ink-900/80 via-ink-900/20 to-transparent group-hover:from-ink-900/60 transition-all duration-500" />
              {/* Content */}
              <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-8">
                <h3 className="font-serif text-xl md:text-2xl text-cream mb-1">
                  {space.title}
                </h3>
                <p className="text-cream/60 text-sm md:text-base">{space.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section className="py-24 md:py-32 px-6 bg-paper">
      <div className="max-w-7xl mx-auto">
        <motion.div
          {...fadeInUp}
          className="text-center mb-16 md:mb-20"
        >
          <span className="text-gold text-sm tracking-[0.3em] uppercase font-light block mb-4">
            ¿Por qué Alboroto?
          </span>
          <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-ink mb-6">
            Más que un salón
          </h2>
        </motion.div>

        <div className="space-y-24 md:space-y-32">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.7 }}
              className={`grid md:grid-cols-2 gap-8 md:gap-16 items-center ${
                i % 2 === 1 ? 'md:direction-rtl' : ''
              }`}
            >
              {/* Image */}
              <motion.div
                className={`rounded-2xl overflow-hidden shadow-2xl shadow-ink/10 ${
                  i % 2 === 1 ? 'md:order-2' : ''
                }`}
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.3 }}
              >
                <img
                  src={f.image}
                  alt={f.title}
                  className="w-full h-64 md:h-80 object-cover"
                  loading="lazy"
                />
              </motion.div>
              {/* Text */}
              <div className={i % 2 === 1 ? 'md:order-1' : ''}>
                <div className="text-4xl mb-6">{f.icon}</div>
                <h3 className="font-serif text-3xl md:text-4xl text-ink mb-4">{f.title}</h3>
                <p className="text-ink-soft/70 text-lg leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  return (
    <section className="py-24 md:py-32 px-6 bg-ink-900">
      <div className="max-w-6xl mx-auto">
        <motion.div
          {...fadeInUp}
          className="text-center mb-16"
        >
          <span className="text-gold text-sm tracking-[0.3em] uppercase font-light block mb-4">
            Testimonios
          </span>
          <h2 className="font-serif text-4xl md:text-5xl text-cream mb-6">
            Lo que dicen nuestros clientes
          </h2>
        </motion.div>

        <motion.div
          {...staggerContainer}
          className="grid md:grid-cols-3 gap-6"
        >
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={i}
              {...staggerItem}
              transition={{ delay: i * 0.1 }}
              className="bg-ink-800/50 border border-gold/10 rounded-2xl p-8 hover:border-gold/30 transition-all duration-300"
            >
              <div className="text-gold/40 text-4xl font-serif mb-4">"</div>
              <p className="text-cream/80 text-lg leading-relaxed mb-6 italic">
                {t.text}
              </p>
              <div>
                <p className="text-cream font-medium">{t.author}</p>
                <p className="text-gold/60 text-sm">{t.event}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="py-24 md:py-32 px-6 relative overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1920&q=80"
          alt=""
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-950/90 to-burgundy-950/90" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="font-serif text-4xl md:text-5xl lg:text-6xl text-cream mb-6"
        >
          Tu celebración,<br />
          <span className="text-gold/90 italic">tu menú</span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 }}
          className="text-cream/60 text-lg md:text-xl mb-12 max-w-xl mx-auto"
        >
          Selecciona tus platos favoritos y envía tu propuesta.
          Nosotros nos encargamos del resto.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
        >
          <Link href="/configurador" className="inline-block">
            <span className="bg-gold text-ink font-semibold px-12 py-5 rounded-lg text-lg
              hover:bg-amber-400 transition-all duration-300 shadow-lg shadow-gold/20
              hover:shadow-gold/40 hover:scale-105 cursor-pointer select-none">
              Empezar a diseñar
            </span>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-cream text-ink overflow-x-hidden">
      <HeroSection />
      <SpacesGallery />
      <FeaturesSection />
      <TestimonialsSection />
      <CTASection />

      {/* Footer */}
      <footer className="bg-ink-950 text-cream/40 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <div className="font-serif text-gold text-xl mb-2">Alboroto Eventos</div>
            <p className="text-sm">Salón de Celebraciones Premium</p>
          </div>
          <div className="flex gap-6 text-sm">
            <span>info@byalboroto.com</span>
            <span className="text-gold/40">·</span>
            <span>byalboroto.duckdns.org</span>
          </div>
          <p className="text-xs">© 2025 Alboroto Eventos</p>
        </div>
      </footer>
    </div>
  );
}
