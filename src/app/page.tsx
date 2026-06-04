'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';

/* ============================================================
   J.Benitez — Landing Page Rediseñada
   Diseño cinematográfico premium
   Paleta: Gold / Cream / Ink
   Tipografía: Playfair Display + Inter
   ============================================================ */

// Real venue photos (public/images). A solid fallback colour sits under each
// image so a card never renders blank if a photo is missing or still loading.
const SPACES = [
  { title: 'Salón Principal', sub: 'Hasta 300 comensales', span: 'md:col-span-2 md:row-span-2', bg: '#241a0c url(/images/space-salon.jpg) center/cover no-repeat' },
  { title: 'Terraza y Jardín', sub: 'Ceremonias al aire libre', span: '', bg: '#7d8a5a url(/images/space-jardin.jpg) center/cover no-repeat' },
  { title: 'Gastronomía', sub: 'Cocina de autor', span: '', bg: '#6b4a2a url(/images/space-gastronomia.jpg) center/cover no-repeat' },
  { title: 'Decoración', sub: 'Cada detalle, cuidado', span: '', bg: '#4a3318 url(/images/space-decoracion.jpg) center/cover no-repeat' },
  { title: 'Montaje de Mesa', sub: 'Elegancia en cada mesa', span: '', bg: '#4e1d28 url(/images/space-mesa.jpg) center/cover no-repeat' },
];

const SERVICES = [
  {
    title: 'Menú Personalizado',
    desc: 'Diseña tu carta con más de 100 platos seleccionados por nuestros chefs. Cada celebración merece un menú a medida, creado exclusivamente para tu evento.',
    gradient: 'from-[#C9A84C] via-[#D4B85C] to-[#A88A3A]',
  },
  {
    title: 'Espacios Únicos',
    desc: 'Salones versátiles que se adaptan a cada tipo de celebración. Desde bodas íntimas hasta grandes eventos corporativos, cada espacio tiene su propia personalidad.',
    gradient: 'from-[#1A1A1A] via-[#2D2416] to-[#1A1A1A]',
  },
  {
    title: 'Experiencia Premium',
    desc: 'Desde la primera llamada hasta el último baile, nos encargamos de todo. Tu único trabajo es disfrutar de cada momento.',
    gradient: 'from-[#6B2737] via-[#8A3647] to-[#6B2737]',
  },
];

const EVENTS = [
  { letter: 'B', name: 'Bodas', sub: 'El día más importante' },
  { letter: 'C', name: 'Cumpleaños', sub: 'Celebra tu día' },
  { letter: 'E', name: 'Corporativos', sub: 'Eventos de empresa' },
  { letter: 'B', name: 'Bautizos', sub: 'Momentos especiales' },
  { letter: 'C', name: 'Comuniones', sub: 'Celebraciones familiares' },
  { letter: 'O', name: 'Otros', sub: 'Personaliza tu evento' },
];

const TESTIMONIALS = [
  { name: 'María & Carlos', type: 'Boda · Junio 2025', quote: 'Nuestra boda fue exactamente como la soñamos. El equipo de J.Benitez se encargó de cada detalle con una dedicación que nunca olvidaremos.' },
  { name: 'Familia García', type: 'Comunión · Marzo 2025', quote: 'La comida es espectacular. Nuestros invitados aún hablan de los postres meses después. Calidad y atención inigualables.' },
  { name: 'TechCorp Solutions', type: 'Evento Corporativo · Enero 2025', quote: 'Organizamos nuestra cena de empresa aquí y fue un éxito total. Profesionalidad, elegancia y un servicio impecable.' },
];

export default function HomePage() {
  const [navSolid, setNavSolid] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setNavSolid(window.scrollY > 80);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const els = Array.from(document.querySelectorAll('[data-reveal]'));

    // Accesibilidad: si el usuario prefiere menos movimiento, mostramos todo.
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || !('IntersectionObserver' in window)) {
      setRevealed(new Set(els.map((el) => el.id)));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setRevealed((prev) => new Set(prev).add(entry.target.id));
          }
        });
      },
      // Revela el contenido ANTES de que entre en pantalla (400px de margen),
      // así nunca se ve una sección vacía mientras se baja.
      { threshold: 0, rootMargin: '0px 0px 400px 0px' }
    );
    els.forEach((el) => observer.observe(el));

    // Revela de inmediato lo que ya está en (o cerca de) pantalla al cargar.
    const revealVisible = () => {
      setRevealed((prev) => {
        const next = new Set(prev);
        els.forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.top < window.innerHeight + 400) next.add(el.id);
        });
        return next;
      });
    };
    revealVisible();

    // Red de seguridad: como muy tarde, todo visible en 1,2 s.
    const fallback = setTimeout(() => {
      setRevealed((prev) => {
        const next = new Set(prev);
        els.forEach((el) => next.add(el.id));
        return next;
      });
    }, 1200);

    return () => {
      observer.disconnect();
      clearTimeout(fallback);
    };
  }, []);

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      setMousePos({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight });
    };
    window.addEventListener('mousemove', handleMouse);
    return () => window.removeEventListener('mousemove', handleMouse);
  }, []);

  const reveal = (id: string) => revealed.has(id);

  const navBg = navSolid
    ? 'bg-[#FAF8F5]/90 backdrop-blur-2xl border-b border-[#C9A84C]/10'
    : 'bg-transparent';

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1A1A1A] overflow-x-hidden">
      {/* Skip link */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-3 focus:bg-[#1A1A1A] focus:text-white focus:rounded-xl focus:text-sm">
        Ir al contenido principal
      </a>

      {/* ============================================================
          NAVEGACIÓN
          ============================================================ */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ${navBg}`}>
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="flex items-center justify-between h-20 md:h-24">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all duration-500 group-hover:scale-105"
                style={{
                  background: navSolid ? 'linear-gradient(135deg, #C9A84C, #A88A3A)' : 'rgba(201,168,76,0.15)',
                  border: '1.5px solid rgba(201,168,76,0.6)',
                }}>
                <span className="font-serif font-bold text-sm md:text-base" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: navSolid ? '#1A1A1A' : '#C9A84C' }}>J</span>
              </div>
              <span className="font-serif tracking-wide text-base md:text-lg transition-colors duration-500" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: navSolid ? '#1A1A1A' : '#FFFFFF' }}>
                J.Benitez
              </span>
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-8">
              {['Espacios', 'Servicios', 'Eventos', 'Testimonios'].map((item) => (
                <a key={item} href={`#${item.toLowerCase()}`}
                  className={`text-sm tracking-[0.08em] font-medium transition-all duration-300 relative after:absolute after:bottom-[-2px] after:left-0 after:h-[1.5px] after:bg-[#C9A84C] after:transition-all after:duration-300 after:w-0 hover:after:w-full ${
                    navSolid ? 'text-stone-600 hover:text-[#C9A84C]' : 'text-white/80 hover:text-white'
                  }`}>
                  {item}
                </a>
              ))}
              <Link href="/configurador">
                <button className="px-7 py-3 text-sm font-medium tracking-[0.08em] transition-all duration-300 rounded-xl active:scale-[0.97]"
                  style={{
                    background: navSolid ? '#1A1A1A' : 'rgba(201,168,76,0.9)',
                    color: '#FFFFFF',
                    boxShadow: navSolid ? 'none' : '0 4px 16px rgba(201,168,76,0.3)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = navSolid ? '#C9A84C' : '#C9A84C'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = navSolid ? '#1A1A1A' : 'rgba(201,168,76,0.9)'; }}>
                  Diseña tu Evento
                </button>
              </Link>
            </div>

            {/* Mobile hamburger */}
            <button className="md:hidden p-2 relative z-50" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menú">
              <div className="w-6 h-5 flex flex-col justify-between" style={{ color: navSolid || menuOpen ? '#1A1A1A' : '#FFFFFF' }}>
                <span className="w-full h-[1.5px] bg-current transition-all duration-300" style={{ transform: menuOpen ? 'rotate(45deg) translate(4px, 4px)' : 'none' }} />
                <span className="w-full h-[1.5px] bg-current transition-all duration-300" style={{ opacity: menuOpen ? 0 : 1 }} />
                <span className="w-full h-[1.5px] bg-current transition-all duration-300" style={{ transform: menuOpen ? 'rotate(-45deg) translate(4px, -4px)' : 'none' }} />
              </div>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <div className={`md:hidden fixed inset-0 z-40 bg-[#FAF8F5] transition-all duration-500 ${menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          <div className="flex flex-col items-center justify-center h-full gap-8 px-6">
            {['Espacios', 'Servicios', 'Eventos', 'Testimonios'].map((item) => (
              <a key={item} href={`#${item.toLowerCase()}`}
                className="text-2xl font-serif tracking-wide text-[#1A1A1A] hover:text-[#C9A84C] transition-colors"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                onClick={() => setMenuOpen(false)}>
                {item}
              </a>
            ))}
            <Link href="/configurador" onClick={() => setMenuOpen(false)}>
              <button className="px-10 py-4 bg-[#C9A84C] text-white text-base font-medium tracking-[0.08em] rounded-xl mt-4">
                Diseña tu Evento
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ============================================================
          HERO — Cinematográfico
          ============================================================ */}
      <section ref={heroRef} className="relative min-h-[100dvh] flex items-center justify-center overflow-hidden">
        {/* Background layers — cinematic, self-contained, always visible.
            Sits behind the optional video so the hero is never blank. */}
        <div className="absolute inset-0 z-0 hero-kenburns" style={{
          background: 'linear-gradient(160deg, rgba(10,8,6,0.55) 0%, rgba(26,18,8,0.35) 40%, rgba(45,36,22,0.35) 60%, rgba(10,8,6,0.6) 100%), url(/images/hero-poster.jpg) center/cover no-repeat',
        }} />

        {/* Impactful video — autoplays the venue footage when present.
            Drop a file at public/video/hero.mp4 to use real footage; until then
            the cinematic backdrop above carries the hero. Hides itself on error. */}
        <video
          className="absolute inset-0 z-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster="/images/hero-poster.jpg"
          onError={(e) => { (e.currentTarget as HTMLVideoElement).style.display = 'none'; }}
        >
          <source src="/video/hero.mp4" type="video/mp4" />
        </video>

        {/* Cinematic colour grade + legibility scrim over the video */}
        <div className="absolute inset-0 z-0 pointer-events-none" style={{
          background: 'linear-gradient(160deg, rgba(10,8,6,0.78) 0%, rgba(26,18,8,0.55) 40%, rgba(45,36,22,0.5) 60%, rgba(10,8,6,0.82) 100%)',
        }} />

        {/* Diagonal light sweep */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="hero-sweep absolute top-0 left-0 h-full w-1/3" style={{
            background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.12), transparent)',
          }} />
        </div>

        {/* Ambient light orbs */}
        <div className="absolute top-1/4 -left-1/4 w-[60vw] h-[60vw] rounded-full z-0 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(201,168,76,0.08) 0%, transparent 70%)',
            transform: `translate(${(mousePos.x - 0.5) * 30}px, ${(mousePos.y - 0.5) * 30}px)`,
            transition: 'transform 0.3s ease-out',
          }} />
        <div className="absolute bottom-1/4 -right-1/4 w-[50vw] h-[50vw] rounded-full z-0 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(107,39,55,0.06) 0%, transparent 70%)',
            transform: `translate(${(mousePos.x - 0.5) * -20}px, ${(mousePos.y - 0.5) * -20}px)`,
            transition: 'transform 0.3s ease-out',
          }} />

        {/* Decorative grid */}
        <div className="absolute inset-0 z-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(201,168,76,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.5) 1px, transparent 1px)',
            backgroundSize: '80px 80px',
          }} />

        {/* Content */}
        <div className="relative z-10 text-center px-6 max-w-5xl mx-auto" style={{ paddingTop: 'clamp(6rem, 14vh, 10rem)', paddingBottom: 'clamp(4rem, 10vh, 6rem)' }}>
          {/* Gold accent line */}
          <div className="mx-auto mb-8 w-16 h-[1.5px]" style={{ background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)' }} />

          <h1 className="mb-6 leading-[1.05] select-none"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 'clamp(2.8rem, 7vw, 5.5rem)',
              fontWeight: 400,
              letterSpacing: '-0.03em',
              color: '#FFFFFF',
            }}>
            Donde cada celebración
            <br />
            <span className="italic" style={{
              background: 'linear-gradient(135deg, #C9A84C 0%, #D4B85C 50%, #C9A84C 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              se convierte en recuerdo
            </span>
          </h1>

          <p className="text-base md:text-lg max-w-2xl mx-auto mb-12 leading-relaxed font-light tracking-wide"
            style={{ color: 'rgba(255,255,255,0.6)' }}>
            Diseña el menú perfecto para tu celebración. Más de 100 platos, espacios únicos
            y una experiencia gastronómica que tus invitados recordarán siempre.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/configurador">
              <button className="group px-10 py-4 text-sm font-medium tracking-[0.1em] transition-all duration-300 flex items-center gap-3 active:scale-[0.97] rounded-xl"
                style={{
                  background: 'linear-gradient(135deg, #C9A84C 0%, #D4B85C 100%)',
                  color: '#1A1A1A',
                  boxShadow: '0 4px 24px rgba(201,168,76,0.35)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 6px 32px rgba(201,168,76,0.5)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 4px 24px rgba(201,168,76,0.35)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                Diseña tu Evento
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
            </Link>
            <a href="#espacios">
              <button className="px-10 py-4 text-sm font-medium tracking-[0.1em] transition-all duration-300 rounded-xl active:scale-[0.97]"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(12px)',
                  color: 'rgba(255,255,255,0.9)',
                  border: '1.5px solid rgba(255,255,255,0.2)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}>
                Ver Espacios
              </button>
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="mt-12 flex flex-col items-center gap-2">
          <span className="text-[10px] tracking-[0.2em] uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>Descubre</span>
          <div className="w-[1px] h-10" style={{ background: 'linear-gradient(to bottom, rgba(201,168,76,0.5), transparent)' }}>
            <div className="w-[1px] h-3 bg-[#C9A84C] animate-[scroll_2s_ease-in-out_infinite]" />
          </div>
        </div>
      </section>

      {/* ============================================================
          ESPACIOS — Bento grid
          ============================================================ */}
      <section id="espacios" className="py-10 md:py-14 px-6" style={{ background: '#FAF8F5' }}>
        <div className="max-w-7xl mx-auto">
          <div id="espacios-header" data-reveal
            className="text-center mb-10"
            style={{
              opacity: reveal('espacios-header') ? 1 : 0,
              transform: reveal('espacios-header') ? 'translateY(0)' : 'translateY(30px)',
              transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
            }}>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(2rem, 4vw, 3.25rem)', fontWeight: 400, letterSpacing: '-0.03em', lineHeight: 1.1, color: '#1A1A1A' }}>
              El escenario perfecto
            </h2>
            <p className="text-base max-w-xl mx-auto leading-relaxed mt-4 font-light" style={{ color: '#999' }}>
              Salones versátiles adaptados a cada tipo de celebración. Cada espacio tiene su propia personalidad.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 grid-rows-3 gap-3 h-[420px] md:h-[520px]">
            {SPACES.map((space, i) => (
              <div key={i} id={`space-${i}`} data-reveal
                className={`relative overflow-hidden group cursor-pointer rounded-2xl ${space.span}`}
                style={{
                  opacity: reveal(`space-${i}`) ? 1 : 0,
                  transform: reveal(`space-${i}`) ? 'translateY(0)' : 'translateY(20px)',
                  transition: `all 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.08}s`,
                }}>
                {/* Background image */}
                <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-105"
                  style={{ background: space.bg }} />
                {/* Dark overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />
                {/* Gold line hover */}
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#C9A84C] scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
                {/* Content */}
                <div className="absolute inset-0 flex flex-col justify-end p-5 md:p-6">
                  <h3 className="font-serif text-base md:text-lg text-white mb-0.5" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 400 }}>
                    {space.title}
                  </h3>
                  <p className="text-white/60 text-xs md:text-sm font-light">{space.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          SERVICIOS — Split editorial layout
          ============================================================ */}
      <section id="servicios" className="py-16 md:py-24 px-6" style={{ background: '#F5F0E8' }}>
        <div className="max-w-6xl mx-auto">
          <div id="servicios-header" data-reveal
            className="text-center mb-10 md:mb-14"
            style={{
              opacity: reveal('servicios-header') ? 1 : 0,
              transform: reveal('servicios-header') ? 'translateY(0)' : 'translateY(30px)',
              transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
            }}>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(2rem, 4vw, 3.25rem)', fontWeight: 400, letterSpacing: '-0.03em', lineHeight: 1.1, color: '#1A1A1A' }}>
              Más que un salón
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            {SERVICES.map((svc, i) => (
              <div key={i} id={`serv-${i}`} data-reveal
                className="group rounded-2xl overflow-hidden transition-all duration-500 hover:shadow-xl border border-[#1A1A1A]/5"
                style={{
                  background: '#FAF8F5',
                  opacity: reveal(`serv-${i}`) ? 1 : 0,
                  transform: reveal(`serv-${i}`) ? 'translateY(0)' : 'translateY(30px)',
                  transition: `all 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.12}s`,
                }}>
                {/* Gradient header bar */}
                <div className={`h-1.5 bg-gradient-to-r ${svc.gradient}`} />
                <div className="p-8">
                  {/* Decorative element */}
                  <div className="w-8 h-[1.5px] mb-5" style={{ background: '#C9A84C' }} />
                  <h3 className="text-xl md:text-2xl mb-4" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 400, lineHeight: 1.2, letterSpacing: '-0.02em', color: '#1A1A1A' }}>
                    {svc.title}
                  </h3>
                  <p className="text-sm leading-relaxed font-light" style={{ color: '#888' }}>
                    {svc.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          EVENTOS — Letter badges
          ============================================================ */}
      <section id="eventos" className="py-16 md:py-24 px-6" style={{ background: '#FAF8F5' }}>
        <div className="max-w-5xl mx-auto">
          <div id="eventos-header" data-reveal
            className="text-center mb-10"
            style={{
              opacity: reveal('eventos-header') ? 1 : 0,
              transform: reveal('eventos-header') ? 'translateY(0)' : 'translateY(30px)',
              transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
            }}>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(2rem, 4vw, 3.25rem)', fontWeight: 400, letterSpacing: '-0.03em', lineHeight: 1.1, color: '#1A1A1A' }}>
              Cada celebración es única
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {EVENTS.map((evt, i) => (
              <div key={i} id={`evt-${i}`} data-reveal
                className="rounded-xl p-6 md:p-7 transition-all duration-400 group cursor-pointer border"
                style={{
                  background: '#FFFFFF',
                  borderColor: 'rgba(0,0,0,0.06)',
                  opacity: reveal(`evt-${i}`) ? 1 : 0,
                  transform: reveal(`evt-${i}`) ? 'translateY(0)' : 'translateY(20px)',
                  transition: `all 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.06}s`,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#C9A84C'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(201,168,76,0.12)'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                <div className="w-12 h-12 rounded-xl mb-4 flex items-center justify-center text-white font-serif text-xl font-bold transition-all duration-300 group-hover:scale-110 group-hover:rounded-lg"
                  style={{ background: 'linear-gradient(135deg, #1A1A1A, #2D2416)', fontFamily: "'Playfair Display', Georgia, serif" }}>
                  {evt.letter}
                </div>
                <h3 className="text-base md:text-lg mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 400, color: '#1A1A1A' }}>
                  {evt.name}
                </h3>
                <p className="text-xs md:text-sm" style={{ color: '#AAA' }}>{evt.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          TESTIMONIOS — Editorial quotes
          ============================================================ */}
      <section id="testimonios" className="py-16 md:py-24 px-6" style={{ background: '#F0EBE3' }}>
        <div className="max-w-5xl mx-auto">
          <div id="test-header" data-reveal
            className="text-center mb-10"
            style={{
              opacity: reveal('test-header') ? 1 : 0,
              transform: reveal('test-header') ? 'translateY(0)' : 'translateY(30px)',
              transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
            }}>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(2rem, 4vw, 3.25rem)', fontWeight: 400, letterSpacing: '-0.03em', color: '#1A1A1A' }}>
              Lo que dicen nuestros clientes
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} id={`test-${i}`} data-reveal
                className="rounded-2xl p-8 transition-all duration-400 border"
                style={{
                  background: '#FAF8F5',
                  borderColor: 'rgba(0,0,0,0.04)',
                  opacity: reveal(`test-${i}`) ? 1 : 0,
                  transform: reveal(`test-${i}`) ? 'translateY(0)' : 'translateY(20px)',
                  transition: `all 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.1}s`,
                }}>
                {/* Opening quote mark */}
                <div className="mb-4 text-3xl font-serif italic leading-none select-none" style={{ color: '#C9A84C', fontFamily: "'Playfair Display', Georgia, serif", lineHeight: 0.5 }}>
                  &ldquo;
                </div>
                <p className="text-sm leading-relaxed mb-6 font-light" style={{ color: '#6B6B6B' }}>
                  {t.quote}
                </p>
                <div className="flex items-center gap-3 pt-4 border-t" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ background: '#1A1A1A', color: '#C9A84C' }}>
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
      <section className="relative py-20 md:py-28 px-6 overflow-hidden" style={{ background: '#1A1A1A' }}>
        {/* Ambient glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[40vw] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, rgba(201,168,76,0.06) 0%, transparent 70%)' }} />

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h2 className="mb-6"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 'clamp(2rem, 4.5vw, 3.5rem)',
              lineHeight: 1.1,
              fontWeight: 400,
              letterSpacing: '-0.03em',
              color: '#FFFFFF',
            }}>
            Tu celebración,
            <br />
            <span className="italic" style={{
              background: 'linear-gradient(135deg, #C9A84C, #D4B85C)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              tu menú
            </span>
          </h2>
          <p className="text-white/40 text-sm md:text-base mb-10 max-w-lg mx-auto leading-relaxed font-light">
            Selecciona tus platos favoritos y envíanos tu propuesta. Nosotros nos encargamos del resto.
          </p>
          <Link href="/configurador">
            <button className="group px-12 py-4 text-sm font-medium tracking-[0.1em] transition-all duration-300 flex items-center gap-3 mx-auto active:scale-[0.97] rounded-xl"
              style={{
                background: 'linear-gradient(135deg, #C9A84C, #D4B85C)',
                color: '#1A1A1A',
                boxShadow: '0 4px 24px rgba(201,168,76,0.3)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 6px 32px rgba(201,168,76,0.45)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 4px 24px rgba(201,168,76,0.3)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
              Empieza a Diseñar
              <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
          </Link>
        </div>
      </section>

      {/* ============================================================
          FOOTER
          ============================================================ */}
      <footer className="py-16 px-6" style={{ background: '#1A1A1A', borderTop: '1px solid rgba(201,168,76,0.08)' }}>
        <div className="max-w-6xl mx-auto grid md:grid-cols-4 gap-10">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)', color: '#1A1A1A', fontFamily: "'Playfair Display', Georgia, serif" }}>
                J
              </div>
              <span className="font-serif text-lg tracking-wide" style={{ color: '#C9A84C', fontFamily: "'Playfair Display', Georgia, serif" }}>
                J.Benitez
              </span>
            </div>
            <p className="text-sm leading-relaxed font-light max-w-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Salón de Celebraciones Premium en Sevilla. Donde cada celebración se convierte en un recuerdo inolvidable.
            </p>
          </div>
          <div>
            <h4 className="text-white/70 font-medium mb-4 text-sm tracking-[0.08em] uppercase">Contacto</h4>
            <div className="space-y-3 text-sm font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>
              <div className="flex items-center gap-2">
                <span style={{ color: '#C9A84C' }}>&rarr;</span>
                <span>info@salonesjosebenitez.com</span>
              </div>
              <div className="flex items-center gap-2">
                <span style={{ color: '#C9A84C' }}>&rarr;</span>
                <span>615 60 08 63</span>
              </div>
              <div className="flex items-center gap-2">
                <span style={{ color: '#C9A84C' }}>&rarr;</span>
                <span>C. Villanueva del Ariscal, 1
                41806 Umbrete, Sevilla</span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-white/70 font-medium mb-4 text-sm tracking-[0.08em] uppercase">Enlaces</h4>
            <div className="space-y-3 text-sm font-light">
              <a href="/configurador" className="block hover:text-[#C9A84C] transition-colors" style={{ color: 'rgba(255,255,255,0.4)' }}>Configurador</a>
              <a href="/admin/login" className="block hover:text-[#C9A84C] transition-colors" style={{ color: 'rgba(255,255,255,0.4)' }}>Panel Admin</a>
              <a href="#espacios" className="block hover:text-[#C9A84C] transition-colors" style={{ color: 'rgba(255,255,255,0.4)' }}>Espacios</a>
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-10 pt-6 text-center text-xs font-light" style={{ borderTop: '1px solid rgba(255,255,255,0.04)', color: '#555' }}>
          &copy; 2025 J.Benitez. Todos los derechos reservados.
        </div>
      </footer>

      {/* Scroll animation keyframes */}
      <style jsx>{`
        @keyframes scroll {
          0%, 100% { transform: translateY(0); opacity: 0; }
          50% { transform: translateY(28px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
