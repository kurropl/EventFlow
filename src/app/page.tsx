'use client';
/**
 * EventFlow — Landing Page (B2C)
 * 
 * Estilo La Arqueria de Umbrete: elegante, oscuro, premium.
 * Textos blancos SOLO sobre fondos oscuros.
 * Textos oscuros (stone-800) sobre fondos claros.
 * Imagenes de Unsplash verificadas (todas 200).
 * Iconos Lucide React (solo iconos que existen en v0.400.0).
 */

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ChefHat, Star, Users, Calendar, MapPin, Phone, Mail,
  Sparkles, Utensils, CupSoda, Cake, Building2, Baby,
  Heart, Flower, Gift, Award, Music, Bell, Flame, Sun,
} from 'lucide-react';

// ============================================================
// Verified Unsplash images (all return HTTP 200)
// ============================================================
const HERO_IMAGES = [
  'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1920&q=80',
  'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=1920&q=80',
  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1920&q=80',
];

const GALLERY_IMAGES = [
  {
    src: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800&q=80',
    title: 'Salon Principal',
    desc: 'Hasta 300 comensales',
    span: 'md:col-span-2 md:row-span-2',
  },
  {
    src: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800&q=80',
    title: 'Terraza',
    desc: 'Vistas al jardin',
    span: 'md:col-span-1 md:row-span-1',
  },
  {
    src: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
    title: 'Sala VIP',
    desc: 'Eventos exclusivos',
    span: 'md:col-span-1 md:row-span-1',
  },
  {
    src: 'https://images.unsplash.com/photo-1478146059778-26028b07395a?w=800&q=80',
    title: 'Jardin',
    desc: 'Ceremonias al aire libre',
    span: 'md:col-span-1 md:row-span-1',
  },
  {
    src: 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=800&q=80',
    title: 'Sala de Fiestas',
    desc: 'Celebraciones intimas',
    span: 'md:col-span-1 md:row-span-1',
  },
  {
    src: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80',
    title: 'Gastronomia',
    desc: 'Mas de 100 platos',
    span: 'md:col-span-2 md:row-span-1',
  },
];

const EVENT_TYPES = [
  { id: 'boda', label: 'Bodas', icon: <Utensils className="w-7 h-7" />, desc: 'El dia mas importante' },
  { id: 'cumpleanos', label: 'Cumpleanos', icon: <Cake className="w-7 h-7" />, desc: 'Celebra tu dia' },
  { id: 'corporativo', label: 'Corporativos', icon: <Building2 className="w-7 h-7" />, desc: 'Eventos de empresa' },
  { id: 'bautizo', label: 'Bautizos', icon: <Baby className="w-7 h-7" />, desc: 'Momentos especiales' },
  { id: 'comunión', label: 'Comuniones', icon: <Sparkles className="w-7 h-7" />, desc: 'Celebraciones familiares' },
  { id: 'otro', label: 'Otros Eventos', icon: <Gift className="w-7 h-7" />, desc: 'Personaliza tu evento' },
];

const FEATURES = [
  {
    icon: <ChefHat className="w-9 h-9" />,
    title: 'Menu Personalizado',
    desc: 'Disena tu carta con mas de 100 platos seleccionados por nuestros chefs. Cada celebracion merece un menu a medida.',
    image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
  },
  {
    icon: <MapPin className="w-9 h-9" />,
    title: 'Espacios Unicos',
    desc: 'Salones versatiles que se adaptan a cada tipo de celebracion. Desde bodas intimas hasta grandes eventos corporativos.',
    image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800&q=80',
  },
  {
    icon: <Star className="w-9 h-9" />,
    title: 'Experiencia Premium',
    desc: 'Desde la primera llamada hasta el ultimo baile, nos encargamos de todo. Tu unico trabajo es disfrutar.',
    image: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800&q=80',
  },
];

const TESTIMONIALS = [
  {
    text: 'Nuestra boda fue exactamente como la sonamos. El equipo de Alboroto se encargo de cada detalle.',
    author: 'Maria & Carlos',
    event: 'Boda — Junio 2025',
  },
  {
    text: 'La comida es espectacular. Nuestros invitados aun hablan de los postres meses despues.',
    author: 'Familia Garcia',
    event: 'Comunion — Marzo 2025',
  },
  {
    text: 'Organizamos nuestra cena de empresa aqui y fue un exito total. Profesionalidad y calidad.',
    author: 'TechCorp Solutions',
    event: 'Evento Corporativo — Enero 2025',
  },
];

// ============================================================
// Animations
// ============================================================
const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-40px' },
  transition: { duration: 0.6, ease: 'easeOut' },
};

const staggerContainer = {
  initial: {},
  whileInView: { transition: { staggerChildren: 0.1 } },
};

const staggerItem = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

// ============================================================
// Components
// ============================================================

function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <img
          src={HERO_IMAGES[0]}
          alt=""
          className="w-full h-full object-cover"
          loading="eager"
        />
        <div className="absolute inset-0 bg-stone-950/70" />
      </div>

      {/* WHITE TEXT on dark overlay */}
      <div className="relative z-10 text-center px-6 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="inline-flex items-center gap-3 mb-8"
        >
          <span className="h-px w-8 bg-amber-400/60" />
          <span className="text-amber-300/80 text-sm tracking-[0.35em] uppercase font-light">
            Salon de Celebraciones Premium
          </span>
          <span className="h-px w-8 bg-amber-400/60" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="font-serif text-5xl sm:text-6xl md:text-7xl lg:text-8xl text-white leading-[1.1] mb-8"
        >
          <span className="block">Donde cada</span>
          <span className="block text-amber-300 italic font-light mt-2">celebracion</span>
          <span className="block">se convierte</span>
          <span className="block text-amber-300 italic font-light mt-2">en un recuerdo</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.9 }}
          className="text-stone-300 text-lg md:text-xl max-w-2xl mx-auto mb-12 font-light leading-relaxed"
        >
          Disena tu evento perfecto con nuestro configurador interactivo.
          Mas de 100 platos, espacios unicos y una experiencia que no olvidaras.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.1 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <Link href="/configurador" className="inline-block">
            <button className="bg-amber-500 text-stone-900 font-semibold px-10 py-4 rounded-lg text-lg
              hover:bg-amber-400 transition-all duration-300 shadow-lg shadow-amber-500/20
              hover:shadow-amber-400/40 hover:scale-105 cursor-pointer select-none">
              Disena tu Evento
            </button>
          </Link>
          <Link href="#espacios" className="inline-block">
            <button className="border border-white/30 text-white font-light px-10 py-4 rounded-lg text-lg
              hover:bg-white/10 transition-all duration-300 cursor-pointer select-none">
              Ver Espacios
            </button>
          </Link>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2"
      >
        <div className="w-6 h-10 border-2 border-amber-400/30 rounded-full flex justify-center">
          <motion.div
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-1 h-3 bg-amber-400/50 rounded-full mt-2"
          />
        </div>
      </motion.div>
    </section>
  );
}

function SpacesGallery() {
  return (
    <section id="espacios" className="py-20 md:py-28 px-6 bg-stone-50">
      <div className="max-w-7xl mx-auto">
        <motion.div {...fadeUp} className="text-center mb-14">
          <span className="text-amber-600 text-sm tracking-[0.3em] uppercase font-light block mb-4">
            Nuestros Espacios
          </span>
          <h2 className="font-serif text-4xl md:text-5xl text-stone-800 mb-4">
            El escenario perfecto
          </h2>
          <p className="text-stone-500 text-lg max-w-xl mx-auto leading-relaxed">
            Salones versatiles adaptados a cada tipo de celebracion.
          </p>
        </motion.div>

        <motion.div
          {...staggerContainer}
          className="grid grid-cols-2 md:grid-cols-4 grid-rows-3 gap-4 h-[450px] md:h-[550px]"
        >
          {GALLERY_IMAGES.map((space, i) => (
            <motion.div
              key={space.title}
              {...staggerItem}
              transition={{ delay: i * 0.06 }}
              className={`relative rounded-xl overflow-hidden cursor-pointer group ${space.span}`}
            >
              <img
                src={space.src}
                alt={space.title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-900/80 via-stone-900/20 to-transparent" />
              <div className="absolute inset-0 flex flex-col justify-end p-5 md:p-6">
                <h3 className="font-serif text-lg md:text-xl text-white mb-1">{space.title}</h3>
                <p className="text-stone-300 text-xs md:text-sm">{space.desc}</p>
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
    <section className="py-20 md:py-28 px-6 bg-white">
      <div className="max-w-7xl mx-auto">
        <motion.div {...fadeUp} className="text-center mb-14">
          <span className="text-amber-600 text-sm tracking-[0.3em] uppercase font-light block mb-4">
            Por que Alboroto
          </span>
          <h2 className="font-serif text-4xl md:text-5xl text-stone-800 mb-4">
            Mas que un salon
          </h2>
        </motion.div>

        <div className="space-y-20 md:space-y-28">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.6 }}
              className={`grid md:grid-cols-2 gap-8 md:gap-16 items-center ${
                i % 2 === 1 ? 'md:flex-row-reverse' : ''
              }`}
            >
              <div className={`rounded-xl overflow-hidden shadow-xl ${
                i % 2 === 1 ? 'md:order-2' : ''
              }`}>
                <img
                  src={f.image}
                  alt={f.title}
                  className="w-full h-56 md:h-72 object-cover hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              </div>
              <div className={i % 2 === 1 ? 'md:order-1' : ''}>
                <div className="text-amber-600 mb-4">{f.icon}</div>
                <h3 className="font-serif text-3xl md:text-4xl text-stone-800 mb-3">{f.title}</h3>
                <p className="text-stone-500 text-lg leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function EventTypesSection() {
  return (
    <section className="py-20 md:py-28 px-6 bg-stone-100">
      <div className="max-w-6xl mx-auto">
        <motion.div {...fadeUp} className="text-center mb-14">
          <span className="text-amber-600 text-sm tracking-[0.3em] uppercase font-light block mb-4">
            Tipos de Evento
          </span>
          <h2 className="font-serif text-4xl md:text-5xl text-stone-800 mb-4">
            Cada celebracion es unica
          </h2>
        </motion.div>

        <motion.div
          {...staggerContainer}
          className="grid grid-cols-2 sm:grid-cols-3 gap-4"
        >
          {EVENT_TYPES.map((et, i) => (
            <motion.div
              key={et.id}
              {...staggerItem}
              transition={{ delay: i * 0.06 }}
              className="bg-white rounded-xl p-6 border border-stone-200 hover:border-amber-300 hover:shadow-lg hover:shadow-amber-100/50 transition-all duration-300 cursor-pointer group"
            >
              <div className="text-amber-600 mb-3 group-hover:scale-110 transition-transform">
                {et.icon}
              </div>
              <h3 className="font-serif text-lg text-stone-800 mb-1">{et.label}</h3>
              <p className="text-stone-400 text-sm">{et.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  return (
    <section className="py-20 md:py-28 px-6 bg-stone-900">
      <div className="max-w-6xl mx-auto">
        <motion.div {...fadeUp} className="text-center mb-14">
          <span className="text-amber-400 text-sm tracking-[0.3em] uppercase font-light block mb-4">
            Testimonios
          </span>
          <h2 className="font-serif text-4xl md:text-5xl text-white mb-4">
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
              className="bg-stone-800/50 border border-stone-700 rounded-xl p-6 hover:border-amber-500/30 transition-all duration-300"
            >
              <div className="text-amber-400/40 text-3xl font-serif mb-3">"</div>
              <p className="text-stone-300 text-base leading-relaxed mb-5 italic">
                {t.text}
              </p>
              <div>
                <p className="text-white font-medium">{t.author}</p>
                <p className="text-amber-400/60 text-sm">{t.event}</p>
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
    <section className="py-20 md:py-28 px-6 relative overflow-hidden">
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1920&q=80"
          alt=""
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-stone-950/85" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="font-serif text-4xl md:text-5xl lg:text-6xl text-white mb-6"
        >
          Tu celebracion,
          <br />
          <span className="text-amber-300 italic">tu menu</span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 }}
          className="text-stone-300 text-lg md:text-xl mb-10 max-w-xl mx-auto"
        >
          Selecciona tus platos favoritos y envia tu propuesta.
          Nosotros nos encargamos del resto.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
        >
          <Link href="/configurador" className="inline-block">
            <button className="bg-amber-500 text-stone-900 font-semibold px-12 py-5 rounded-lg text-lg
              hover:bg-amber-400 transition-all duration-300 shadow-lg shadow-amber-500/20
              hover:shadow-amber-400/40 hover:scale-105 cursor-pointer select-none">
              Empezar a disenar
            </button>
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
    <div className="min-h-screen bg-stone-50 text-stone-800 overflow-x-hidden">
      <HeroSection />
      <SpacesGallery />
      <FeaturesSection />
      <EventTypesSection />
      <TestimonialsSection />
      <CTASection />

      {/* Footer */}
      <footer className="bg-stone-950 text-stone-400 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <div className="font-serif text-amber-400 text-xl mb-1">Alboroto Eventos</div>
            <p className="text-sm text-stone-500">Salon de Celebraciones Premium</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Mail className="w-4 h-4 text-amber-400/60" />
            <span>info@byalboroto.com</span>
          </div>
          <p className="text-xs text-stone-600">© 2025 Alboroto Eventos</p>
        </div>
      </footer>
    </div>
  );
}
