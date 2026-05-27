'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';

// ============================================================
// DESIGN PHILOSOPHY
// Fusion: Stripe's weight-300 elegance + Apple's cinematic rhythm
// + Alboroto's gold/cream/ink heritage
// ============================================================

// ---- Design Tokens (inspired by Stripe's precision) ----
const tokens = {
  gold: '#C9A84C',
  goldLight: '#D4B85C',
  goldDark: '#A88830',
  ink: '#1A1A1A',
  inkLight: '#2E2E2E',
  cream: '#FAF8F5',
  creamDark: '#F0EDE5',
  white: '#FFFFFF',
  stone: '#6B6B6B',
  stoneLight: '#A3A3A3',
  border: 'rgba(0,0,0,0.06)',
  // Stripe-inspired multi-layer shadow
  shadowBlue: 'rgba(80,60,40,0.08)',
  shadowBlack: 'rgba(0,0,0,0.04)',
  transition: { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] },
};

// ---- Animation presets ----
const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: tokens.transition,
};

const staggerContainer = {
  initial: {},
  whileInView: { transition: { staggerChildren: 0.08 } },
};

const staggerItem = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
};

// ============================================================
// Navigation — Apple-inspired glass with Alboroto warmth
// ============================================================
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ${
        scrolled
          ? 'bg-white/85 backdrop-blur-2xl shadow-sm'
          : 'bg-transparent'
      }`}
      style={
        scrolled
          ? {
              boxShadow: `0 1px 0 ${tokens.border}, 0 4px 30px ${tokens.shadowBlue}`,
              borderBottom: '1px solid rgba(201,168,76,0.08)',
            }
          : {}
      }
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="flex items-center justify-between h-20 md:h-24">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-700 ${
                scrolled
                  ? 'bg-[#1A1A1A]'
                  : 'bg-white/15 backdrop-blur-md'
              }`}
            >
              <span
                className={`font-serif text-xl font-bold transition-colors duration-700 ${
                  scrolled ? 'text-[#C9A84C]' : 'text-white'
                }`}
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
              >
                A
              </span>
            </div>
            <span
              className={`font-serif text-xl tracking-wide transition-all duration-700 ${
                scrolled ? 'text-[#1A1A1A]' : 'text-white'
              }`}
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              Alboroto
            </span>
          </Link>

          {/* Desktop Nav — Stripe-style precision spacing */}
          <div className="hidden md:flex items-center gap-12">
            {['Espacios', 'Servicios', 'Eventos'].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className={`text-sm tracking-[0.02em] font-medium transition-all duration-300 relative after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 after:bg-[#C9A84C] after:transition-all after:duration-300 hover:after:w-full ${
                  scrolled
                    ? 'text-stone-600 hover:text-[#1A1A1A]'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                {item}
              </a>
            ))}
            <Link href="/configurador">
              <button
                className={`px-7 py-3 text-sm font-medium tracking-wide transition-all duration-500 ${
                  scrolled
                    ? 'bg-[#1A1A1A] text-white hover:bg-[#2E2E2E]'
                    : 'bg-white/10 backdrop-blur-md text-white border border-white/30 hover:bg-white/20'
                }`}
                style={{
                  boxShadow: scrolled
                    ? `0 2px 8px ${tokens.shadowBlue}`
                    : 'none',
                }}
              >
                Diseña tu Evento
              </button>
            </Link>
          </div>

          {/* Mobile Hamburger */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <div
              className={`w-6 h-5 flex flex-col justify-between transition-colors ${
                scrolled ? 'text-[#1A1A1A]' : 'text-white'
              }`}
            >
              <span
                className={`w-full h-0.5 bg-current transform transition-all duration-300 ${
                  mobileOpen ? 'rotate-45 translate-y-[9px]' : ''
                }`}
              />
              <span
                className={`w-full h-0.5 bg-current transition-all duration-300 ${
                  mobileOpen ? 'opacity-0' : ''
                }`}
              />
              <span
                className={`w-full h-0.5 bg-current transform transition-all duration-300 ${
                  mobileOpen ? '-rotate-45 -translate-y-[9px]' : ''
                }`}
              />
            </div>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <motion.div
        initial={false}
        animate={{
          height: mobileOpen ? 'auto' : 0,
          opacity: mobileOpen ? 1 : 0,
        }}
        className="md:hidden overflow-hidden bg-white/95 backdrop-blur-2xl border-t border-stone-100"
      >
        <div className="px-6 py-8 space-y-6">
          {['Espacios', 'Servicios', 'Eventos', 'Testimonios'].map(
            (item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                onClick={() => setMobileOpen(false)}
                className="block text-lg font-serif text-[#1A1A1A] hover:text-[#C9A84C] transition-colors"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
              >
                {item}
              </a>
            )
          )}
          <Link href="/configurador" onClick={() => setMobileOpen(false)}>
            <button className="w-full py-4 bg-[#1A1A1A] text-white text-sm font-medium tracking-wide">
              Diseña tu Evento
            </button>
          </Link>
        </div>
      </motion.div>
    </nav>
  );
}

// ============================================================
// Hero — Stripe weight-300 typography × Apple cinematic video
// ============================================================
function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Video Background — cinematic treatment */}
      <div className="absolute inset-0 z-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover scale-105"
          style={{ filter: 'brightness(0.30) saturate(0.65) contrast(1.15)' }}
        >
          <source
            src="https://cdn.coverr.co/videos/coverr-setting-a-table-for-a-wedding-2633/1080p.mp4"
            type="video/mp4"
          />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-black/70" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-black/30" />
        {/* Gold vignette overlay */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background:
              'radial-gradient(ellipse at center, transparent 50%, rgba(201,168,76,0.15) 100%)',
          }}
        />
      </div>

      <div className="relative z-10 text-center px-6 max-w-5xl mx-auto">
        {/* Eyebrow — Stripe-style light weight */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="inline-flex items-center gap-4 mb-8"
        >
          <div className="h-px w-10 bg-[#C9A84C]/50" />
          <span
            className="text-[#C9A84C] text-[11px] tracking-[0.4em] uppercase font-light"
          >
            Salón de Celebraciones Premium
          </span>
          <div className="h-px w-10 bg-[#C9A84C]/50" />
        </motion.div>

        {/* Headline — Stripe weight-300 + Playfair serif elegance */}
        <motion.h1
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="text-white mb-6"
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
            lineHeight: 1.08,
            fontWeight: 400,
            letterSpacing: '-0.02em',
          }}
        >
          Donde cada celebración
          <br />
          <span
            className="italic"
            style={{ color: 'rgba(201,168,76,0.85)' }}
          >
            se convierte en recuerdo
          </span>
        </motion.h1>

        {/* Subtitle — Stripe-style weight 300 */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.6 }}
          className="text-white/65 text-base md:text-lg max-w-2xl mx-auto mb-12 leading-relaxed font-light tracking-wide"
          style={{ fontWeight: 300 }}
        >
          Configura tu evento perfecto con nuestro diseñador interactivo.
          Más de 100 platos, espacios únicos y una experiencia inolvidable.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.8 }}
          className="flex flex-col sm:flex-row gap-5 justify-center items-center"
        >
          <Link href="/configurador">
            <button className="group px-10 py-4 text-sm font-medium tracking-wider transition-all duration-500 flex items-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #C9A84C 0%, #D4B85C 100%)',
                color: '#1A1A1A',
                boxShadow: '0 4px 20px rgba(201,168,76,0.3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 30px rgba(201,168,76,0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = '';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(201,168,76,0.3)';
              }}
            >
              Diseña tu Evento
              <svg
                className="w-4 h-4 transition-transform group-hover:translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </button>
          </Link>
          <a href="#espacios">
            <button
              className="px-10 py-4 text-sm font-medium tracking-wider transition-all duration-500"
              style={{
                border: '1px solid rgba(255,255,255,0.25)',
                color: 'rgba(255,255,255,0.9)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)';
              }}
            >
              Ver Espacios
            </button>
          </a>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.5 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2"
      >
        <div
          className="w-6 h-10 rounded-full flex justify-center"
          style={{ border: '1px solid rgba(255,255,255,0.2)' }}
        >
          <motion.div
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-1.5 h-3 rounded-full mt-2"
            style={{ background: 'rgba(255,255,255,0.4)' }}
          />
        </div>
      </motion.div>
    </section>
  );
}

// ============================================================
// Stats — Floating card with Stripe multi-layer shadow
// ============================================================
function StatsSection() {
  const stats = [
    { value: '100+', label: 'Platos disponibles' },
    { value: '300', label: 'Comensales máximos' },
    { value: '500+', label: 'Eventos realizados' },
    { value: '98%', label: 'Satisfacción clientes' },
  ];

  return (
    <section className="-mt-16 z-20 px-6 relative">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="rounded-2xl p-8 md:p-10 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12"
          style={{
            background: tokens.white,
            boxShadow: `0 4px 40px ${tokens.shadowBlue}, 0 2px 12px ${tokens.shadowBlack}`,
            border: `1px solid ${tokens.border}`,
          }}
        >
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 * i, duration: 0.5 }}
              className="text-center"
            >
              <div
                className="font-serif text-3xl md:text-4xl mb-1"
                style={{
                  color: tokens.ink,
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontWeight: 400,
                  letterSpacing: '-0.02em',
                }}
              >
                {s.value}
              </div>
              <div
                className="text-xs tracking-[0.15em] uppercase"
                style={{ color: tokens.stone, fontWeight: 400 }}
              >
                {s.label}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================
// Spaces — Editorial masonry with Apple-style curated photography
// ============================================================
function SpacesSection() {
  const spaces = [
    {
      src: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1200&q=85',
      title: 'Salón Principal',
      desc: 'Hasta 300 comensales',
      span: 'md:col-span-2 md:row-span-2',
      gradient: 'from-black/70 via-black/20 to-transparent',
    },
    {
      src: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800&q=85',
      title: 'Terraza',
      desc: 'Vistas al jardín',
      span: '',
      gradient: 'from-black/60 via-black/10 to-transparent',
    },
    {
      src: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=85',
      title: 'Sala VIP',
      desc: 'Eventos exclusivos',
      span: '',
      gradient: 'from-black/60 via-black/10 to-transparent',
    },
    {
      src: 'https://images.unsplash.com/photo-1478146059778-26028b07395a?w=800&q=85',
      title: 'Jardín',
      desc: 'Ceremonias al aire libre',
      span: '',
      gradient: 'from-black/60 via-black/10 to-transparent',
    },
    {
      src: 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=800&q=85',
      title: 'Sala Íntima',
      desc: 'Celebraciones pequeñas',
      span: '',
      gradient: 'from-black/60 via-black/10 to-transparent',
    },
  ];

  return (
    <section
      id="espacios"
      className="py-28 md:py-36 px-6"
      style={{ background: tokens.cream }}
    >
      <div className="max-w-7xl mx-auto">
        <motion.div {...fadeUp} className="text-center mb-16">
          <span
            className="text-[#C9A84C] text-[11px] tracking-[0.4em] uppercase font-light block mb-4"
          >
            Nuestros Espacios
          </span>
          <h2
            className="font-serif text-4xl md:text-5xl lg:text-6xl mb-4"
            style={{
              color: tokens.ink,
              fontFamily: "'Playfair Display', Georgia, serif",
              fontWeight: 400,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
            }}
          >
            El escenario perfecto
          </h2>
          <p
            className="text-base max-w-xl mx-auto leading-relaxed"
            style={{ color: tokens.stone, fontWeight: 300 }}
          >
            Salones versátiles adaptados a cada tipo de celebración.
          </p>
        </motion.div>

        <motion.div
          {...staggerContainer}
          className="grid grid-cols-2 md:grid-cols-4 grid-rows-3 gap-4 h-[500px] md:h-[600px]"
        >
          {spaces.map((space, i) => (
            <motion.div
              key={space.title}
              {...staggerItem}
              transition={{ delay: i * 0.08 }}
              className={`relative overflow-hidden group cursor-pointer ${
                space.span || 'md:col-span-1 md:row-span-1'
              }`}
              style={{ borderRadius: '12px' }}
            >
              <img
                src={space.src}
                alt={space.title}
                className="absolute inset-0 w-full h-full object-cover transition-all duration-700 group-hover:scale-105"
                loading="lazy"
              />
              <div
                className={`absolute inset-0 bg-gradient-to-t ${space.gradient}`}
              />
              {/* Gold accent line on hover */}
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C9A84C] scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
              <div className="absolute inset-0 flex flex-col justify-end p-6">
                <h3
                  className="font-serif text-lg text-white mb-1"
                  style={{
                    fontFamily: "'Playfair Display', Georgia, serif",
                    fontWeight: 400,
                  }}
                >
                  {space.title}
                </h3>
                <p className="text-white/70 text-sm font-light">
                  {space.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================
// Features — Editorial alternating layout (Stripe × Apple)
// ============================================================
function FeaturesSection() {
  const features = [
    {
      title: 'Menú Personalizado',
      desc: 'Diseña tu carta con más de 100 platos seleccionados por nuestros chefs. Cada celebración merece un menú a medida, creado exclusivamente para tu evento.',
      image:
        'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=85',
      label: 'Gastronomía',
    },
    {
      title: 'Espacios Únicos',
      desc: 'Salones versátiles que se adaptan a cada tipo de celebración. Desde bodas íntimas hasta grandes eventos corporativos, cada espacio tiene su propia personalidad.',
      image:
        'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1200&q=85',
      label: 'Instalaciones',
    },
    {
      title: 'Experiencia Premium',
      desc: 'Desde la primera llamada hasta el último baile, nos encargamos de todo. Tu único trabajo es disfrutar de cada momento.',
      image:
        'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=1200&q=85',
      label: 'Servicio',
    },
  ];

  return (
    <section id="servicios" className="py-28 md:py-36 px-6" style={{ background: tokens.white }}>
      <div className="max-w-7xl mx-auto">
        <motion.div {...fadeUp} className="text-center mb-20">
          <span
            className="text-[#C9A84C] text-[11px] tracking-[0.4em] uppercase font-light block mb-4"
          >
            Por qué Alboroto
          </span>
          <h2
            className="font-serif text-4xl md:text-5xl lg:text-6xl"
            style={{
              color: tokens.ink,
              fontFamily: "'Playfair Display', Georgia, serif",
              fontWeight: 400,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
            }}
          >
            Más que un salón
          </h2>
        </motion.div>

        <div className="space-y-28 md:space-y-36">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.8 }}
              className={`grid md:grid-cols-2 gap-10 md:gap-16 items-center ${
                i % 2 === 1 ? '' : ''
              }`}
            >
              <div
                className={`rounded-2xl overflow-hidden ${
                  i % 2 === 1 ? 'md:order-2' : ''
                }`}
                style={{
                  boxShadow: `0 8px 40px ${tokens.shadowBlue}, 0 2px 12px ${tokens.shadowBlack}`,
                }}
              >
                <img
                  src={f.image}
                  alt={f.title}
                  className="w-full h-72 md:h-96 object-cover transition-transform duration-700 hover:scale-105"
                  loading="lazy"
                />
              </div>

              <div className={i % 2 === 1 ? 'md:order-1' : ''}>
                <span
                  className="text-[#C9A84C] text-[11px] tracking-[0.35em] uppercase font-light block mb-3"
                >
                  {f.label}
                </span>
                <h3
                  className="font-serif text-3xl md:text-4xl mb-5"
                  style={{
                    color: tokens.ink,
                    fontFamily: "'Playfair Display', Georgia, serif",
                    fontWeight: 400,
                    lineHeight: 1.2,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {f.title}
                </h3>
                <p
                  className="text-base leading-relaxed"
                  style={{ color: tokens.stone, fontWeight: 300 }}
                >
                  {f.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Event Types — Minimal badges, Stripe-style cards
// ============================================================
function EventTypesSection() {
  const types = [
    { label: 'Bodas', desc: 'El día más importante', color: '#C9A84C' },
    { label: 'Cumpleaños', desc: 'Celebra tu día', color: '#8B8B8B' },
    { label: 'Corporativos', desc: 'Eventos de empresa', color: '#6B7B8B' },
    { label: 'Bautizos', desc: 'Momentos especiales', color: '#7B8B7B' },
    { label: 'Comuniones', desc: 'Celebraciones familiares', color: '#8B7B8B' },
    { label: 'Otros', desc: 'Personaliza tu evento', color: '#8B8B7B' },
  ];

  return (
    <section
      id="eventos"
      className="py-28 md:py-36 px-6"
      style={{ background: tokens.cream }}
    >
      <div className="max-w-6xl mx-auto">
        <motion.div {...fadeUp} className="text-center mb-16">
          <span className="text-[#C9A84C] text-[11px] tracking-[0.4em] uppercase font-light block mb-4">
            Tipos de Evento
          </span>
          <h2
            className="font-serif text-4xl md:text-5xl lg:text-6xl mb-4"
            style={{
              color: tokens.ink,
              fontFamily: "'Playfair Display', Georgia, serif",
              fontWeight: 400,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
            }}
          >
            Cada celebración es única
          </h2>
        </motion.div>

        <motion.div
          {...staggerContainer}
          className="grid grid-cols-2 sm:grid-cols-3 gap-5"
        >
          {types.map((et, i) => (
            <motion.div
              key={et.label}
              {...staggerItem}
              transition={{ delay: i * 0.06 }}
              className="rounded-2xl p-8 transition-all duration-500 group cursor-pointer"
              style={{
                background: tokens.white,
                border: `1px solid ${tokens.border}`,
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = `0 12px 40px ${tokens.shadowBlue}, 0 4px 12px ${tokens.shadowBlack}`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = '';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div
                className="w-12 h-12 rounded-xl mb-5 flex items-center justify-center text-white font-serif text-xl font-bold transition-all duration-300 group-hover:scale-110"
                style={{ backgroundColor: et.color }}
              >
                {et.label.charAt(0)}
              </div>
              <h3
                className="font-serif text-lg mb-1"
                style={{
                  color: tokens.ink,
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontWeight: 400,
                }}
              >
                {et.label}
              </h3>
              <p className="text-sm" style={{ color: tokens.stoneLight }}>
                {et.desc}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================
// Testimonials — Clean, editorial cards
// ============================================================
function TestimonialsSection() {
  const testimonials = [
    {
      text: 'Nuestra boda fue exactamente como la soñamos. El equipo de Alboroto se encargó de cada detalle.',
      author: 'María & Carlos',
      event: 'Boda — Junio 2025',
      initial: 'M',
    },
    {
      text: 'La comida es espectacular. Nuestros invitados aún hablan de los postres meses después.',
      author: 'Familia García',
      event: 'Comunión — Marzo 2025',
      initial: 'F',
    },
    {
      text: 'Organizamos nuestra cena de empresa aquí y fue un éxito total. Profesionalidad y calidad.',
      author: 'TechCorp Solutions',
      event: 'Evento Corporativo — Enero 2025',
      initial: 'T',
    },
  ];

  return (
    <section className="py-28 md:py-36 px-6" style={{ background: tokens.white }}>
      <div className="max-w-6xl mx-auto">
        <motion.div {...fadeUp} className="text-center mb-16">
          <span className="text-[#C9A84C] text-[11px] tracking-[0.4em] uppercase font-light block mb-4">
            Testimonios
          </span>
          <h2
            className="font-serif text-4xl md:text-5xl"
            style={{
              color: tokens.ink,
              fontFamily: "'Playfair Display', Georgia, serif",
              fontWeight: 400,
              letterSpacing: '-0.02em',
            }}
          >
            Lo que dicen nuestros clientes
          </h2>
        </motion.div>

        <motion.div
          {...staggerContainer}
          className="grid md:grid-cols-3 gap-6"
        >
          {testimonials.map((t, i) => (
            <motion.div
              key={t.author}
              {...staggerItem}
              transition={{ delay: i * 0.1 }}
              className="rounded-2xl p-8 transition-all duration-500"
              style={{
                background: tokens.cream,
                border: `1px solid ${tokens.border}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.boxShadow = `0 8px 30px ${tokens.shadowBlue}`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = '';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Stars */}
              <div className="flex gap-1 mb-5">
                {[...Array(5)].map((_, si) => (
                  <svg
                    key={si}
                    className="w-4 h-4"
                    fill="#C9A84C"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p
                className="text-sm leading-relaxed mb-6 italic"
                style={{ color: tokens.stone }}
              >
                &ldquo;{t.text}&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                  style={{
                    background:
                      'linear-gradient(135deg, #8B7332, #C9A84C)',
                  }}
                >
                  {t.initial}
                </div>
                <div>
                  <p
                    className="font-medium text-sm"
                    style={{ color: tokens.ink }}
                  >
                    {t.author}
                  </p>
                  <p className="text-xs" style={{ color: tokens.stoneLight }}>
                    {t.event}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================
// CTA — Apple-style dark immersive section
// ============================================================
function CTASection() {
  return (
    <section className="py-28 md:py-36 px-6 relative overflow-hidden">
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1920&q=85"
          alt=""
          className="w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.65) 50%, rgba(0,0,0,0.85) 100%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(201,168,76,0.08) 0%, transparent 70%)',
          }}
        />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto text-center">
        <motion.h2
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-white mb-6"
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 'clamp(2rem, 4.5vw, 3.5rem)',
            lineHeight: 1.15,
            fontWeight: 400,
            letterSpacing: '-0.02em',
          }}
        >
          Tu celebración,
          <br />
          <span
            className="italic"
            style={{ color: 'rgba(201,168,76,0.85)' }}
          >
            tu menú
          </span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-white/65 text-base md:text-lg mb-12 max-w-xl mx-auto leading-relaxed font-light"
        >
          Selecciona tus platos favoritos y envía tu propuesta.
          Nosotros nos encargamos del resto.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          <Link href="/configurador">
            <button
              className="px-12 py-4 text-sm font-medium tracking-wider transition-all duration-500"
              style={{
                background:
                  'linear-gradient(135deg, #C9A84C 0%, #D4B85C 100%)',
                color: '#1A1A1A',
                boxShadow: '0 4px 20px rgba(201,168,76,0.3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
                e.currentTarget.style.boxShadow = '0 8px 30px rgba(201,168,76,0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = '';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(201,168,76,0.3)';
              }}
            >
              Empezar a Diseñar
            </button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================
// Footer — Minimal, refined
// ============================================================
function Footer() {
  return (
    <footer className="py-16 px-6" style={{ background: tokens.ink, color: '#888' }}>
      <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-12">
        <div>
          <div
            className="font-serif text-lg mb-3 tracking-wide"
            style={{
              color: '#C9A84C',
              fontFamily: "'Playfair Display', Georgia, serif",
            }}
          >
            Alboroto Eventos
          </div>
          <p className="text-sm leading-relaxed font-light text-stone-500">
            Salón de Celebraciones Premium en Sevilla.
          </p>
        </div>
        <div>
          <h4 className="text-white font-medium mb-4 text-sm tracking-wide">
            Contacto
          </h4>
          <div className="space-y-3 text-sm font-light text-stone-500">
            <div className="flex items-center gap-2">
              <span style={{ color: '#C9A84C' }}>→</span>
              <span>info@byalboroto.com</span>
            </div>
            <div className="flex items-center gap-2">
              <span style={{ color: '#C9A84C' }}>→</span>
              <span>+34 954 000 000</span>
            </div>
            <div className="flex items-center gap-2">
              <span style={{ color: '#C9A84C' }}>→</span>
              <span>Sevilla, España</span>
            </div>
          </div>
        </div>
        <div>
          <h4 className="text-white font-medium mb-4 text-sm tracking-wide">
            Enlaces
          </h4>
          <div className="space-y-3 text-sm font-light">
            <Link
              href="/configurador"
              className="block hover:text-[#C9A84C] transition-colors text-stone-500"
            >
              Configurador
            </Link>
            <Link
              href="/admin/login"
              className="block hover:text-[#C9A84C] transition-colors text-stone-500"
            >
              Panel Admin
            </Link>
          </div>
        </div>
      </div>
      <div
        className="max-w-6xl mx-auto mt-12 pt-8 text-center text-xs font-light"
        style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          color: '#666',
        }}
      >
        © 2025 Alboroto Eventos. Todos los derechos reservados.
      </div>
    </footer>
  );
}

// ============================================================
// Main Page
// ============================================================
export default function HomePage() {
  return (
    <main
      className="overflow-x-hidden"
      style={{
        background: tokens.white,
        color: tokens.ink,
      }}
    >
      <Navbar />
      <HeroSection />
      <StatsSection />
      <SpacesSection />
      <FeaturesSection />
      <EventTypesSection />
      <TestimonialsSection />
      <CTASection />
      <Footer />
    </main>
  );
}
