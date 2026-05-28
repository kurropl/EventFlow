'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';

/* ============================================================
   J.Benitez — Landing Page
   Fondo crema uniforme (#FAF8F5), paleta gold/cream/ink
   Sin video externo roto, sin imágenes de Unsplash
   ============================================================ */

export default function HomePage() {
  const [navSolid, setNavSolid] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const onScroll = () => setNavSolid(window.scrollY > 60);
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
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('[data-reveal]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const reveal = (id: string) => revealed.has(id);

  const navBg = navSolid
    ? 'bg-[#FAF8F5]/95 backdrop-blur-xl border-b border-[#C9A84C]/15'
    : 'bg-transparent';
  const navText = navSolid ? 'text-[#1A1A1A]' : 'text-white';

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1A1A1A]">
      {/* SKIP LINK */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[#1A1A1A] focus:text-white focus:rounded-lg"
      >
        Ir al contenido principal
      </a>

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
                  background: navSolid ? 'transparent' : 'rgba(201,168,76,0.15)',
                  border: '1.5px solid rgba(201,168,76,0.5)',
                }}
              >
                <span
                  className="font-serif font-bold"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#C9A84C' }}
                >
                  J
                </span>
              </div>
              <span
                className="font-serif tracking-wide hidden sm:inline"
                style={{ fontFamily: "'Playfair Display', Georgia, serif", color: navSolid ? '#1A1A1A' : '#FFFFFF' }}
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
                  onMouseEnter={(e) => { e.currentTarget.style.background = navSolid ? '#C9A84C' : 'rgba(201,168,76,1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = navSolid ? '#1A1A1A' : 'rgba(201,168,76,0.9)'; }}
                >
                  Diseña tu Evento
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

          <div
            className="md:hidden overflow-hidden bg-[#FAF8F5] border-t border-stone-200 transition-all duration-400"
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
                  Diseña tu Evento
                </button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ============================================================
          HERO — Gradiente elegante sobre fondo crema
          Sin imagen externa, sin video roto
          ============================================================ */}
      <section className="relative min-h-[100dvh] flex items-center justify-center overflow-hidden">
        {/* Background gradient — no external images */}
        <div className="absolute inset-0 z-0" style={{
          background: 'linear-gradient(135deg, #1A1A1A 0%, #2D2416 50%, #1A1A1A 100%)',
        }} />
        {/* Gold accent overlay */}
        <div className="absolute inset-0 z-0" style={{
          background: 'radial-gradient(ellipse at 30% 50%, rgba(201,168,76,0.15) 0%, transparent 60%)',
        }} />
        {/* Decorative lines */}
        <div className="absolute inset-0 z-0 opacity-10" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(201,168,76,0.3) 35px, rgba(201,168,76,0.3) 36px)',
        }} />

        {/* Content */}
        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto" style={{ paddingTop: 'clamp(5rem, 12vh, 8rem)', paddingBottom: 'clamp(4rem, 10vh, 6rem)' }}>
          <h1
            className="mb-6"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 'clamp(2.4rem, 6vw, 4.5rem)',
              lineHeight: 1.1,
              fontWeight: 400,
              letterSpacing: '-0.02em',
              color: '#FFFFFF',
            }}
          >
            Donde cada celebracion
            <br />
            <span className="italic" style={{ color: '#C9A84C' }}>se convierte en recuerdo</span>
          </h1>

          <p
            className="text-base md:text-lg max-w-xl mx-auto mb-10 leading-relaxed font-light tracking-wide"
            style={{ color: 'rgba(255,255,255,0.75)' }}
          >
            Configura tu evento perfecto con nuestro disenador interactivo. Mas de 100 platos,
            espacios unicos y una experiencia inolvidable.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/configurador">
              <button
                className="group px-10 py-4 text-sm font-medium tracking-wider transition-all duration-300 flex items-center gap-2 active:scale-[0.98]"
                style={{
                  background: '#C9A84C',
                  color: '#FFFFFF',
                  borderRadius: '10px',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#B8973F'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#C9A84C'; }}
              >
                Diseña tu Evento
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
            </Link>
            <a href="#espacios">
              <button
                className="px-10 py-4 text-sm font-medium tracking-wider transition-all duration-300 active:scale-[0.98]"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(12px)',
                  color: '#FFFFFF',
                  border: '1.5px solid rgba(255,255,255,0.3)',
                  borderRadius: '10px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                }}
              >
                Ver Espacios
              </button>
            </a>
          </div>
        </div>
      </section>

      {/* ============================================================
          ESPACIOS — Bento grid asimetrico
          ============================================================ */}
      <section id="espacios" className="py-24 md:py-32 px-6" style={{ background: '#FAF8F5' }}>
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
            <h2 style={{ color: '#1A1A1A', fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.1, fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)' }}>
              El escenario perfecto
            </h2>
            <p className="text-base max-w-xl mx-auto leading-relaxed mt-3" style={{ color: '#888', fontWeight: 300 }}>
              Salones versatiles adaptados a cada tipo de celebracion.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 grid-rows-3 gap-3 h-[480px] md:h-[550px]">
            {[
              { title: 'Salon Principal', sub: 'Hasta 300 comensales', span: 'md:col-span-2 md:row-span-2', bg: 'linear-gradient(135deg, #C9A84C 0%, #B8973F 100%)' },
              { title: 'Terraza', sub: 'Vistas al jardin', span: '', bg: 'linear-gradient(135deg, #2D2416 0%, #1A1A1A 100%)' },
              { title: 'Sala VIP', sub: 'Eventos exclusivos', span: '', bg: 'linear-gradient(135deg, #1A1A1A 0%, #2D2416 100%)' },
              { title: 'Jardin', sub: 'Ceremonias al aire libre', span: '', bg: 'linear-gradient(135deg, #B8973F 0%, #C9A84C 100%)' },
              { title: 'Sala Intima', sub: 'Celebraciones pequenas', span: '', bg: 'linear-gradient(135deg, #1A1A1A 0%, #C9A84C 100%)' },
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
                <div className="absolute inset-0 w-full h-full" style={{ background: space.bg }} />
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
          SERVICIOS — 3 columnas
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
            <h2 style={{ color: '#1A1A1A', fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.1, fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)' }}>
              Mas que un salon
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: 'Menu Personalizado',
                desc: 'Disena tu carta con mas de 100 platos seleccionados por nuestros chefs. Cada celebracion merece un menu a medida, creado exclusivamente para tu evento.',
              },
              {
                title: 'Espacios Unicos',
                desc: 'Salones versatiles que se adaptan a cada tipo de celebracion. Desde bodas intimas hasta grandes eventos corporativos, cada espacio tiene su propia personalidad.',
              },
              {
                title: 'Experiencia Premium',
                desc: 'Desde la primera llamada hasta el ultimo baile, nos encargamos de todo. Tu unico trabajo es disfrutar de cada momento.',
              },
            ].map((svc, i) => (
              <div
                key={i}
                id={`serv-${i}`}
                data-reveal
                className="group rounded-2xl overflow-hidden transition-all duration-500 hover:shadow-xl"
                style={{
                  background: '#FFFFFF',
                  boxShadow: '0 2px 20px rgba(0,0,0,0.04)',
                  opacity: reveal(`serv-${i}`) ? 1 : 0,
                  transform: reveal(`serv-${i}`) ? 'translateY(0)' : 'translateY(30px)',
                  transition: `all 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.12}s`,
                }}
              >
                <div className="h-48" style={{ background: 'linear-gradient(135deg, #C9A84C 0%, #B8973F 100%)' }} />
                <div className="p-6">
                  <h3 className="text-xl mb-3" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 400, lineHeight: 1.2, letterSpacing: '-0.01em', color: '#1A1A1A' }}>
                    {svc.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#888', fontWeight: 300 }}>
                    {svc.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          EVENTOS — Cards con letter badges
          ============================================================ */}
      <section id="eventos" className="py-24 md:py-32 px-6" style={{ background: '#FAF8F5' }}>
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
          TESTIMONIOS — Sin estrellas
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
            <h2 style={{ color: '#1A1A1A', fontWeight: 400, letterSpacing: '-0.02em', fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)' }}>
              Lo que dicen nuestros clientes
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              { name: 'Maria & Carlos', type: 'Boda, Junio 2025', quote: 'Nuestra boda fue exactamente como la sonamos. El equipo de J.Benitez se encargo de cada detalle.' },
              { name: 'Familia Garcia', type: 'Comunion, Marzo 2025', quote: 'La comida es espectacular. Nuestros invitados aun hablan de los postres meses despues.' },
              { name: 'TechCorp Solutions', type: 'Evento Corporativo, Enero 2025', quote: 'Organizamos nuestra cena de empresa aqui y fue un exito total. Profesionalidad y calidad.' },
            ].map((t, i) => (
              <div
                key={i}
                id={`test-${i}`}
                data-reveal
                className="rounded-xl p-6 transition-all duration-400 border"
                style={{
                  background: '#FAF8F5',
                  borderColor: 'rgba(0,0,0,0.04)',
                  opacity: reveal(`test-${i}`) ? 1 : 0,
                  transform: reveal(`test-${i}`) ? 'translateY(0)' : 'translateY(20px)',
                  transition: `all 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.1}s`,
                }}
              >
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
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/configurador">
              <button
                className="px-10 py-4 text-sm font-medium tracking-wider transition-all duration-300 active:scale-[0.98]"
                style={{
                  background: '#C9A84C',
                  color: '#FFFFFF',
                  borderRadius: '10px',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#B8973F'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#C9A84C'; }}
              >
                Empieza a Disenar
              </button>
            </Link>
            <a href="mailto:info@jbenitez.com" className="text-white/50 hover:text-[#C9A84C] transition-colors text-sm font-light">
              info@jbenitez.com
            </a>
          </div>
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
            <p className="text-sm leading-relaxed font-light" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Salon de Celebraciones Premium en Sevilla.
            </p>
          </div>
          <div>
            <h4 className="text-white font-medium mb-3 text-sm tracking-wide">Contacto</h4>
            <div className="space-y-2.5 text-sm font-light" style={{ color: 'rgba(255,255,255,0.5)' }}>
              <div className="flex items-center gap-2"><span style={{ color: '#C9A84C' }}>{'\u2192'}</span><span>info@jbenitez.com</span></div>
              <div className="flex items-center gap-2"><span style={{ color: '#C9A84C' }}>{'\u2192'}</span><span>+34 954 000 000</span></div>
              <div className="flex items-center gap-2"><span style={{ color: '#C9A84C' }}>{'\u2192'}</span><span>Sevilla, Espana</span></div>
            </div>
          </div>
          <div>
            <h4 className="text-white font-medium mb-3 text-sm tracking-wide">Enlaces</h4>
            <div className="space-y-2.5 text-sm font-light">
              <a className="block hover:text-[#C9A84C] transition-colors" style={{ color: 'rgba(255,255,255,0.5)' }} href="/configurador">Configurador</a>
              <a className="block hover:text-[#C9A84C] transition-colors" style={{ color: 'rgba(255,255,255,0.5)' }} href="/admin/login">Panel Admin</a>
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
