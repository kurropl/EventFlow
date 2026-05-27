'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

/* ───────── TYPOGRAPHY ───────── */
const serif = "'Playfair Display', Georgia, serif";
const sans = "'Inter', system-ui, sans-serif";

/* ───────── BRAND TOKENS ───────── */
const gold = '#C9A84C';
const goldLight = '#D4B85C';
const cream = '#FAF8F5';
const ink = '#1A1A1A';
const warmBg = '#F5F0EB';
const warmCard = '#FCFAF7';

/* ───────── CSS ANIMATIONS ───────── */
const revealClass = 'reveal';
const staggerClass = 'stagger';

/* ───────── SECTIONS DATA ───────── */
const spaces = [
  { name: 'Salón Principal', desc: 'Hasta 300 comensales', img: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1200&q=85' },
  { name: 'Terraza', desc: 'Vistas al jardín', img: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800&q=85' },
  { name: 'Sala VIP', desc: 'Eventos exclusivos', img: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=85' },
  { name: 'Jardín', desc: 'Ceremonias al aire libre', img: 'https://images.unsplash.com/photo-1478146059778-26028b07395a?w=800&q=85' },
  { name: 'Sala Íntima', desc: 'Celebraciones pequeñas', img: 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=800&q=85' },
];

const services = [
  {
    tag: 'Gastronomía', title: 'Menú Personalizado',
    text: 'Diseña tu carta con más de 100 platos seleccionados por nuestros chefs. Cada celebración merece un menú a medida.',
    img: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=85', reversed: false,
  },
  {
    tag: 'Instalaciones', title: 'Espacios Únicos',
    text: 'Salones versátiles que se adaptan a cada tipo de celebración. Desde bodas íntimas hasta grandes eventos corporativos.',
    img: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1200&q=85', reversed: true,
  },
  {
    tag: 'Servicio', title: 'Experiencia Premium',
    text: 'Desde la primera llamada hasta el último baile, nos encargamos de todo. Tu único trabajo es disfrutar.',
    img: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=1200&q=85', reversed: false,
  },
];

const eventTypes = [
  { letter: 'B', name: 'Bodas', desc: 'El día más importante', color: gold },
  { letter: 'C', name: 'Cumpleaños', desc: 'Celebra tu día', color: '#8B8B8B' },
  { letter: 'C', name: 'Corporativos', desc: 'Eventos de empresa', color: '#6B7B8B' },
  { letter: 'B', name: 'Bautizos', desc: 'Momentos especiales', color: '#7B8B7B' },
  { letter: 'C', name: 'Comuniones', desc: 'Celebraciones familiares', color: '#8B7B8B' },
  { letter: 'O', name: 'Otros', desc: 'Personaliza tu evento', color: '#8B8B7B' },
];

const testimonials = [
  { text: 'Nuestra boda fue exactamente como la soñamos. El equipo de Jose Benitez se encargó de cada detalle.', initial: 'M', name: 'María & Carlos', meta: 'Boda — Junio 2025' },
  { text: 'La comida es espectacular. Nuestros invitados aún hablan de los postres meses después.', initial: 'F', name: 'Familia García', meta: 'Comunión — Marzo 2025' },
  { text: 'Organizamos nuestra cena de empresa aquí y fue un éxito total. Profesionalidad y calidad.', initial: 'T', name: 'TechCorp Solutions', meta: 'Evento Corporativo — Enero 2025' },
];

const stars = Array.from({ length: 5 }, (_, i) => i);

/* ───────── ANIMATION HOOK ───────── */
function useReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll(`.${revealClass}`).forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

/* ───────── NAV COMPONENT ───────── */
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navStyle = scrolled
    ? { background: '#1A1A1A', backdropFilter: 'blur(0)', borderBottom: '1px solid rgba(255,255,255,0.06)' }
    : { background: 'transparent' };

  const textColor = scrolled ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.8)';

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-500" style={navStyle}>
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="flex items-center justify-between h-20 md:h-24">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-full flex items-center justify-center transition-all duration-500"
              style={{ background: scrolled ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
              <span className="font-bold text-lg transition-colors duration-500" style={{ color: gold, fontFamily: serif }}>JB</span>
            </div>
            <span className="text-lg tracking-wide transition-colors duration-500" style={{ color: scrolled ? '#FFFFFF' : '#FFFFFF', fontFamily: serif }}>
              Jose Benitez
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-10">
            {['Espacios', 'Servicios', 'Eventos'].map((item) => (
              <a key={item} href={`#${item.toLowerCase()}`}
                className="text-sm tracking-wide font-medium transition-all duration-300 relative after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 after:bg-[#C9A84C] after:transition-all after:duration-300 hover:after:w-full"
                style={{ color: textColor }}>
                {item}
              </a>
            ))}
            <Link href="/configurador">
              <button className="px-6 py-2.5 text-sm font-medium tracking-wide transition-all duration-500 rounded-lg"
                style={{
                  background: scrolled ? gold : 'rgba(255,255,255,0.1)',
                  color: scrolled ? ink : '#FFFFFF',
                  border: scrolled ? 'none' : '1px solid rgba(255,255,255,0.3)',
                }}>
                Diseña tu Evento
              </button>
            </Link>
          </div>
          <button className="md:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>
            <div className="w-5 h-4 flex flex-col justify-between" style={{ color: scrolled ? '#FFFFFF' : '#FFFFFF' }}>
              <span className="w-full h-0.5 bg-current transform transition-all duration-300"
                style={menuOpen ? { transform: 'rotate(45deg) translate(2.5px, 2.5px)' } : {}}></span>
              <span className="w-full h-0.5 bg-current transition-all duration-300"
                style={menuOpen ? { opacity: 0 } : {}}></span>
              <span className="w-full h-0.5 bg-current transform transition-all duration-300"
                style={menuOpen ? { transform: 'rotate(-45deg) translate(2.5px, -2.5px)' } : {}}></span>
            </div>
          </button>
        </div>
      </div>
      <div className="md:hidden overflow-hidden transition-all duration-300"
        style={{ maxHeight: menuOpen ? '400px' : '0px', opacity: menuOpen ? 1 : 0, background: 'rgba(26,26,26,0.98)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="px-6 py-8 space-y-5">
          {['Espacios', 'Servicios', 'Eventos', 'Testimonios'].map((item) => (
            <a key={item} href={`#${item.toLowerCase()}`} className="block text-lg" style={{ fontFamily: serif, color: '#FFFFFF' }}
              onClick={() => setMenuOpen(false)}>
              {item}
            </a>
          ))}
          <Link href="/configurador" onClick={() => setMenuOpen(false)}>
            <button className="w-full py-3 rounded-lg text-sm font-medium tracking-wide" style={{ background: gold, color: ink }}>
              Diseña tu Evento
            </button>
          </Link>
        </div>
      </div>
    </nav>
  );
}

/* ───────── HERO ───────── */
function HeroSection() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setLoaded(true); }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1A1A1A] via-[#2A2520] to-[#1A1A1A]"></div>
        {/* Warm gold overlay */}
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at 50% 30%, rgba(201,168,76,0.08) 0%, transparent 60%)'
        }}></div>
        {/* Subtle grain texture overlay */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }}>
        </div>
        {/* Hero image */}
        <img src="https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1920&q=85"
          alt=""
          className="w-full h-full object-cover"
          style={{ filter: 'brightness(0.35) saturate(0.7) contrast(1.1)', opacity: loaded ? 1 : 0, transition: 'opacity 1.5s ease' }} />
        {/* Gradient overlays */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(to bottom, rgba(26,26,26,0.4) 0%, rgba(26,26,26,0.2) 40%, rgba(26,26,26,0.6) 100%)'
        }}></div>
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-5xl mx-auto" style={{ opacity: loaded ? 1 : 0, transform: `translateY(${loaded ? 0 : 20}px)`, transition: 'all 1s cubic-bezier(0.16, 1, 0.3, 1)' }}>
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className="h-px w-12" style={{ background: `linear-gradient(90deg, transparent, ${gold})` }}></div>
          <span className="text-xs tracking-[0.35em] uppercase font-light" style={{ color: gold }}>Salón de Celebraciones Premium</span>
          <div className="h-px w-12" style={{ background: `linear-gradient(90deg, ${gold}, transparent)` }}></div>
        </div>

        <h1 className="mb-6 leading-tight" style={{
          fontFamily: serif,
          fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
          fontWeight: 400,
          letterSpacing: '-0.03em',
          color: '#FFFFFF',
          lineHeight: 1.08,
        }}>
          Donde cada celebración
          <br />
          <span className="italic" style={{ color: `rgba(201,168,76,0.85)` }}>se convierte en recuerdo</span>
        </h1>

        <p className="text-base md:text-lg max-w-2xl mx-auto mb-12 leading-relaxed font-light tracking-wide"
          style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 300 }}>
          Configura tu evento perfecto con nuestro diseñador interactivo. Más de 100 platos, espacios únicos y una experiencia inolvidable.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link href="/configurador">
            <button className="group px-10 py-4 text-sm font-medium tracking-wider transition-all duration-500 flex items-center gap-2 rounded-lg"
              style={{
                background: `linear-gradient(135deg, ${gold} 0%, ${goldLight} 100%)`,
                color: ink,
                boxShadow: `0 4px 24px rgba(201,168,76,0.25)`,
              }}>
              Diseña tu Evento
              <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
          </Link>
          <a href="#espacios">
            <button className="px-10 py-4 text-sm font-medium tracking-wider transition-all duration-500 rounded-lg"
              style={{
                border: '1px solid rgba(255,255,255,0.2)',
                color: 'rgba(255,255,255,0.85)',
              }}>
              Ver Espacios
            </button>
          </a>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2" style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.5s ease 1s' }}>
        <div className="w-5 h-9 rounded-full flex justify-center" style={{ border: '1px solid rgba(255,255,255,0.15)' }}>
          <div className="w-1 h-2.5 rounded-full mt-2 animate-pulse" style={{ background: 'rgba(255,255,255,0.3)' }}></div>
        </div>
      </div>
    </section>
  );
}

/* ───────── STATS BAR ───────── */
function StatsBar() {
  const stats = [
    { value: '100+', label: 'Platos disponibles' },
    { value: '300', label: 'Comensales máximos' },
    { value: '500+', label: 'Eventos realizados' },
    { value: '98%', label: 'Satisfacción clientes' },
  ];

  return (
    <section className="-mt-20 relative z-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className={`${revealClass} rounded-2xl p-8 md:p-10 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12`}
          style={{
            background: '#FFFFFF',
            boxShadow: '0 4px 40px rgba(80,60,40,0.08), 0 2px 12px rgba(0,0,0,0.04)',
            border: '1px solid rgba(0,0,0,0.05)',
          }}>
          {stats.map((s, i) => (
            <div key={s.label} className="text-center">
              <div className="font-serif text-3xl md:text-4xl mb-1" style={{ color: ink, fontFamily: serif, fontWeight: 400, letterSpacing: '-0.02em' }}>
                {s.value}
              </div>
              <div className="text-xs tracking-[0.15em] uppercase" style={{ color: '#6B6B6B', fontWeight: 400 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────── SPACES GALLERY ───────── */
function SpacesGallery() {
  return (
    <section id="espacios" className="py-28 md:py-36 px-6" style={{ background: cream }}>
      <div className="max-w-7xl mx-auto">
        <div className={`${revealClass} text-center mb-16`}>
          <span className="text-[11px] tracking-[0.4em] uppercase font-light block mb-4" style={{ color: gold }}>Nuestros Espacios</span>
          <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl mb-4" style={{ color: ink, fontFamily: serif, fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            El escenario perfecto
          </h2>
          <p className="text-base max-w-xl mx-auto leading-relaxed" style={{ color: '#6B6B6B', fontWeight: 300 }}>
            Salones versátiles adaptados a cada tipo de celebración.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 grid-rows-3 gap-4 h-[500px] md:h-[600px]">
          {spaces.map((space, i) => (
            <div key={space.name}
              className={`${revealClass} relative overflow-hidden group cursor-pointer`}
              style={{
                gridColumn: i === 0 ? 'span 2' : 'span 1',
                gridRow: (i === 0) ? 'span 2' : 'span 1',
                borderRadius: '12px',
                transitionDelay: `${i * 80}ms`,
              }}>
              <img src={space.img} alt={space.name}
                className="absolute inset-0 w-full h-full object-cover transition-all duration-700 group-hover:scale-105"
                loading="lazy" />
              <div className="absolute inset-0" style={{
                background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.15) 50%, transparent 100%)'
              }}></div>
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C9A84C] scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
              <div className="absolute inset-0 flex flex-col justify-end p-6">
                <h3 className="font-serif text-lg text-white mb-1" style={{ fontFamily: serif, fontWeight: 400 }}>
                  {space.name}
                </h3>
                <p className="text-white/70 text-sm font-light">{space.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────── SERVICES ───────── */
function ServicesSection() {
  return (
    <section id="servicios" className="py-28 md:py-36 px-6" style={{ background: '#FFFFFF' }}>
      <div className="max-w-7xl mx-auto">
        <div className={`${revealClass} text-center mb-20`}>
          <span className="text-[11px] tracking-[0.4em] uppercase font-light block mb-4" style={{ color: gold }}>Por qué Jose Benitez</span>
          <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl" style={{ color: ink, fontFamily: serif, fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            Más que un salón
          </h2>
        </div>

        <div className="space-y-28 md:space-y-36">
          {services.map((svc, i) => (
            <div key={svc.title}
              className={`${revealClass} grid md:grid-cols-2 gap-10 md:gap-16 items-center`}
              style={{ transitionDelay: `${i * 100}ms` }}>
              <div className={`rounded-2xl overflow-hidden ${svc.reversed ? 'md:order-2' : ''}`}
                style={{ boxShadow: '0 8px 40px rgba(80,60,40,0.08), 0 2px 12px rgba(0,0,0,0.04)' }}>
                <img src={svc.img} alt={svc.title}
                  className="w-full h-72 md:h-96 object-cover transition-transform duration-700 hover:scale-105"
                  loading="lazy" />
              </div>
              <div className={svc.reversed ? 'md:order-1' : ''}>
                <span className="text-[11px] tracking-[0.35em] uppercase font-light block mb-3" style={{ color: gold }}>
                  {svc.tag}
                </span>
                <h3 className="font-serif text-3xl md:text-4xl mb-5" style={{ color: ink, fontFamily: serif, fontWeight: 400, lineHeight: 1.2, letterSpacing: '-0.01em' }}>
                  {svc.title}
                </h3>
                <p className="text-base leading-relaxed" style={{ color: '#6B6B6B', fontWeight: 300 }}>
                  {svc.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────── EVENT TYPES ───────── */
function EventTypesSection() {
  return (
    <section id="eventos" className="py-28 md:py-36 px-6" style={{ background: cream }}>
      <div className="max-w-6xl mx-auto">
        <div className={`${revealClass} text-center mb-16`}>
          <span className="text-[11px] tracking-[0.4em] uppercase font-light block mb-4" style={{ color: gold }}>Tipos de Evento</span>
          <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl mb-4" style={{ color: ink, fontFamily: serif, fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            Cada celebración es única
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
          {eventTypes.map((ev, i) => (
            <div key={ev.name} className={`${revealClass} rounded-2xl p-8 transition-all duration-500 group cursor-pointer`}
              style={{
                background: '#FFFFFF',
                border: '1px solid rgba(0,0,0,0.05)',
                transitionDelay: `${i * 60}ms`,
              }}>
              <div className="w-12 h-12 rounded-xl mb-5 flex items-center justify-center text-white font-serif text-xl font-bold transition-all duration-300 group-hover:scale-110"
                style={{ backgroundColor: ev.color }}>
                {ev.letter}
              </div>
              <h3 className="font-serif text-lg mb-1" style={{ color: ink, fontFamily: serif, fontWeight: 400 }}>
                {ev.name}
              </h3>
              <p className="text-sm" style={{ color: '#A3A3A3' }}>{ev.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────── TESTIMONIALS ───────── */
function TestimonialsSection() {
  return (
    <section className="py-28 md:py-36 px-6" style={{ background: '#FFFFFF' }}>
      <div className="max-w-6xl mx-auto">
        <div className={`${revealClass} text-center mb-16`}>
          <span className="text-[11px] tracking-[0.4em] uppercase font-light block mb-4" style={{ color: gold }}>Testimonios</span>
          <h2 className="font-serif text-4xl md:text-5xl" style={{ color: ink, fontFamily: serif, fontWeight: 400, letterSpacing: '-0.02em' }}>
            Lo que dicen nuestros clientes
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div key={i} className={`${revealClass} rounded-2xl p-8 transition-all duration-500`}
              style={{
                background: cream,
                border: '1px solid rgba(0,0,0,0.05)',
                transitionDelay: `${i * 80}ms`,
              }}>
              <div className="flex gap-1 mb-5">
                {stars.map((s) => (
                  <svg key={s} className="w-4 h-4" fill={gold} viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-sm leading-relaxed mb-6 italic" style={{ color: '#6B6B6B' }}>
                &ldquo;{t.text}&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                  style={{ background: `linear-gradient(135deg, #8B7332, ${gold})` }}>
                  {t.initial}
                </div>
                <div>
                  <p className="font-medium text-sm" style={{ color: ink }}>{t.name}</p>
                  <p className="text-xs" style={{ color: '#A3A3A3' }}>{t.meta}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────── CTA ───────── */
function CTASection() {
  return (
    <section className="py-28 md:py-36 px-6 relative overflow-hidden">
      <div className="absolute inset-0">
        <img src="https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1920&q=85" alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.85) 100%)'
        }}></div>
        <div className="absolute inset-0" style={{
          background: `radial-gradient(ellipse at center, rgba(201,168,76,0.08) 0%, transparent 70%)`
        }}></div>
      </div>

      <div className="relative z-10 max-w-3xl mx-auto text-center">
        <div className={`${revealClass}`}>
          <h2 className="text-white mb-6" style={{
            fontFamily: serif,
            fontSize: 'clamp(2rem, 4.5vw, 3.5rem)',
            lineHeight: 1.15,
            fontWeight: 400,
            letterSpacing: '-0.02em',
          }}>
            Tu celebración,{' '}
            <br />
            <span className="italic" style={{ color: `rgba(201,168,76,0.85)` }}>tu menú</span>
          </h2>
          <p className="text-white/60 text-base md:text-lg mb-12 max-w-xl mx-auto leading-relaxed font-light">
            Selecciona tus platos favoritos y envía tu propuesta. Nosotros nos encargamos del resto.
          </p>
          <Link href="/configurador">
            <button className="px-12 py-4 text-sm font-medium tracking-wider transition-all duration-500 rounded-lg"
              style={{
                background: `linear-gradient(135deg, ${gold} 0%, ${goldLight} 100%)`,
                color: ink,
                boxShadow: `0 4px 20px rgba(201,168,76,0.3)`,
              }}>
              Empezar a Diseñar
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ───────── FOOTER ───────── */
function FooterSection() {
  return (
    <footer className="py-16 px-6" style={{ background: ink, color: '#888888' }}>
      <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-12">
        <div>
<div className="text-lg mb-3 tracking-wide" style={{ color: gold, fontFamily: serif }}>Jose Benitez</div>
          <p className="text-sm leading-relaxed font-light" style={{ color: '#6B6B6B' }}>
            Salón de Celebraciones Premium en Sevilla.
          </p>
        </div>
        <div>
          <h4 className="text-white font-medium mb-4 text-sm tracking-wide">Contacto</h4>
          <div className="space-y-3 text-sm font-light" style={{ color: '#6B6B6B' }}>
            <div className="flex items-center gap-2">
              <span style={{ color: gold }}>→</span>
              <span>info@byalboroto.com</span>
            </div>
            <div className="flex items-center gap-2">
              <span style={{ color: gold }}>→</span>
              <span>+34 954 000 000</span>
            </div>
            <div className="flex items-center gap-2">
              <span style={{ color: gold }}>→</span>
              <span>Sevilla, España</span>
            </div>
          </div>
        </div>
        <div>
          <h4 className="text-white font-medium mb-4 text-sm tracking-wide">Enlaces</h4>
          <div className="space-y-3 text-sm font-light">
            <Link href="/configurador" className="block transition-colors" style={{ color: '#6B6B6B' }}>
              Configurador
            </Link>
            <Link href="/admin/login" className="block transition-colors" style={{ color: '#6B6B6B' }}>
              Panel Admin
            </Link>
          </div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto mt-12 pt-8 text-center text-xs font-light"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)', color: '#555555' }}>
        &copy; 2025 Jose Benitez. Todos los derechos reservados.
      </div>
    </footer>
  );
}

/* ───────── MAIN PAGE ───────── */
export default function HomePage() {
  useReveal();

  return (
    <>
      <style>{`
        .reveal {
          opacity: 0;
          transform: translateY(30px);
          transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1),
                      transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .reveal.visible {
          opacity: 1;
          transform: translateY(0);
        }
        .stagger > * {
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1),
                      transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .stagger.visible > * {
          opacity: 1;
          transform: translateY(0);
        }
        .stagger > *:nth-child(1) { transition-delay: 0ms; }
        .stagger > *:nth-child(2) { transition-delay: 80ms; }
        .stagger > *:nth-child(3) { transition-delay: 160ms; }
        .stagger > *:nth-child(4) { transition-delay: 240ms; }
        .stagger > *:nth-child(5) { transition-delay: 320ms; }
        .stagger > *:nth-child(6) { transition-delay: 400ms; }
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>

      <main style={{ background: '#FAF8F5', color: ink }}>
        <Nav />
        <HeroSection />
        <StatsBar />
        <SpacesGallery />
        <ServicesSection />
        <EventTypesSection />
        <TestimonialsSection />
        <CTASection />
        <FooterSection />
      </main>
    </>
  );
}
