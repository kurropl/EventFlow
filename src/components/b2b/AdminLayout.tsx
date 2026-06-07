'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Icon from '../shared/Icon';

// ── Menu structure ──────────────────────────────────────────
type MenuItem = {
  id: string;
  label: string;
  sub: string;
  href: string;
  children?: { id: string; label: string; sub: string; href: string }[];
};

type MenuGroup = {
  id: string;
  label: string;
  items: MenuItem[];
};

const GROUPS: MenuGroup[] = [
  {
    id: 'panel',
    label: 'Panel principal',
    items: [
      { id: 'dashboard', label: 'Resumen', sub: 'Panel general', href: '/admin' },
    ],
  },
  {
    id: 'captacion',
    label: 'Captación',
    items: [
      { id: 'leads', label: 'Leads', sub: 'Prospectos y presupuestos', href: '/admin/leads' },
      { id: 'kanban', label: 'Pipeline', sub: 'Presupuestos', href: '/admin/kanban' },
      { id: 'clientes', label: 'Clientes', sub: 'CRM y fichas', href: '/admin/clientes' },
    ],
  },
  {
    id: 'planificacion',
    label: 'Planificación',
    items: [
      { id: 'agenda', label: 'Agenda', sub: 'Calendario y citas', href: '/admin/agenda' },
    ],
  },
  {
    id: 'evento',
    label: 'Evento',
    items: [
      { id: 'catalog', label: 'Catálogo', sub: 'Platos y precios', href: '/admin/catalog' },
      { id: 'stock', label: 'Stock', sub: 'Inventario y suministros', href: '/admin/stock' },
      { id: 'operations', label: 'Operaciones', sub: 'Eventos en curso', href: '/admin/operations' },
      { id: 'invitados', label: 'Invitados', sub: 'RSVP y dietas', href: '/admin/invitados' },
    ],
  },
  {
    id: 'finanzas',
    label: 'Finanzas',
    items: [
      { id: 'cobros', label: 'Cobros', sub: 'Pagos y vencimientos', href: '/admin/cobros' },
    ],
  },
  {
    id: 'configuracion',
    label: 'Configuración',
    items: [
      { id: 'proveedores', label: 'Proveedores', sub: 'Suministros y partners', href: '/admin/proveedores' },
      // Webhooks oculto — solo técnico, no visible en sidebar
      // { id: 'webhooks', label: 'Webhooks', sub: 'Integraciones y reglas', href: '/admin/webhooks' },
    ],
  },
];

const ALL_ITEMS = GROUPS.flatMap(g => [
  ...g.items,
  ...g.items.flatMap(i => i.children || []),
]);

// ── Component ────────────────────────────────────────────────
interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    panel: true,
    evento: true,
  });

  // Determine current item
  const currentItem = ALL_ITEMS.find(t => {
    if (pathname === '/admin' || pathname === '/admin/') return t.id === 'dashboard';
    return t.id !== 'dashboard' && pathname?.includes(t.id);
  });
  const currentLabel = currentItem?.label || 'Resumen';
  const currentSub = currentItem?.sub || 'Panel general';

  const handleLogout = async () => {
    await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
    router.push('/admin/login');
    router.refresh();
  };

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

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

  // ── NavList ──
  const NavList = ({ onNavigate, collapsed = false }: { onNavigate?: () => void; collapsed?: boolean }) => (
    <>
      {GROUPS.map(group => {
        const hasActiveDescendant = group.items.some(i => {
          if (i.id === currentItem?.id) return true;
          if (i.children) return i.children.some(c => c.id === currentItem?.id);
          return false;
        });
        const isExpanded = expandedGroups[group.id] !== false;
        const showExpanded = isExpanded || hasActiveDescendant;

        if (collapsed && !hasActiveDescendant) return null;

        return (
          <div key={group.id} className="mb-1">
            {!collapsed && (
              <button
                onClick={() => toggleGroup(group.id)}
                className={`w-full flex items-center justify-between px-3 py-1.5 mb-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                  hasActiveDescendant ? 'text-[#C9A84C]' : 'text-[#B0B0B8] hover:text-[#8A8A92]'
                }`}
              >
                <span>{group.label}</span>
                <span className={`opacity-50 transition-transform duration-200 ${showExpanded ? 'rotate-180' : ''}`}>
                  <Icon name="chevronDown" className="w-3 h-3" />
                </span>
              </button>
            )}

            <div
              className="overflow-hidden transition-all duration-200 ease-in-out"
              style={{
                maxHeight: showExpanded ? '2000px' : '0px',
                opacity: showExpanded ? 1 : 0,
              }}
            >
              {group.items.map(item => {
                const isActive = currentItem?.id === item.id;
                const hasActiveChild = item.children?.some(c => c.id === currentItem?.id);
                const showChildren = item.children && (isActive || hasActiveChild);

                return (
                  <div key={item.id}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      title={item.label}
                      className={`group flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all ${
                        isActive || hasActiveChild
                          ? 'bg-[#FBF6E9] text-[#1A1A1A]'
                          : 'text-[#6B7280] hover:bg-[#F5F5F8] hover:text-[#1A1A1A]'
                      }`}
                    >
                      <span className={isActive || hasActiveChild ? 'text-[#C9A84C]' : 'text-[#9CA3AF] group-hover:text-[#6B7280]'}>
                        <Icon name={item.id} />
                      </span>
                      {!collapsed && (
                        <span className="flex-1 min-w-0">
                          <span className={`block leading-tight font-medium ${isActive || hasActiveChild ? 'text-[#1A1A1A]' : ''}`}>{item.label}</span>
                          <span className="block text-[11px] text-[#A8A8B0] leading-tight">{item.sub}</span>
                        </span>
                      )}
                      {(isActive || hasActiveChild) && !collapsed && <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C]" />}
                    </Link>

                    {item.children && showChildren && !collapsed && (
                      <div
                        className="ml-9 mt-0.5 space-y-0.5 border-l-2 border-[#E8DCC8] pl-2 transition-all duration-200"
                        style={{
                          maxHeight: showChildren ? '500px' : '0px',
                          opacity: showChildren ? 1 : 0,
                          overflow: 'hidden',
                        }}
                      >
                        {item.children.map(child => {
                          const childActive = currentItem?.id === child.id;
                          return (
                            <Link
                              key={child.id}
                              href={child.href}
                              onClick={onNavigate}
                              title={child.label}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all ${
                                childActive
                                  ? 'bg-[#FBF6E9] text-[#1A1A1A] font-medium'
                                  : 'text-[#6B7280] hover:bg-[#F5F5F8] hover:text-[#1A1A1A]'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${childActive ? 'bg-[#C9A84C]' : 'bg-[#D0D0D8]'}`} />
                              <span>{child.label}</span>
                              {childActive && <span className="w-1 h-1 rounded-full bg-[#C9A84C] ml-auto" />}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F5F5F8] text-[#1A1A1A]">
      {/* ===== MOBILE TOP BAR ===== */}
      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between px-4 h-16 bg-white/90 backdrop-blur-xl border-b border-[#ECECF1]">
        <button onClick={() => setMobileNavOpen(true)} className="p-2 -ml-2 rounded-lg text-[#6B7280] hover:bg-[#F5F5F8]" aria-label="Abrir menú">
          <Icon name="menu" className="w-5 h-5" />
        </button>
        <span className="font-serif text-base text-[#1A1A1A]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{currentLabel}</span>
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
            <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto"><NavList onNavigate={() => setMobileNavOpen(false)} /></nav>
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
      <aside
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
        <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto">
          <NavList collapsed={!sidebarOpen} />
        </nav>
        <div className="px-3 py-4 border-t border-[#F0F0F4]">
          <Link href="/" title="Ver portal" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#6B7280] hover:bg-[#F5F5F8] hover:text-[#1A1A1A] transition-all">
            <span className="text-[#9CA3AF]"><Icon name="portal" /></span>
            {sidebarOpen && <span className="font-medium">Ver portal</span>}
          </Link>
        </div>
      </aside>

      {/* ===== MAIN ===== */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="hidden md:flex h-[72px] items-center px-5 gap-4 bg-white/80 backdrop-blur-xl border-b border-[#ECECF1] sticky top-0 z-20">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-lg text-[#6B7280] hover:bg-[#F5F5F8] hover:text-[#1A1A1A] transition-all" aria-label="Alternar menú">
            <Icon name="menu" className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-serif text-lg text-[#1A1A1A] leading-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{currentLabel}</h1>
            <p className="text-[12px] text-[#9CA3AF] leading-tight">{currentSub}</p>
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
