'use client';

import Link from 'next/link';
import { useState, useEffect, useRef, useCallback } from 'react';

/* ============================================================
   J.Benitez — Landing Page Premium Cinemática
   Estilo: Apple x Stripe, con alma de salón andaluz
   Paleta: Gold / Cream / Ink
   ============================================================ */

// ─── Static Data ──────────────────────────────────────────────

const SPACES = [
  { title: 'Salón Principal', sub: 'Hasta 300 comensales', span: 'md:col-span-2 md:row-span-2',
    bg: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1200&q=85' },
  { title: 'Terraza', sub: 'Vistas al jardín', span: '',
    bg: 'https://images.unsplash.com/photo-1555244162-803834f70033?w=800&q=85' },
  { title: 'Sala VIP', sub: 'Eventos exclusivos', span: '',
    bg: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=85' },
  { title: 'Jardín', sub: 'Ceremonias al aire libre', span: '',
    bg: 'https://images.unsplash.com/photo-1478146059778-26028b07395a?w=800&q=85' },
  { title: 'Sala Íntima', sub: 'Celebraciones pequeñas', span: '',
    bg: 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=800&q=85' },
];

const SERVICES = [
  {
    title: 'Menú Personalizado',
    desc: 'Diseña tu carta con más de 100 platos seleccionados por nuestros chefs. Cada celebración merece un menú a medida.',
    icon: '01',
  },
  {
    title: 'Espacios Únicos',
    desc: 'Salones versátiles que se adaptan a cada tipo de celebración. Desde bodas íntimas hasta grandes eventos corporativos.',
    icon: '02',
  },
  {
    title: 'Experiencia Integral',
    desc: 'Desde la primera llamada hasta el último baile, nos encargamos de todo. Tu único trabajo es disfrutar de cada momento.',
    icon: '03',
  },
];

const HERO_IMAGES = [
  'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1920&q=90',
  'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=1920&q=90',
  'https://images.unsplash.com/photo-1555244162-803834f70033?w=1920&q=90',
];

// ─── Hooks ────────────────────────────────────────────────────

function useScrollReveal() {
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const els = document.querySelectorAll('[data-reveal]');
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || !('IntersectionObserver' in window)) {
      setRevealed(new Set(Array.from(els).map((el) => el.id)));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setRevealed((p) => new Set(p).add(entry.target.id));
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    els.forEach((el) => observer.observe(el));

    const fallback = setTimeout(() => {
      setRevealed((prev) => {
        const next = new Set(prev);
        Array.from(els).forEach((el) => next.add(el.id));
        return next;
      });
    }, 5000);
    return () => { observer.disconnect(); clearTimeout(fallback); };
  }, []);

  return useCallback((id: string) => revealed.has(id), [revealed]);
}

function useCounter(end: number, duration = 2000, startOnView = true) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!startOnView) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const startTime = performance.now();
          const step = (now: number) => {
            const pct = Math.min(1, (now - startTime) / duration);
            const eased = 1 - Math.pow(1 - pct, 3);
            setCount(Math.floor(eased * end));
            if (pct < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [end, duration, startOnView]);

  return { count, ref };
}

// ─── Component ────────────────────────────────────────────────

export default function HomePage() {
  const [navSolid, setNavSolid] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [heroImg, setHeroImg] = useState(0);
  const reveal = useScrollReveal();
  const heroRef = useRef<HTMLDivElement>(null);

  const counters = [
    { end: 15, suffix: '+', label: 'Años de experiencia' },
    { end: 1200, suffix: '+', label: 'Eventos realizados' },
    { end: 98, suffix: '%', label: 'Clientes satisfechos' },
    { end: 5, suffix: '', label: 'Espacios únicos' },
  ];

  useEffect(() => {
    const onScroll = () => setNavSolid(window.scrollY > 100);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Rotate hero background
  useEffect(() => {
    const interval = setInterval(() => setHeroImg((p) => (p + 1) % HERO_IMAGES.length), 7000);
    return () => clearInterval(interval);
  }, []);

  const navBg = navSolid
    ? 'bg-[#FAF8F5]/95 backdrop-blur-2xl shadow-[0_1px_0_rgba(201,168,76,0.08)]'
    : 'bg-transparent';

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1A1A1A] overflow-x-hidden">
      {/* ---- Skip Link ---- */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-5 focus:py-3 focus:bg-[#1A1A1A] focus:text-white focus:rounded-xl focus:text-sm">
        Ir al contenido principal
      </a>

      {/* ============================================================
          NAVEGACIÓN
          ============================================================ */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ${navBg}`}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-20 md:h-24">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all duration-500"
                style={{
                  background: navSolid
                    ? 'linear-gradient(135deg, #C9A84C, #A88A3A)'
                    : 'rgba(201,168,76,0.15)',
                  border: '1.5px solid rgba(201,168,76,0.6)',
                }}>
                <span className="font-serif font-bold text-sm md:text-base"
                  style={{ color: navSolid ? '#1A1A1A' : '#C9A84C' }}>J</span>
              </div>
              <span className="font-serif tracking-wide text-base md:text-lg transition-colors duration-500"
                style={{ color: navSolid ? '#1A1A1A' : '#FFFFFF' }}>
                J.Benitez
              </span>
            </Link>

            {/* Desktop */}
            <div className="hidden md:flex items-center gap-8">
              {['Espacios', 'Servicios', 'Eventos', 'Testimonios'].map((item) => (
                <a key={item} href={`#${item.toLowerCase()}`}
                  className={`text-sm tracking-[0.06em] font-medium transition-all duration-300 relative after:absolute after:bottom-[-2px] after:left-0 after:h-[1.5px] after:bg-[#C9A84C] after:transition-all after:duration-300 after:w-0 hover:after:w-full ${
                    navSolid ? 'text-stone-600 hover:text-[#C9A84C]' : 'text-white/80 hover:text-white'
                  }`}>
                  {item}
                </a>
              ))}
              <Link href="/configurador">
                <button className="px-7 py-3 text-sm font-medium tracking-[0.06em] transition-all duration-300 rounded-xl active:scale-[0.97]"
                  style={{
                    background: navSolid ? '#1A1A1A' : 'rgba(201,168,76,0.9)',
                    color: '#FFFFFF',
                    boxShadow: navSolid ? 'none' : '0 4px 20px rgba(201,168,76,0.3)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#C9A84C'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = navSolid ? '#1A1A1A' : 'rgba(201,168,76,0.9)'; }}>
                  Diseña tu Evento
                </button>
              </Link>
            </div>

            {/* Mobile hamburger */}
            <button className="md:hidden p-2 relative z-50" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menú">
              <div className="w-6 h-5 flex flex-col justify-between" style={{ color: navSolid || menuOpen ? '#1A1A1A' : '#FFFFFF' }}>
                <span className="w-full h-[1.5px] bg-current transition-all duration-300"
                  style={{ transform: menuOpen ? 'rotate(45deg) translate(4px, 4px)' : 'none' }} />
                <span className="w-full h-[1.5px] bg-current transition-all duration-300"
                  style={{ opacity: menuOpen ? 0 : 1 }} />
                <span className="w-full h-[1.5px] bg-current transition-all duration-300"
                  style={{ transform: menuOpen ? 'rotate(-45deg) translate(4px, -4px)' : 'none' }} />
              </div>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <div className={`md:hidden fixed inset-0 z-40 bg-[#FAF8F5] transition-all duration-500 ${
          menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}>
          <div className="flex flex-col items-center justify-center h-full gap-8 px-6">
            {['Espacios', 'Servicios', 'Eventos', 'Testimonios'].map((item) => (
              <a key={item} href={`#${item.toLowerCase()}`}
                className="text-2xl font-serif tracking-wide text-[#1A1A1A] hover:text-[#C9A84C] transition-colors"
                onClick={() => setMenuOpen(false)}>
                {item}
              </a>
            ))}
            <Link href="/configurador" onClick={() => setMenuOpen(false)}>
              <button className="px-10 py-4 bg-[#C9A84C] text-white text-base font-medium tracking-[0.06em] rounded-xl mt-4">
                Diseña tu Evento
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ============================================================
          HERO — CINEMATOGRÁFICO
          ============================================================ */}
      <section ref={heroRef} className="relative min-h-[100dvh] flex items-center justify-center overflow-hidden">
        {/* Background Image Crossfade */}
        {HERO_IMAGES.map((img, i) => (
          <div key={i}
            className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
            style={{
              backgroundImage: `url(${img})`,
              opacity: heroImg === i ? 1 : 0,
              transform: `scale(${heroImg === i ? 1 : 1.05})`,
              transition: 'opacity 1.5s ease, transform 8s ease',
            }}
          />
        ))}

        {/* Dark cinematic overlay */}
        <div className="absolute inset-0 z-1"
          style={{
            background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.35) 40%, rgba(0,0,0,0.7) 100%)',
          }} />

        {/* Animated gold particles */}
        <div className="absolute inset-0 z-1 overflow-hidden pointer-events-none">
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i}
              className="absolute w-[2px] rounded-full"
              style={{
                height: `${Math.random() * 60 + 20}px`,
                background: 'linear-gradient(to top, transparent, #C9A84C)',
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                opacity: 0.15 + Math.random() * 0.25,
                animation: `floatGold ${8 + Math.random() * 12}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 8}s`,
              }}
            />
          ))}
        </div>

        {/* Vignette */}
        <div className="absolute inset-0 z-1 pointer-events-none"
          style={{ boxShadow: 'inset 0 0 200px rgba(0,0,0,0.5)' }} />

        {/* Content */}
        <div className="relative z-10 text-center px-6 max-w-5xl mx-auto pt-28 pb-20">
          {/* Gold accent */}
          <div className="mx-auto mb-8 w-20 h-[1.5px] opacity-70"
            style={{ background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)' }} />

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
            <span className="italic"
              style={{
                background: 'linear-gradient(135deg, #C9A84C 0%, #E8CC6A 50%, #C9A84C 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
              se convierte en recuerdo
            </span>
          </h1>

          <p className="text-base md:text-lg max-w-2xl mx-auto mb-12 leading-relaxed font-light tracking-wide"
            style={{ color: 'rgba(255,255,255,0.65)' }}>
            Diseña el menú perfecto para tu celebración. Más de 100 platos, espacios únicos
            y una experiencia gastronómica que tus invitados recordarán siempre.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/configurador">
              <button className="group px-10 py-4 text-sm font-medium tracking-[0.08em] transition-all duration-500 flex items-center gap-3 active:scale-[0.97] rounded-xl"
                style={{
                  background: 'linear-gradient(135deg, #C9A84C 0%, #D4B85C 100%)',
                  color: '#1A1A1A',
                  boxShadow: '0 4px 24px rgba(201,168,76,0.35)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 8px 40px rgba(201,168,76,0.5)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 24px rgba(201,168,76,0.35)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}>
                Diseña tu Evento
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
            </Link>
            <a href="#espacios">
              <button className="px-10 py-4 text-sm font-medium tracking-[0.08em] transition-all duration-300 rounded-xl active:scale-[0.97]"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(12px)',
                  color: 'rgba(255,255,255,0.9)',
                  border: '1.5px solid rgba(255,255,255,0.2)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                }}>
                Ver Espacios
              </button>
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2">
          <span className="text-[10px] tracking-[0.2em] uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>Descubre</span>
          <div className="w-[1px] h-8 relative overflow-hidden" style={{ background: 'rgba(201,168,76,0.3)' }}>
            <div className="absolute top-0 left-0 w-full h-3 bg-[#C9A84C] animate-pulse" style={{ animationDuration: '2s' }} />
          </div>
        </div>
      </section>

      {/* ============================================================
          CONTADORES
          ============================================================ */}
      <section className="py-20 md:py-24 px-6 border-b border-[#1A1A1A]/5" style={{ background: '#FFFFFF' }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            {counters.map((c, i) => {
              const { count, ref } = useCounter(c.end);
              return (
                <div key={i} className="text-center" data-reveal
                  style={{
                    opacity: reveal(`counter-${i}`) ? 1 : 0,
                    transform: reveal(`counter-${i}`) ? 'translateY(0)' : 'translateY(20px)',
                    transition: `all 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.1}s`,
                  }}>
                  <span ref={ref} className="block font-serif text-4xl md:text-5xl mb-2"
                    style={{
                      background: 'linear-gradient(135deg, #C9A84C, #A88A3A)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}>
                    {count}{c.suffix}
                  </span>
                  <span className="text-sm font-light tracking-wide" style={{ color: '#999' }}>{c.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================================================
          ESPACIOS — Bento Grid
          ============================================================ */}
      <section id="espacios" className="py-28 md:py-36 px-6" style={{ background: '#FAF8F5' }}>
        <div className="max-w-7xl mx-auto">
          <div id="espacios-header" data-reveal
            className="text-center mb-16"
            style={{
              opacity: reveal('espacios-header') ? 1 : 0,
              transform: reveal('espacios-header') ? 'translateY(0)' : 'translateY(30px)',
              transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
            }}>
            <span className="text-xs tracking-[0.15em] uppercase mb-4 block" style={{ color: '#C9A84C' }}>El escenario perfecto</span>
            <h2 style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 'clamp(2rem, 4vw, 3.25rem)',
              fontWeight: 400,
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
              color: '#1A1A1A'
            }}>
              Cinco espacios,<br />
              <span className="italic">una misma excelencia</span>
            </h2>
            <p className="text-base max-w-xl mx-auto leading-relaxed mt-4 font-light" style={{ color: '#999' }}>
              Salones versátiles adaptados a cada tipo de celebración. Cada espacio tiene su propia personalidad.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 grid-rows-3 gap-3 h-[420px] md:h-[540px]">
            {SPACES.map((space, i) => (
              <div key={i} id={`space-${i}`} data-reveal
                className={`relative overflow-hidden group cursor-pointer rounded-2xl ${space.span}`}
                style={{
                  opacity: reveal(`space-${i}`) ? 1 : 0,
                  transform: reveal(`space-${i}`) ? 'translateY(0)' : 'translateY(20px)',
                  transition: `all 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.08}s`,
                }}>
                <div className="absolute inset-0 transition-all duration-700 group-hover:scale-110 bg-cover bg-center"
                  style={{ backgroundImage: `url(${space.bg})` }} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10
                  transition-all duration-500 group-hover:from-black/60" />
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#C9A84C]
                  scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
                <div className="absolute inset-0 flex flex-col justify-end p-5 md:p-6">
                  <h3 className="font-serif text-base md:text-lg text-white mb-0.5"
                    style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 400 }}>
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
          SERVICIOS — Editorial
          ============================================================ */}
      <section id="servicios" className="py-28 md:py-36 px-6" style={{ background: '#FFFFFF' }}>
        <div className="max-w-6xl mx-auto">
          <div id="servicios-header" data-reveal
            className="text-center mb-16 md:mb-20"
            style={{
              opacity: reveal('servicios-header') ? 1 : 0,
              transform: reveal('servicios-header') ? 'translateY(0)' : 'translateY(30px)',
              transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
            }}>
            <span className="text-xs tracking-[0.15em] uppercase mb-4 block" style={{ color: '#C9A84C' }}>Servicios</span>
            <h2 style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 'clamp(2rem, 4vw, 3.25rem)',
              fontWeight: 400,
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
              color: '#1A1A1A'
            }}>
              Más que un salón,<br />
              <span className="italic">una experiencia completa</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {SERVICES.map((svc, i) => (
              <div key={i} id={`serv-${i}`} data-reveal
                className="group relative transition-all duration-500"
                style={{
                  opacity: reveal(`serv-${i}`) ? 1 : 0,
                  transform: reveal(`serv-${i}`) ? 'translateY(0)' : 'translateY(30px)',
                  transition: `all 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.12}s`,
                }}>
                {/* Decorative number */}
                <div className="text-6xl md:text-7xl font-serif italic leading-none mb-6 select-none"
                  style={{
                    background: 'linear-gradient(135deg, rgba(201,168,76,0.15), rgba(201,168,76,0.05))',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    fontFamily: "'Playfair Display', Georgia, serif",
                  }}>
                  {svc.icon}
                </div>
                <h3 className="text-xl md:text-2xl mb-4"
                  style={{
                    fontFamily: "'Playfair Display', Georgia, serif",
                    fontWeight: 400,
                    lineHeight: 1.2,
                    letterSpacing: '-0.02em',
                    color: '#1A1A1A'
                  }}>
                  {svc.title}
                </h3>
                <p className="text-sm leading-relaxed font-light" style={{ color: '#888' }}>
                  {svc.desc}
                </p>
                {/* Gold line on hover */}
                <div className="mt-6 w-8 h-[1.5px] transition-all duration-500 group-hover:w-16"
                  style={{ background: '#C9A84C' }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          EVENTOS — Letter badges
          ============================================================ */}
      <section id="eventos" className="py-28 md:py-36 px-6" style={{ background: '#FAF8F5' }}>
        <div className="max-w-5xl mx-auto">
          <div id="eventos-header" data-reveal
            className="text-center mb-16"
            style={{
              opacity: reveal('eventos-header') ? 1 : 0,
              transform: reveal('eventos-header') ? 'translateY(0)' : 'translateY(30px)',
              transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
            }}>
            <span className="text-xs tracking-[0.15em] uppercase mb-4 block" style={{ color: '#C9A84C' }}>Eventos</span>
            <h2 style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 'clamp(2rem, 4vw, 3.25rem)',
              fontWeight: 400,
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
              color: '#1A1A1A'
            }}>
              Cada celebración<br />
              <span className="italic">es única</span>
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { letter: 'B', name: 'Bodas', sub: 'El día más importante' },
              { letter: 'C', name: 'Cumpleaños', sub: 'Celebra tu día' },
              { letter: 'E', name: 'Corporativos', sub: 'Eventos de empresa' },
              { letter: 'B', name: 'Bautizos', sub: 'Momentos especiales' },
              { letter: 'C', name: 'Comuniones', sub: 'Celebraciones familiares' },
              { letter: 'O', name: 'Otros', sub: 'Personaliza tu evento' },
            ].map((evt, i) => (
              <div key={i} id={`evt-${i}`} data-reveal
                className="rounded-xl p-6 md:p-7 transition-all duration-400 group cursor-pointer border"
                style={{
                  background: '#FFFFFF',
                  borderColor: 'rgba(0,0,0,0.06)',
                  opacity: reveal(`evt-${i}`) ? 1 : 0,
                  transform: reveal(`evt-${i}`) ? 'translateY(0)' : 'translateY(20px)',
                  transition: `all 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.06}s`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#C9A84C';
                  e.currentTarget.style.boxShadow = '0 8px 30px rgba(201,168,76,0.12)';
                  e.currentTarget.style.transform = 'translateY(-4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}>
                <div className="w-12 h-12 rounded-xl mb-4 flex items-center justify-center text-white font-serif text-xl font-bold transition-all duration-300 group-hover:scale-110"
                  style={{
                    background: 'linear-gradient(135deg, #1A1A1A, #2D2416)',
                    fontFamily: "'Playfair Display', Georgia, serif",
                  }}>
                  {evt.letter}
                </div>
                <h3 className="text-base md:text-lg mb-1"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 400, color: '#1A1A1A' }}>
                  {evt.name}
                </h3>
                <p className="text-xs md:text-sm" style={{ color: '#AAA' }}>{evt.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          TESTIMONIOS — Splash editorial
          ============================================================ */}
      <section id="testimonios" className="py-28 md:py-36 px-6" style={{ background: '#FFFFFF' }}>
        <div className="max-w-5xl mx-auto">
          <div id="test-header" data-reveal
            className="text-center mb-16"
            style={{
              opacity: reveal('test-header') ? 1 : 0,
              transform: reveal('test-header') ? 'translateY(0)' : 'translateY(30px)',
              transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
            }}>
            <span className="text-xs tracking-[0.15em] uppercase mb-4 block" style={{ color: '#C9A84C' }}>Testimonios</span>
            <h2 style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 'clamp(2rem, 4vw, 3.25rem)',
              fontWeight: 400,
              letterSpacing: '-0.03em',
              color: '#1A1A1A'
            }}>
              Lo que dicen<br />
              <span className="italic">nuestros clientes</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: 'María & Carlos', type: 'Boda', date: 'Junio 2025',
                quote: 'Nuestra boda fue exactamente como la soñamos. El equipo de J.Benitez se encargó de cada detalle con una dedicación que nunca olvidaremos.' },
              { name: 'Familia García', type: 'Comunión', date: 'Marzo 2025',
                quote: 'La comida es espectacular. Nuestros invitados aún hablan de los postres meses después. Calidad y atención inigualables.' },
              { name: 'TechCorp Solutions', type: 'Corporativo', date: 'Enero 2025',
                quote: 'Organizamos nuestra cena de empresa aquí y fue un éxito total. Profesionalidad, elegancia y un servicio impecable.' },
            ].map((t, i) => (
              <div key={i} id={`test-${i}`} data-reveal
                className="rounded-2xl p-8 transition-all duration-400 border group hover:shadow-lg"
                style={{
                  background: '#FAF8F5',
                  borderColor: 'rgba(0,0,0,0.04)',
                  opacity: reveal(`test-${i}`) ? 1 : 0,
                  transform: reveal(`test-${i}`) ? 'translateY(0)' : 'translateY(20px)',
                  transition: `all 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.1}s`,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#C9A84C33'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.04)'; }}>
                <div className="mb-4 text-3xl font-serif italic leading-none select-none"
                  style={{ color: '#C9A84C', fontFamily: "'Playfair Display', Georgia, serif", lineHeight: 0.5 }}>
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
                    <p className="text-xs" style={{ color: '#BBB' }}>{t.type} · {t.date}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          CTA FINAL — Cinematográfico
          ============================================================ */}
      <section className="relative py-32 md:py-44 px-6 overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #0A0806 0%, #1A1208 30%, #2D2416 60%, #1A1208 80%, #0A0806 100%)',
        }}>
        {/* Decorative glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[40vw] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 70%)',
          }} />
        <div className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, #C9A84C 1px, transparent 0)',
            backgroundSize: '40px 40px',
          }} />

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <div className="mx-auto mb-8 w-16 h-[1.5px]"
            style={{ background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)' }} />

          <h2 className="mb-6 leading-[1.05]"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 'clamp(2.2rem, 5vw, 4rem)',
              fontWeight: 400,
              letterSpacing: '-0.03em',
              color: '#FFFFFF',
            }}>
            Tu celebración,<br />
            <span className="italic"
              style={{
                background: 'linear-gradient(135deg, #C9A84C, #E8CC6A)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
              tu menú
            </span>
          </h2>

          <p className="text-base md:text-lg max-w-xl mx-auto mb-12 leading-relaxed font-light"
            style={{ color: 'rgba(255,255,255,0.55)' }}>
            Configura tu menú online, selecciona los platos que más te gusten
            y recibe un presupuesto personalizado en minutos.
          </p>

          <Link href="/configurador">
            <button className="group px-12 py-4 text-sm font-medium tracking-[0.08em] transition-all duration-500
              flex items-center gap-3 mx-auto active:scale-[0.97] rounded-xl"
              style={{
                background: 'linear-gradient(135deg, #C9A84C 0%, #D4B85C 100%)',
                color: '#1A1A1A',
                boxShadow: '0 4px 24px rgba(201,168,76,0.35)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 8px 40px rgba(201,168,76,0.5)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 24px rgba(201,168,76,0.35)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}>
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
      <footer className="py-16 px-6 border-t border-[#C9A84C]/10" style={{ background: '#0A0806' }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-10">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: '#C9A84C' }}>
                  <span className="font-serif font-bold text-sm" style={{ color: '#1A1A1A' }}>J</span>
                </div>
                <span className="font-serif tracking-wide text-base" style={{ color: '#f8f3e6', fontFamily: "'Playfair Display', Georgia, serif" }}>
                  J.Benitez
                </span>
              </div>
              <p className="text-sm leading-relaxed max-w-sm font-light" style={{ color: '#888' }}>
                Salón de celebraciones premium en Sevilla. Donde cada celebración se convierte en un recuerdo inolvidable.
              </p>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-serif text-sm tracking-wider uppercase mb-4" style={{ color: '#C9A84C', fontFamily: "'Playfair Display', Georgia, serif" }}>
                Contacto
              </h4>
              <ul className="space-y-2 text-sm font-light" style={{ color: '#888' }}>
                <li>Sevilla, España</li>
                <li>info@jbenitez.es</li>
                <li>+34 600 000 000</li>
              </ul>
            </div>

            {/* Links */}
            <div>
              <h4 className="font-serif text-sm tracking-wider uppercase mb-4" style={{ color: '#C9A84C', fontFamily: "'Playfair Display', Georgia, serif" }}>
                Enlaces
              </h4>
              <ul className="space-y-2 text-sm font-light">
                <li><Link href="/configurador" className="hover:text-[#C9A84C] transition-colors" style={{ color: '#888' }}>Configurador</Link></li>
                <li><Link href="/admin" className="hover:text-[#C9A84C] transition-colors" style={{ color: '#888' }}>Panel Admin</Link></li>
                <li><a href="#espacios" className="hover:text-[#C9A84C] transition-colors" style={{ color: '#888' }}>Espacios</a></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 text-center text-xs font-light" style={{ borderTop: '1px solid rgba(201,168,76,0.1)', color: '#666' }}>
            &copy; {new Date().getFullYear()} J.Benitez. Todos los derechos reservados.
          </div>
        </div>
      </footer>

      {/* ============================================================
          KEYFRAMES
          ============================================================ */}
      <style jsx global>{`
        @keyframes floatGold {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.15; }
          25% { transform: translateY(-20px) translateX(10px); opacity: 0.3; }
          50% { transform: translateY(-40px) translateX(-5px); opacity: 0.1; }
          75% { transform: translateY(-15px) translateX(15px); opacity: 0.25; }
        }
      `}</style>
    </div>
  );
}
