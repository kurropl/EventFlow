'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

type Tab = 'dashboard' | 'agenda' | 'kanban' | 'clientes' | 'cobros' | 'invitados' | 'catalog' | 'operations' | 'mapa-mesas' | 'webhooks' | 'login';

/* Inline icon set — clean line icons, no external dependency */
const Icon = ({ name, className = 'w-[18px] h-[18px]' }: { name: string; className?: string }) => {
  const p: Record<string, React.ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
    agenda: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></>,
    kanban: <><rect x="3" y="3" width="6" height="18" rx="1.5" /><rect x="15" y="3" width="6" height="11" rx="1.5" /></>,
    clientes: <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0M17 11a3 3 0 1 0-2-5.2M16 20a6 6 0 0 0-1.5-4" /></>,
    cobros: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></>,
    invitados: <><path d="M16 11l2 2 4-4" /><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0" /></>,
    catalog: <><path d="M4 6h16M4 12h16M4 18h10" /></>,
    operations: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 6 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H0" /></>,
    'mapa-mesas': <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    webhooks: <><path d="M18 8a6 6 0 0 0-9.3-5M6 8a6 6 0 0 0 4 10.5M12 18a6 6 0 0 0 6-6" /><circle cx="12" cy="8" r="2" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="14" r="2" /></>,
    portal: <><path d="M3 12l9-9 9 9" /><path d="M5 10v10h14V10" /></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></>,
    menu: <><path d="M3 6h18M3 12h18M3 18h18" /></>,
    close: <><path d="M18 6 6 18M6 6l12 12" /></>,
  };
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {p[name]}
    </svg>
  );
};

const TABS: { id: Tab; label: string; sub: string; href: string }[] = [
  { id: 'dashboard', label: 'Resumen', sub: 'Panel general', href: '/admin' },
  { id: 'agenda', label: 'Agenda', sub: 'Calendario y citas', href: '/admin/agenda' },
  { id: 'kanban', label: 'Pipeline', sub: 'Presupuestos', href: '/admin/kanban' },
  { id: 'clientes', label: 'Clientes', sub: 'CRM y fichas', href: '/admin/clientes' },
  { id: 'cobros', label: 'Cobros', sub: 'Pagos y vencimientos', href: '/admin/cobros' },
  { id: 'invitados', label: 'Invitados', sub: 'RSVP y dietas', href: '/admin/invitados' },
  { id: 'catalog', label: 'Catálogo', sub: 'Platos y precios', href: '/admin/catalog' },
  { id: 'operations', label: 'Operaciones', sub: 'Eventos en curso', href: '/admin/operations' },
  { id: 'mapa-mesas', label: 'Mapa de Mesas', sub: 'Distribución', href: '/admin/mapa-mesas' },
  { id: 'webhooks', label: 'Webhooks', sub: 'Integraciones', href: '/admin/webhooks' },
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleLogout = async () => {
    await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
    router.push('/admin/login');
    router.refresh();
  };

  const currentTab: Tab =
    pathname === '/admin' || pathname === '/admin/'
      ? 'dashboard'
      : TABS.find((t) => t.id !== 'dashboard' && pathname?.includes(t.id))?.id || 'dashboard';
  const current = TABS.find((t) => t.id === currentTab);

  // Reusable nav list (used by desktop sidebar and mobile drawer)
  const NavList = ({ onNavigate, collapsed = false }: { onNavigate?: () => void; collapsed?: boolean }) => (
    <>
      {!collapsed && (
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#B0B0B8]">Gestión</p>
      )}
      {TABS.map((tab) => {
        const active = currentTab === tab.id;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            title={tab.label}
            onClick={onNavigate}
            className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
              active ? 'bg-[#FBF6E9] text-[#1A1A1A]' : 'text-[#6B7280] hover:bg-[#F5F5F8] hover:text-[#1A1A1A]'
            }`}
          >
            <span className={active ? 'text-[#C9A84C]' : 'text-[#9CA3AF] group-hover:text-[#6B7280]'}>
              <Icon name={tab.id} />
            </span>
            {!collapsed && (
              <span className="flex-1 min-w-0">
                <span className={`block leading-tight font-medium ${active ? 'text-[#1A1A1A]' : ''}`}>{tab.label}</span>
                <span className="block text-[11px] text-[#A8A8B0] leading-tight">{tab.sub}</span>
              </span>
            )}
            {active && !collapsed && <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C]" />}
          </Link>
        );
      })}
    </>
  );

  const Brand = ({ subtitle = 'Panel de gestión' }: { subtitle?: string }) => (
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
        style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>
        <span className="font-bold text-sm text-white" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>JB</span>
      </div>
      <div className="min-w-0">
        <div className="font-serif text-[15px] leading-tight text-[#1A1A1A] truncate" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>J. Benitez</div>
        <div className="text-[11px] text-[#9CA3AF] tracking-wide">{subtitle}</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F5F5F8] text-[#1A1A1A]">
      {/* ===== MOBILE TOP BAR ===== */}
      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between px-4 h-16 bg-white/90 backdrop-blur-xl border-b border-[#ECECF1]">
        <button onClick={() => setMobileNavOpen(true)} className="p-2 -ml-2 rounded-lg text-[#6B7280] hover:bg-[#F5F5F8]" aria-label="Abrir menú">
          <Icon name="menu" className="w-5 h-5" />
        </button>
        <span className="font-serif text-base text-[#1A1A1A]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{current?.label}</span>
        <button onClick={handleLogout} className="p-2 -mr-2 rounded-lg text-[#6B7280] hover:text-[#DC2626] hover:bg-[#FEF2F2]" aria-label="Salir">
          <Icon name="logout" className="w-5 h-5" />
        </button>
      </header>

      {/* ===== MOBILE DRAWER ===== */}
      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-50" onClick={() => setMobileNavOpen(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white border-r border-[#ECECF1] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="h-16 px-4 flex items-center justify-between border-b border-[#F0F0F4]">
              <Brand />
              <button onClick={() => setMobileNavOpen(false)} className="p-2 rounded-lg text-[#9CA3AF] hover:bg-[#F5F5F8]" aria-label="Cerrar">
                <Icon name="close" className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto"><NavList onNavigate={() => setMobileNavOpen(false)} /></nav>
            <div className="px-3 py-4 border-t border-[#F0F0F4]">
              <Link href="/" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#6B7280] hover:bg-[#F5F5F8]">
                <span className="text-[#9CA3AF]"><Icon name="portal" /></span>
                <span className="font-medium">Ver portal</span>
              </Link>
            </div>
          </aside>
        </div>
      )}

      {/* ===== DESKTOP SIDEBAR ===== */}
      <motion.aside
        initial={{ x: -240 }}
        animate={{ x: 0 }}
        className={`hidden md:flex sticky top-0 h-screen flex-col bg-white border-r border-[#ECECF1] transition-all duration-300 overflow-hidden ${
          sidebarOpen ? 'w-64' : 'w-[72px]'
        }`}
      >
        <div className="h-[72px] px-5 flex items-center border-b border-[#F0F0F4]">
          {sidebarOpen ? <Brand /> : (
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm mx-auto" style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>
              <span className="font-bold text-sm text-white" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>JB</span>
            </div>
          )}
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto"><NavList collapsed={!sidebarOpen} /></nav>
        <div className="px-3 py-4 border-t border-[#F0F0F4]">
          <Link href="/" title="Ver portal" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#6B7280] hover:bg-[#F5F5F8] hover:text-[#1A1A1A] transition-all">
            <span className="text-[#9CA3AF]"><Icon name="portal" /></span>
            {sidebarOpen && <span className="font-medium">Ver portal</span>}
          </Link>
        </div>
      </motion.aside>

      {/* ===== MAIN ===== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop top bar */}
        <header className="hidden md:flex h-[72px] items-center px-5 gap-4 bg-white/80 backdrop-blur-xl border-b border-[#ECECF1] sticky top-0 z-20">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-lg text-[#6B7280] hover:bg-[#F5F5F8] hover:text-[#1A1A1A] transition-all" aria-label="Alternar menú">
            <Icon name="menu" className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-serif text-lg text-[#1A1A1A] leading-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{current?.label}</h1>
            <p className="text-[12px] text-[#9CA3AF] leading-tight">{current?.sub}</p>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-sm px-3.5 py-2 rounded-lg text-[#6B7280] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-all">
            <Icon name="logout" className="w-4 h-4" />
            <span>Salir</span>
          </button>
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-5 md:p-7">{children}</main>
      </div>
    </div>
  );
}
