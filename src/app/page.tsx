'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';

/* ============================================================
   J.Benitez — Landing Page
   Design: Stripe precision × Apple cinematic rhythm
   Brand: Celebraciones premium en Sevilla
   ============================================================ */

export default function HomePage() {
  const [scrollY, setScrollY] = useState(0);
  const [navSolid, setNavSolid] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setRevealed((prev) => new Set(prev).add(entry.target.id));
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -60px 0px' }
    );
    document.querySelectorAll('[data-reveal]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const reveal = (id: string) => revealed.has(id);

  return (
    <div className="min-h-screen bg-[#FBF8F1] text-[#1A1A1A]">
      {/* ============================================================
          NAVIGATION — Apple glass + Stripe precision
          ============================================================ */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ${
          navSolid
            ? 'bg-[#1A1A1A]/95 backdrop-blur-xl border-b border-[#C9A84C]/20'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="flex items-center justify-between h-20 md:h-24">
            {/* Brand */}
            <Link href="/" className="flex items-center gap-3 group">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center transition-all duration-700 bg-white/15 backdrop-blur-md"
                style={{
                  border: '1px solid rgba(201,168,76,0.4)',
                }}
              >
                <span
                  className="font-serif text-xl font-bold transition-colors duration-700 text-white"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                >
                  J
                </span>
              </div>
              <span
                className="font-serif text-xl tracking-wide transition-all duration-700 text-white"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
              >
                J.Benitez
              </span>
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-12">
              {['Espacios', 'Servicios', 'Eventos', 'Testimonios'].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  className="text-sm tracking-[0.02em] font-medium transition-all duration-300 relative after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 after:bg-[#C9A84C] after:transition-all after:duration-300 hover:after:w-full text-white/80 hover:text-white"
                >
                  {item}
                </a>
              ))}
              <Link href="/configurador">
                <button className="px-7 py-3 text-sm font-medium tracking-wide transition-all duration-500 bg-white/10 backdrop-blur-md text-white border border-white/30 hover:bg-white/20">
                  Diseña tu Evento
                </button>
              </Link>
            </div>

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menu"
            >
              <div className="w-6 h-5 flex flex-col justify-between text-white">
                <span
                  className="w-full h-0.5 bg-current transition-all duration-300"
                  style={{ transform: menuOpen ? 'rotate(45deg) translate(3px, 3px)' : 'none' }}
                />
                <span
                  className="w-full h-0.5 bg-current transition-all duration-300"
                  style={{ opacity: menuOpen ? 0 : 1 }}
                />
                <span
                  className="w-full h-0.5 bg-current transition-all duration-300"
                  style={{ transform: menuOpen ? 'rotate(-45deg) translate(3px, -3px)' : 'none' }}
                />
              </div>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <div
          className="md:hidden overflow-hidden bg-[#FBF8F1]/95 backdrop-blur-2xl border-t border-stone-100 transition-all duration-500"
          style={{
            maxHeight: menuOpen ? '400px' : '0px',
            opacity: menuOpen ? 1 : 0,
          }}
        >
          <div className="px-6 py-8 space-y-6">
            {['Espacios', 'Servicios', 'Eventos', 'Testimonios'].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="block text-lg font-serif text-[#1A1A1A] hover:text-[#C9A84C] transition-colors"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                onClick={() => setMenuOpen(false)}
              >
                {item}
              </a>
            ))}
            <Link href="/configurador">
              <button className="w-full py-4 bg-[#1A1A1A] text-white text-sm font-medium tracking-wide">
                Diseña tu Evento
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ============================================================
          HERO — Apple cinematic + video background
          ============================================================ */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Video background */}
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
          <div
            className="absolute inset-0 opacity-20"
            style={{
              background: 'radial-gradient(ellipse at center, transparent 50%, rgba(201,168,76,0.15) 100%)',
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 text-center px-6 max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-4 mb-8" style={{ opacity: scrollY < 100 ? 1 : 0, transform: `translateY(${scrollY < 100 ? 15 : 0}px)` }}>
            <div className="h-px w-10 bg-[#C9A84C]/50" />
            <span className="text-[#C9A84C] text-[11px] tracking-[0.4em] uppercase font-light">Salon de Celebraciones Premium</span>
            <div className="h-px w-10 bg-[#C9A84C]/50" />
          </div>

          <h1
            className="text-white mb-6"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
              lineHeight: 1.08,
              fontWeight: 400,
              letterSpacing: '-0.02em',
              opacity: scrollY < 150 ? 1 : 0,
              transform: `translateY(${scrollY < 150 ? 0 : 25}px)`,
            }}
          >
            Donde cada celebracion
            <br />
            <span className="italic" style={{ color: 'rgba(201,168,76,0.85)' }}>se convierte en recuerdo</span>
          </h1>

          <p
            className="text-white/65 text-base md:text-lg max-w-2xl mx-auto mb-12 leading-relaxed font-light tracking-wide"
            style={{
              fontWeight: 300,
              opacity: scrollY < 200 ? 1 : 0,
              transform: `translateY(${scrollY < 200 ? 0 : 20}px)`,
            }}
          >
            Configura tu evento perfecto con nuestro disenador interactivo. Mas de 100 platos, espacios
            unicos y una experiencia inolvidable.
          </p>

          <div
            className="flex flex-col sm:flex-row gap-5 justify-center items-center"
            style={{
              opacity: scrollY < 250 ? 1 : 0,
              transform: `translateY(${scrollY < 250 ? 0 : 20}px)`,
            }}
          >
            <Link href="/configurador">
              <button className="group px-10 py-4 text-sm font-medium tracking-wider transition-all duration-500 flex items-center gap-2">
                Diseña tu Evento
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
            </Link>
            <a href="#espacios">
              <button className="px-10 py-4 text-sm font-medium tracking-wider transition-all duration-500">
                Ver Espacios
              </button>
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2" style={{ opacity: scrollY < 300 ? 1 : 0 }}>
          <div className="w-6 h-10 rounded-full flex justify-center border border-white/20">
            <div className="w-1.5 h-3 rounded-full mt-2" style={{ background: 'rgba(255,255,255,0.4)' }} />
          </div>
        </div>
      </section>

      {/* ============================================================
          STATS BAR — Stripe-style precision
          ============================================================ */}
      <section className="-mt-16 z-20 px-6 relative">
        <div className="max-w-6xl mx-auto">
          <div
            id="stats"
            data-reveal
            className="rounded-2xl p-8 md:p-10 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12"
            style={{
              background: '#FFFFFF',
              boxShadow: '0 4px 40px rgba(80,60,40,0.08), 0 2px 12px rgba(0,0,0,0.04)',
              border: '1px solid rgba(0,0,0,0.06)',
              opacity: reveal('stats') ? 1 : 0,
              transform: reveal('stats') ? 'translateY(0)' : 'translateY(20px)',
              transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {[
              { value: '100+', label: 'Platos disponibles' },
              { value: '300', label: 'Comensales maximos' },
              { value: '500+', label: 'Eventos realizados' },
              { value: '98%', label: 'Satisfaccion clientes' },
            ].map((stat, i) => (
              <div
                key={i}
                className="text-center"
                style={{
                  opacity: reveal('stats') ? 1 : 0,
                  transform: reveal('stats') ? 'translateY(0)' : 'translateY(15px)',
                  transition: `all 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.1}s`,
                }}
              >
                <div
                  className="font-serif text-3xl md:text-4xl mb-1"
                  style={{ color: '#1A1A1A', fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 400, letterSpacing: '-0.02em' }}
                >
                  {stat.value}
                </div>
                <div className="text-xs tracking-[0.15em] uppercase" style={{ color: '#6B6B6B', fontWeight: 400 }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          ESPACIOS — Apple editorial layout
          ============================================================ */}
      <section id="espacios" className="py-28 md:py-36 px-6" style={{ background: '#FAF8F5' }}>
        <div className="max-w-7xl mx-auto">
          <div
            id="espacios-header"
            data-reveal
            className="text-center mb-16"
            style={{
              opacity: reveal('espacios-header') ? 1 : 0,
              transform: reveal('espacios-header') ? 'translateY(0)' : 'translateY(30px)',
              transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <span className="text-[#C9A84C] text-[11px] tracking-[0.4em] uppercase font-light block mb-4">
              Nuestros Espacios
            </span>
            <h2 style={{ color: '#1A1A1A', fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              El escenario perfecto
            </h2>
            <p className="text-base max-w-xl mx-auto leading-relaxed" style={{ color: '#6B6B6B', fontWeight: 300 }}>
              Salones versatiles adaptados a cada tipo de celebracion.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 grid-rows-3 gap-4 h-[500px] md:h-[600px]">
            {[
              { img: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1200&q=85', title: 'Salon Principal', sub: 'Hasta 300 comensales', span: 'md:col-span-2 md:row-span-2' },
              { img: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800&q=85', title: 'Terraza', sub: 'Vistas al jardin', span: '' },
              { img: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=85', title: 'Sala VIP', sub: 'Eventos exclusivos', span: '' },
              { img: 'https://images.unsplash.com/photo-1478146059778-26028b07395a?w=800&q=85', title: 'Jardin', sub: 'Ceremonias al aire libre', span: '' },
              { img: 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=800&q=85', title: 'Sala Intima', sub: 'Celebraciones pequenas', span: '' },
            ].map((space, i) => (
              <div
                key={i}
                id={`space-${i}`}
                data-reveal
                className={`relative overflow-hidden group cursor-pointer ${space.span}`}
                style={{
                  borderRadius: '12px',
                  opacity: reveal(`space-${i}`) ? 1 : 0,
                  transform: reveal(`space-${i}`) ? 'translateY(0)' : 'translateY(20px)',
                  transition: `all 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.1}s`,
                }}
              >
                <img
                  src={space.img}
                  alt={space.title}
                  className="absolute inset-0 w-full h-full object-cover transition-all duration-700 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C9A84C] scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
                <div className="absolute inset-0 flex flex-col justify-end p-6">
                  <h3
                    className="font-serif text-lg text-white mb-1"
                    style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 400 }}
                  >
                    {space.title}
                  </h3>
                  <p className="text-white/70 text-sm font-light">{space.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          SERVICIOS — Apple alternating editorial
          ============================================================ */}
      <section id="servicios" className="py-28 md:py-36 px-6" style={{ background: '#FFFFFF' }}>
        <div className="max-w-7xl mx-auto">
          <div
            id="servicios-header"
            data-reveal
            className="text-center mb-20"
            style={{
              opacity: reveal('servicios-header') ? 1 : 0,
              transform: reveal('servicios-header') ? 'translateY(0)' : 'translateY(30px)',
              transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <span className="text-[#C9A84C] text-[11px] tracking-[0.4em] uppercase font-light block mb-4">
              Por que J.Benitez
            </span>
            <h2 style={{ color: '#1A1A1A', fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              Mas que un salon
            </h2>
          </div>

          <div className="space-y-28 md:space-y-36">
            {[
              { img: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=85', kicker: 'Gastronomia', title: 'Menu Personalizado', desc: 'Disena tu carta con mas de 100 platos seleccionados por nuestros chefs. Cada celebracion merece un menu a medida, creado exclusivamente para tu evento.' },
              { img: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1200&q=85', kicker: 'Instalaciones', title: 'Espacios Unicos', desc: 'Salones versatiles que se adaptan a cada tipo de celebracion. Desde bodas intimas hasta grandes eventos corporativos, cada espacio tiene su propia personalidad.' },
              { img: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=1200&q=85', kicker: 'Servicio', title: 'Experiencia Premium', desc: 'Desde la primera llamada hasta el ultimo baile, nos encargamos de todo. Tu unico trabajo es disfrutar de cada momento.' },
            ].map((svc, i) => (
              <div
                key={i}
                id={`serv-${i}`}
                data-reveal
                className="grid md:grid-cols-2 gap-10 md:gap-16 items-center"
                style={{
                  opacity: reveal(`serv-${i}`) ? 1 : 0,
                  transform: reveal(`serv-${i}`) ? 'translateY(0)' : 'translateY(50px)',
                  transition: `all 0.8s cubic-bezier(0.16, 1, 0.3, 1)`,
                }}
              >
                <div className={`rounded-2xl overflow-hidden ${i % 2 === 1 ? 'md:order-2' : ''}`} style={{ boxShadow: '0 8px 40px rgba(80,60,40,0.08), 0 2px 12px rgba(0,0,0,0.04)' }}>
                  <img src={svc.img} alt={svc.title} className="w-full h-72 md:h-96 object-cover transition-transform duration-700 hover:scale-105" loading="lazy" />
                </div>
                <div className={i % 2 === 1 ? 'md:order-1' : ''}>
                  <span className="text-[#C9A84C] text-[11px] tracking-[0.35em] uppercase font-light block mb-3">{svc.kicker}</span>
                  <h3
                    className="text-3xl md:text-4xl mb-5"
                    style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 400, lineHeight: 1.2, letterSpacing: '-0.01em' }}
                  >
                    {svc.title}
                  </h3>
                  <p className="text-base leading-relaxed" style={{ color: '#6B6B6B', fontWeight: 300 }}>
                    {svc.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          EVENTOS — Stripe card grid
          ============================================================ */}
      <section id="eventos" className="py-28 md:py-36 px-6" style={{ background: '#FAF8F5' }}>
        <div className="max-w-6xl mx-auto">
          <div
            id="eventos-header"
            data-reveal
            className="text-center mb-16"
            style={{
              opacity: reveal('eventos-header') ? 1 : 0,
              transform: reveal('eventos-header') ? 'translateY(0)' : 'translateY(30px)',
              transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <span className="text-[#C9A84C] text-[11px] tracking-[0.4em] uppercase font-light block mb-4">
              Tipos de Evento
            </span>
            <h2 style={{ color: '#1A1A1A', fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              Cada celebracion es unica
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
            {[
              { letter: 'B', color: '#C9A84C', name: 'Bodas', sub: 'El dia mas importante' },
              { letter: 'C', color: '#8B8B8B', name: 'Cumpleanos', sub: 'Celebra tu dia' },
              { letter: 'E', color: '#6B7B8B', name: 'Corporativos', sub: 'Eventos de empresa' },
              { letter: 'B', color: '#7B8B7B', name: 'Bautizos', sub: 'Momentos especiales' },
              { letter: 'C', color: '#8B7B8B', name: 'Comuniones', sub: 'Celebraciones familiares' },
              { letter: 'O', color: '#8B8B7B', name: 'Otros', sub: 'Personaliza tu evento' },
            ].map((evt, i) => (
              <div
                key={i}
                id={`evt-${i}`}
                data-reveal
                className="rounded-2xl p-8 transition-all duration-500 group cursor-pointer"
                style={{
                  background: '#FFFFFF',
                  border: '1px solid rgba(0,0,0,0.06)',
                  opacity: reveal(`evt-${i}`) ? 1 : 0,
                  transform: reveal(`evt-${i}`) ? 'translateY(0)' : 'translateY(20px)',
                  transition: `all 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.08}s`,
                }}
              >
                <div
                  className="w-12 h-12 rounded-xl mb-5 flex items-center justify-center text-white font-serif text-xl font-bold transition-all duration-300 group-hover:scale-110"
                  style={{ backgroundColor: evt.color, fontFamily: "'Playfair Display', Georgia, serif" }}
                >
                  {evt.letter}
                </div>
                <h3
                  className="text-lg mb-1"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 400 }}
                >
                  {evt.name}
                </h3>
                <p className="text-sm" style={{ color: '#A3A3A3' }}>{evt.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          TESTIMONIOS — Apple editorial
          ============================================================ */}
      <section id="testimonios" className="py-28 md:py-36 px-6" style={{ background: '#FFFFFF' }}>
        <div className="max-w-6xl mx-auto">
          <div
            id="test-header"
            data-reveal
            className="text-center mb-16"
            style={{
              opacity: reveal('test-header') ? 1 : 0,
              transform: reveal('test-header') ? 'translateY(0)' : 'translateY(30px)',
              transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <span className="text-[#C9A84C] text-[11px] tracking-[0.4em] uppercase font-light block mb-4">
              Testimonios
            </span>
            <h2 style={{ color: '#1A1A1A', fontWeight: 400, letterSpacing: '-0.02em' }}>
              Lo que dicen nuestros clientes
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: 'Maria & Carlos', type: 'Boda — Junio 2025', quote: 'Nuestra boda fue exactamente como la sonamos. El equipo de J.Benitez se encargo de cada detalle.' },
              { name: 'Familia Garcia', type: 'Comunion — Marzo 2025', quote: 'La comida es espectacular. Nuestros invitados aun hablan de los postres meses despues.' },
              { name: 'TechCorp Solutions', type: 'Evento Corporativo — Enero 2025', quote: 'Organizamos nuestra cena de empresa aqui y fue un exito total. Profesionalidad y calidad.' },
            ].map((t, i) => (
              <div
                key={i}
                id={`test-${i}`}
                data-reveal
                className="rounded-2xl p-8 transition-all duration-500"
                style={{
                  background: '#FAF8F5',
                  border: '1px solid rgba(0,0,0,0.06)',
                  opacity: reveal(`test-${i}`) ? 1 : 0,
                  transform: reveal(`test-${i}`) ? 'translateY(0)' : 'translateY(20px)',
                  transition: `all 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.1}s`,
                }}
              >
                <div className="flex gap-1 mb-5">
                  {[...Array(5)].map((_, s) => (
                    <svg key={s} className="w-4 h-4" fill="#C9A84C" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-sm leading-relaxed mb-6 italic" style={{ color: '#6B6B6B' }}>
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #8B7332, #C9A84C)' }}
                  >
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="font-medium text-sm" style={{ color: '#1A1A1A' }}>{t.name}</p>
                    <p className="text-xs" style={{ color: '#A3A3A3' }}>{t.type}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          CTA FINAL — Apple dark immersive
          ============================================================ */}
      <section className="py-28 md:py-36 px-6 relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1920&q=85"
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.65) 50%, rgba(0,0,0,0.85) 100%)' }} />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, rgba(201,168,76,0.08) 0%, transparent 70%)' }} />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h2
            className="text-white mb-6"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 'clamp(2rem, 4.5vw, 3.5rem)',
              lineHeight: 1.15,
              fontWeight: 400,
              letterSpacing: '-0.02em',
            }}
          >
            Tu celebracion,
            <br />
            <span className="italic" style={{ color: 'rgba(201,168,76,0.85)' }}>tu menu</span>
          </h2>
          <p className="text-white/65 text-base md:text-lg mb-12 max-w-xl mx-auto leading-relaxed font-light">
            Selecciona tus platos favoritos y envia tu propuesta. Nosotros nos encargamos del resto.
          </p>
          <Link href="/configurador">
            <button className="px-12 py-4 text-sm font-medium tracking-wider transition-all duration-500">
              Empezar a Disenar
            </button>
          </Link>
        </div>
      </section>

      {/* ============================================================
          FOOTER — Stripe precision
          ============================================================ */}
      <footer className="py-16 px-6" style={{ background: '#1A1A1A', color: '#888' }}>
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-12">
          <div>
            <div className="font-serif text-lg mb-3 tracking-wide" style={{ color: '#C9A84C', fontFamily: "'Playfair Display', Georgia, serif" }}>
              J.Benitez
            </div>
            <p className="text-sm leading-relaxed font-light text-stone-500">
              Salon de Celebraciones Premium en Sevilla.
            </p>
          </div>
          <div>
            <h4 className="text-white font-medium mb-4 text-sm tracking-wide">Contacto</h4>
            <div className="space-y-3 text-sm font-light text-stone-500">
              <div className="flex items-center gap-2"><span style={{ color: '#C9A84C' }}>{'\u2192'}</span><span>info@jbenitez.com</span></div>
              <div className="flex items-center gap-2"><span style={{ color: '#C9A84C' }}>{'\u2192'}</span><span>+34 954 000 000</span></div>
              <div className="flex items-center gap-2"><span style={{ color: '#C9A84C' }}>{'\u2192'}</span><span>Sevilla, Espana</span></div>
            </div>
          </div>
          <div>
            <h4 className="text-white font-medium mb-4 text-sm tracking-wide">Enlaces</h4>
            <div className="space-y-3 text-sm font-light">
              <a className="block hover:text-[#C9A84C] transition-colors text-stone-500" href="/configurador">Configurador</a>
              <a className="block hover:text-[#C9A84C] transition-colors text-stone-500" href="/admin/login">Panel Admin</a>
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-12 pt-8 text-center text-xs font-light" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', color: '#666' }}>
          {'\u00A9'} 2025 J.Benitez. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
}
