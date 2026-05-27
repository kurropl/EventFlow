'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';

/* ============================================================
   J.Benitez — Landing Page Rediseñada
   - Sin video roto: fondo crema cálido con overlay elegante
   - Paleta coherente: cream (#F8F3E6) / gold (#C9A84C) / ink (#1A1A1A)
   - Diseño premium, sin colores mezclados
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

  const navBg = navSolid ? 'bg-[#F8F3E6]/98 backdrop-blur-xl border-b border-[#C9A84C]/20' : 'bg-transparent';
  const navTextColor = navSolid ? 'text-[#1A1A1A]' : 'text-white';

  return (
    <div className="min-h-screen bg-[#F8F3E6] text-[#1A1A1A]">
      {/* ============================================================
          NAVIGATION
          ============================================================ */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${navBg}`}>
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="flex items-center justify-between h-20">
            <Link href="/" className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500"
                style={{
                  background: navSolid ? 'transparent' : 'rgba(255,255,255,0.12)',
                  border: '1.5px solid rgba(201,168,76,0.5)',
                }}
              >
                <span
                  className="font-serif text-lg font-bold"
                  style={{
                    fontFamily: "'Playfair Display', Georgia, serif",
                    color: navSolid ? '#C9A84C' : '#C9A84C',
                  }}
                >
                  J
                </span>
              </div>
              <span
                className="font-serif text-lg tracking-wide"
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  color: navSolid ? '#1A1A1A' : '#FFFFFF',
                }}
              >
                J.Benitez
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-10">
              {['Espacios', 'Servicios', 'Eventos', 'Testimonios'].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  className={`text-sm tracking-wide font-medium transition-colors duration-300 ${
                    navSolid ? 'text-stone-600 hover:text-[#C9A84C]' : 'text-white/80 hover:text-white'
                  }`}
                >
                  {item}
                </a>
              ))}
              <Link href="/configurador">
                <button
                  className="px-6 py-2.5 text-sm font-medium tracking-wide transition-all duration-300"
                  style={{
                    background: navSolid ? '#1A1A1A' : 'rgba(201,168,76,0.9)',
                    color: '#FFFFFF',
                    borderRadius: '8px',
                  }}
                >
                  Disena tu Evento
                </button>
              </Link>
            </div>

            <button
              className="md:hidden p-2"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menu"
            >
              <div className="w-6 h-5 flex flex-col justify-between" style={{ color: navSolid ? '#1A1A1A' : '#FFFFFF' }}>
                <span className="w-full h-0.5 bg-current transition-all duration-300" style={{ transform: menuOpen ? 'rotate(45deg) translate(3px, 3px)' : 'none' }} />
                <span className="w-full h-0.5 bg-current transition-all duration-300" style={{ opacity: menuOpen ? 0 : 1 }} />
                <span className="w-full h-0.5 bg-current transition-all duration-300" style={{ transform: menuOpen ? 'rotate(-45deg) translate(3px, -3px)' : 'none' }} />
              </div>
            </button>
          </div>
        </div>

        <div
          className="md:hidden overflow-hidden bg-[#F8F3E6] border-t border-stone-200 transition-all duration-400"
          style={{ maxHeight: menuOpen ? '400px' : '0px', opacity: menuOpen ? 1 : 0 }}
        >
          <div className="px-6 py-6 space-y-5">
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
              <button className="w-full py-3 bg-[#1A1A1A] text-white text-sm font-medium tracking-wide rounded-xl">
                Disena tu Evento
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ============================================================
          HERO — Fondo crema con overlay dorado elegante, sin video
          ============================================================ */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Decorative background */}
        <div className="absolute inset-0 z-0" style={{
          background: 'radial-gradient(ellipse at 30% 20%, rgba(201,168,76,0.12) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(201,168,76,0.08) 0%, transparent 50%), linear-gradient(180deg, #F8F3E6 0%, #F0E9D8 50%, #E8DFC8 100%)',
        }} />

        {/* Subtle pattern */}
        <div className="absolute inset-0 z-0 opacity-[0.03]" style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23C9A84C\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
        }} />

        {/* Content */}
        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
          <div
            className="inline-flex items-center gap-3 mb-8"
            style={{
              opacity: scrollY < 100 ? 1 : 0.7,
              transform: `translateY(${scrollY < 100 ? 0 : 10}px)`,
            }}
          >
            <div className="h-px w-8 bg-[#C9A84C]" />
            <span className="text-[#C9A84C] text-[11px] tracking-[0.35em] uppercase font-light">Salon de Celebraciones Premium</span>
            <div className="h-px w-8 bg-[#C9A84C]" />
          </div>

          <h1
            className="mb-6"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 'clamp(2.2rem, 5.5vw, 4rem)',
              lineHeight: 1.12,
              fontWeight: 400,
              letterSpacing: '-0.02em',
              color: '#1A1A1A',
              opacity: scrollY < 150 ? 1 : 0.85,
              transform: `translateY(${scrollY < 150 ? 0 : 20}px)`,
            }}
          >
            Donde cada celebracion
            <br />
            <span className="italic" style={{ color: '#C9A84C' }}>se convierte en recuerdo</span>
          </h1>

          <p
            className="text-base md:text-lg max-w-xl mx-auto mb-10 leading-relaxed font-light tracking-wide"
            style={{
              color: '#6B6B6B',
              fontWeight: 300,
              opacity: scrollY < 200 ? 1 : 0.7,
              transform: `translateY(${scrollY < 200 ? 0 : 15}px)`,
            }}
          >
            Configura tu evento perfecto con nuestro disenador interactivo. Mas de 100 platos, espacios
            unicos y una experiencia inolvidable.
          </p>

          <div
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            style={{
              opacity: scrollY < 250 ? 1 : 0.7,
              transform: `translateY(${scrollY < 250 ? 0 : 15}px)`,
            }}
          >
            <Link href="/configurador">
              <button
                className="group px-10 py-4 text-sm font-medium tracking-wider transition-all duration-300 flex items-center gap-2"
                style={{
                  background: '#1A1A1A',
                  color: '#FFFFFF',
                  borderRadius: '10px',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#C9A84C'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#1A1A1A'; }}
              >
                Disena tu Evento
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
            </Link>
            <a href="#espacios">
              <button
                className="px-10 py-4 text-sm font-medium tracking-wider transition-all duration-300"
                style={{
                  background: 'transparent',
                  color: '#1A1A1A',
                  border: '1.5px solid rgba(26,26,26,0.25)',
                  borderRadius: '10px',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#C9A84C'; e.currentTarget.style.color = '#C9A84C'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(26,26,26,0.25)'; e.currentTarget.style.color = '#1A1A1A'; }}
              >
                Ver Espacios
              </button>
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2" style={{ opacity: scrollY < 300 ? 1 : 0 }}>
          <div className="w-5 h-9 rounded-full flex justify-center border border-[#C9A84C]/40">
            <div className="w-1 h-2.5 rounded-full mt-2 bg-[#C9A84C]/60 animate-bounce" />
          </div>
        </div>
      </section>

      {/* ============================================================
          STATS BAR
          ============================================================ */}
      <section className="-mt-14 z-20 px-6 relative">
        <div className="max-w-5xl mx-auto">
          <div
            id="stats"
            data-reveal
            className="rounded-2xl p-8 md:p-10 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12"
            style={{
              background: '#FFFFFF',
              boxShadow: '0 4px 30px rgba(0,0,0,0.06)',
              border: '1px solid rgba(0,0,0,0.04)',
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
              <div key={i} className="text-center">
                <div className="font-serif text-3xl md:text-4xl mb-1" style={{ color: '#1A1A1A', fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 400 }}>
                  {stat.value}
                </div>
                <div className="text-xs tracking-[0.15em] uppercase" style={{ color: '#999', fontWeight: 400 }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          ESPACIOS
          ============================================================ */}
      <section id="espacios" className="py-24 md:py-32 px-6" style={{ background: '#F8F3E6' }}>
        <div className="max-w-7xl mx-auto">
          <div
            id="espacios-header"
            data-reveal
            className="text-center mb-14"
            style={{
              opacity: reveal('espacios-header') ? 1 : 0,
              transform: reveal('espacios-header') ? 'translateY(0)' : 'translateY(30px)',
              transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <span className="text-[#C9A84C] text-[11px] tracking-[0.4em] uppercase font-light block mb-4">
              Nuestros Espacios
            </span>
            <h2 style={{ color: '#1A1A1A', fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.1, fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)' }}>
              El escenario perfecto
            </h2>
            <p className="text-base max-w-xl mx-auto leading-relaxed mt-3" style={{ color: '#888', fontWeight: 300 }}>
              Salones versatiles adaptados a cada tipo de celebracion.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 grid-rows-3 gap-3 h-[480px] md:h-[550px]">
            {[
              { img: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1200&q=80', title: 'Salon Principal', sub: 'Hasta 300 comensales', span: 'md:col-span-2 md:row-span-2' },
              { img: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800&q=80', title: 'Terraza', sub: 'Vistas al jardin', span: '' },
              { img: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80', title: 'Sala VIP', sub: 'Eventos exclusivos', span: '' },
              { img: 'https://images.unsplash.com/photo-1478146059778-26028b07395a?w=800&q=80', title: 'Jardin', sub: 'Ceremonias al aire libre', span: '' },
              { img: 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=800&q=80', title: 'Sala Intima', sub: 'Celebraciones pequenas', span: '' },
            ].map((space, i) => (
              <div
                key={i}
                id={`space-${i}`}
                data-reveal
                className={`relative overflow-hidden group cursor-pointer rounded-xl ${space.span}`}
                style={{
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
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C9A84C] scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
                <div className="absolute inset-0 flex flex-col justify-end p-5">
                  <h3 className="font-serif text-base text-white" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 400 }}>
                    {space.title}
                  </h3>
                  <p className="text-white/70 text-xs font-light">{space.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          SERVICIOS
          ============================================================ */}
      <section id="servicios" className="py-24 md:py-32 px-6" style={{ background: '#FFFFFF' }}>
        <div className="max-w-6xl mx-auto">
          <div
            id="servicios-header"
            data-reveal
            className="text-center mb-18"
            style={{
              opacity: reveal('servicios-header') ? 1 : 0,
              transform: reveal('servicios-header') ? 'translateY(0)' : 'translateY(30px)',
              transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <span className="text-[#C9A84C] text-[11px] tracking-[0.4em] uppercase font-light block mb-4">
              Por que J.Benitez
            </span>
            <h2 style={{ color: '#1A1A1A', fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.1, fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)' }}>
              Mas que un salon
            </h2>
          </div>

          <div className="space-y-24 md:space-y-32">
            {[
              { img: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80', kicker: 'Gastronomia', title: 'Menu Personalizado', desc: 'Disena tu carta con mas de 100 platos seleccionados por nuestros chefs. Cada celebracion merece un menu a medida, creado exclusivamente para tu evento.' },
              { img: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1200&q=80', kicker: 'Instalaciones', title: 'Espacios Unicos', desc: 'Salones versatiles que se adaptan a cada tipo de celebracion. Desde bodas intimas hasta grandes eventos corporativos, cada espacio tiene su propia personalidad.' },
              { img: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=1200&q=80', kicker: 'Servicio', title: 'Experiencia Premium', desc: 'Desde la primera llamada hasta el ultimo baile, nos encargamos de todo. Tu unico trabajo es disfrutar de cada momento.' },
            ].map((svc, i) => (
              <div
                key={i}
                id={`serv-${i}`}
                data-reveal
                className="grid md:grid-cols-2 gap-10 md:gap-14 items-center"
                style={{
                  opacity: reveal(`serv-${i}`) ? 1 : 0,
                  transform: reveal(`serv-${i}`) ? 'translateY(0)' : 'translateY(50px)',
                  transition: `all 0.8s cubic-bezier(0.16, 1, 0.3, 1)`,
                }}
              >
                <div className={`rounded-2xl overflow-hidden ${i % 2 === 1 ? 'md:order-2' : ''}`} style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.06)' }}>
                  <img src={svc.img} alt={svc.title} className="w-full h-64 md:h-80 object-cover transition-transform duration-700 hover:scale-105" loading="lazy" />
                </div>
                <div className={i % 2 === 1 ? 'md:order-1' : ''}>
                  <span className="text-[#C9A84C] text-[11px] tracking-[0.35em] uppercase font-light block mb-3">{svc.kicker}</span>
                  <h3 className="text-2xl md:text-3xl mb-4" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 400, lineHeight: 1.2, letterSpacing: '-0.01em', color: '#1A1A1A' }}>
                    {svc.title}
                  </h3>
                  <p className="text-sm md:text-base leading-relaxed" style={{ color: '#888', fontWeight: 300 }}>
                    {svc.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          EVENTOS
          ============================================================ */}
      <section id="eventos" className="py-24 md:py-32 px-6" style={{ background: '#F8F3E6' }}>
        <div className="max-w-5xl mx-auto">
          <div
            id="eventos-header"
            data-reveal
            className="text-center mb-14"
            style={{
              opacity: reveal('eventos-header') ? 1 : 0,
              transform: reveal('eventos-header') ? 'translateY(0)' : 'translateY(30px)',
              transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <span className="text-[#C9A84C] text-[11px] tracking-[0.4em] uppercase font-light block mb-4">
              Tipos de Evento
            </span>
            <h2 style={{ color: '#1A1A1A', fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.1, fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)' }}>
              Cada celebracion es unica
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { letter: 'B', name: 'Bodas', sub: 'El dia mas importante' },
              { letter: 'C', name: 'Cumpleanos', sub: 'Celebra tu dia' },
              { letter: 'E', name: 'Corporativos', sub: 'Eventos de empresa' },
              { letter: 'B', name: 'Bautizos', sub: 'Momentos especiales' },
              { letter: 'C', name: 'Comuniones', sub: 'Celebraciones familiares' },
              { letter: 'O', name: 'Otros', sub: 'Personaliza tu evento' },
            ].map((evt, i) => (
              <div
                key={i}
                id={`evt-${i}`}
                data-reveal
                className="rounded-xl p-6 transition-all duration-400 group cursor-pointer border"
                style={{
                  background: '#FFFFFF',
                  borderColor: 'rgba(0,0,0,0.06)',
                  opacity: reveal(`evt-${i}`) ? 1 : 0,
                  transform: reveal(`evt-${i}`) ? 'translateY(0)' : 'translateY(20px)',
                  transition: `all 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.08}s`,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#C9A84C'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(201,168,76,0.12)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div
                  className="w-11 h-11 rounded-lg mb-4 flex items-center justify-center text-white font-serif text-lg font-bold transition-all duration-300 group-hover:scale-110"
                  style={{ background: '#1A1A1A', fontFamily: "'Playfair Display', Georgia, serif" }}
                >
                  {evt.letter}
                </div>
                <h3 className="text-base mb-0.5" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 400, color: '#1A1A1A' }}>
                  {evt.name}
                </h3>
                <p className="text-xs" style={{ color: '#AAA' }}>{evt.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          TESTIMONIOS
          ============================================================ */}
      <section id="testimonios" className="py-24 md:py-32 px-6" style={{ background: '#FFFFFF' }}>
        <div className="max-w-5xl mx-auto">
          <div
            id="test-header"
            data-reveal
            className="text-center mb-14"
            style={{
              opacity: reveal('test-header') ? 1 : 0,
              transform: reveal('test-header') ? 'translateY(0)' : 'translateY(30px)',
              transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <span className="text-[#C9A84C] text-[11px] tracking-[0.4em] uppercase font-light block mb-4">
              Testimonios
            </span>
            <h2 style={{ color: '#1A1A1A', fontWeight: 400, letterSpacing: '-0.02em', fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)' }}>
              Lo que dicen nuestros clientes
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              { name: 'Maria & Carlos', type: 'Boda — Junio 2025', quote: 'Nuestra boda fue exactamente como la sonamos. El equipo de J.Benitez se encargo de cada detalle.' },
              { name: 'Familia Garcia', type: 'Comunion — Marzo 2025', quote: 'La comida es espectacular. Nuestros invitados aun hablan de los postres meses despues.' },
              { name: 'TechCorp Solutions', type: 'Evento Corporativo — Enero 2025', quote: 'Organizamos nuestra cena de empresa aqui y fue un exito total. Profesionalidad y calidad.' },
            ].map((t, i) => (
              <div
                key={i}
                id={`test-${i}`}
                data-reveal
                className="rounded-xl p-6 transition-all duration-400 border"
                style={{
                  background: '#F8F3E6',
                  borderColor: 'rgba(0,0,0,0.04)',
                  opacity: reveal(`test-${i}`) ? 1 : 0,
                  transform: reveal(`test-${i}`) ? 'translateY(0)' : 'translateY(20px)',
                  transition: `all 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.1}s`,
                }}
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, s) => (
                    <svg key={s} className="w-3.5 h-3.5" fill="#C9A84C" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-sm leading-relaxed mb-5 italic" style={{ color: '#6B6B6B' }}>
                  {t.quote}
                </p>
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ background: '#1A1A1A', color: '#C9A84C' }}
                  >
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="font-medium text-sm" style={{ color: '#1A1A1A' }}>{t.name}</p>
                    <p className="text-xs" style={{ color: '#BBB' }}>{t.type}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          CTA FINAL
          ============================================================ */}
      <section className="py-24 md:py-30 px-6" style={{ background: '#1A1A1A' }}>
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="h-px w-8 bg-[#C9A84C]/50" />
            <span className="text-[#C9A84C] text-[11px] tracking-[0.35em] uppercase font-light">Disena tu evento</span>
            <div className="h-px w-8 bg-[#C9A84C]/50" />
          </div>
          <h2
            className="mb-6"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 'clamp(1.8rem, 4vw, 3rem)',
              lineHeight: 1.15,
              fontWeight: 400,
              letterSpacing: '-0.02em',
              color: '#FFFFFF',
            }}
          >
            Tu celebracion,
            <br />
            <span className="italic" style={{ color: '#C9A84C' }}>tu menu</span>
          </h2>
          <p className="text-white/50 text-sm md:text-base mb-10 max-w-lg mx-auto leading-relaxed font-light">
            Selecciona tus platos favoritos y envia tu propuesta. Nosotros nos encargamos del resto.
          </p>
          <Link href="/configurador">
            <button
              className="px-12 py-4 text-sm font-medium tracking-wider transition-all duration-300"
              style={{
                background: '#C9A84C',
                color: '#FFFFFF',
                borderRadius: '10px',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#B8973F'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#C9A84C'; }}
            >
              Empezar a Disenar
            </button>
          </Link>
        </div>
      </section>

      {/* ============================================================
          FOOTER
          ============================================================ */}
      <footer className="py-14 px-6" style={{ background: '#1A1A1A', borderTop: '1px solid rgba(201,168,76,0.15)' }}>
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-10">
          <div>
            <div className="font-serif text-lg mb-2 tracking-wide" style={{ color: '#C9A84C', fontFamily: "'Playfair Display', Georgia, serif" }}>
              J.Benitez
            </div>
            <p className="text-sm leading-relaxed font-light text-stone-600">
              Salon de Celebraciones Premium en Sevilla.
            </p>
          </div>
          <div>
            <h4 className="text-white font-medium mb-3 text-sm tracking-wide">Contacto</h4>
            <div className="space-y-2.5 text-sm font-light text-stone-500">
              <div className="flex items-center gap-2"><span style={{ color: '#C9A84C' }}>{'\u2192'}</span><span>info@jbenitez.com</span></div>
              <div className="flex items-center gap-2"><span style={{ color: '#C9A84C' }}>{'\u2192'}</span><span>+34 954 000 000</span></div>
              <div className="flex items-center gap-2"><span style={{ color: '#C9A84C' }}>{'\u2192'}</span><span>Sevilla, Espana</span></div>
            </div>
          </div>
          <div>
            <h4 className="text-white font-medium mb-3 text-sm tracking-wide">Enlaces</h4>
            <div className="space-y-2.5 text-sm font-light">
              <a className="block hover:text-[#C9A84C] transition-colors text-stone-500" href="/configurador">Configurador</a>
              <a className="block hover:text-[#C9A84C] transition-colors text-stone-500" href="/admin/login">Panel Admin</a>
            </div>
          </div>
        </div>
        <div className="max-w-5xl mx-auto mt-10 pt-6 text-center text-xs font-light" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', color: '#555' }}>
          {'\u00A9'} 2025 J.Benitez. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
}
