/**
 * J.Benitez — Admin Layout (Server Component)
 * 
 * This is the server-side layout that wraps all admin pages.
 * It handles the sidebar, top bar, and navigation.
 * The actual page content is rendered as children.
 */

import Link from 'next/link';
import Icon from '@/components/shared/Icon';

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
      {
        id: 'operations', label: 'Operaciones', sub: 'Eventos en curso', href: '/admin/operations',
        children: [
          { id: 'mapa-mesas', label: 'Mapa de mesas', sub: 'Disposición drag & drop', href: '/admin/mapa-mesas' },
        ],
      },
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
      { id: 'webhooks', label: 'Webhooks', sub: 'Integraciones y reglas', href: '/admin/webhooks' },
    ],
  },
];

// Flatten for path matching
const ALL_ITEMS = GROUPS.flatMap(g => [
  ...g.items,
  ...g.items.flatMap(i => i.children || []),
]);

interface AdminLayoutProps {
  children: React.ReactNode;
  currentPathname: string;
}

export default function AdminLayout({ children, currentPathname }: AdminLayoutProps) {
  // Determine current item and parent
  const currentItem = ALL_ITEMS.find(t => {
    if (currentPathname === '/admin' || currentPathname === '/admin/') return t.id === 'dashboard';
    return t.id !== 'dashboard' && currentPathname?.includes(t.id);
  });
  const currentLabel = currentItem?.label || 'Resumen';
  const currentSub = currentItem?.sub || 'Panel general';

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F5F5F8] text-[#1A1A1A]">
      {/* ===== DESKTOP SIDEBAR ===== */}
      <aside className="hidden md:flex sticky top-0 h-screen flex-col bg-white border-r border-[#ECECF1] w-64">
        <div className="h-[72px] px-5 flex items-center border-b border-[#F0F0F4]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
              style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>
              <span className="font-bold text-sm text-white" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>JB</span>
            </div>
            <div className="min-w-0">
              <div className="font-serif text-[15px] leading-tight text-[#1A1A1A] truncate" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>J. Benitez</div>
              <div className="text-[11px] text-[#9CA3AF] tracking-wide">Panel de gestión</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto">
          {GROUPS.map(group => (
            <div key={group.id} className="mb-1">
              <div className="px-3 py-1.5 mb-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#B0B0B8]">
                {group.label}
              </div>
              {group.items.map(item => {
                const isActive = currentItem?.id === item.id;
                const hasActiveChild = item.children?.some(c => c.id === currentItem?.id);
                return (
                  <div key={item.id}>
                    <Link
                      href={item.href}
                      className={`group flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all ${
                        isActive || hasActiveChild
                          ? 'bg-[#FBF6E9] text-[#1A1A1A]'
                          : 'text-[#6B7280] hover:bg-[#F5F5F8] hover:text-[#1A1A1A]'
                      }`}
                    >
                      <span className={isActive || hasActiveChild ? 'text-[#C9A84C]' : 'text-[#9CA3AF] group-hover:text-[#6B7280]'}>
                        <Icon name={item.id} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className={`block leading-tight font-medium ${isActive || hasActiveChild ? 'text-[#1A1A1A]' : ''}`}>{item.label}</span>
                        <span className="block text-[11px] text-[#A8A8B0] leading-tight">{item.sub}</span>
                      </span>
                      {(isActive || hasActiveChild) && <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C]" />}
                    </Link>
                    {item.children && (isActive || hasActiveChild) && (
                      <div className="ml-9 mt-0.5 space-y-0.5 border-l-2 border-[#E8DCC8] pl-2">
                        {item.children.map(child => {
                          const childActive = currentItem?.id === child.id;
                          return (
                            <Link
                              key={child.id}
                              href={child.href}
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
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-[#F0F0F4]">
          <Link href="/" title="Ver portal" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#6B7280] hover:bg-[#F5F5F8] hover:text-[#1A1A1A] transition-all">
            <span className="text-[#9CA3AF]"><Icon name="portal" /></span>
            <span className="font-medium">Ver portal</span>
          </Link>
        </div>
      </aside>

      {/* ===== MAIN ===== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop top bar */}
        <header className="hidden md:flex h-[72px] items-center px-5 gap-4 bg-white/80 backdrop-blur-xl border-b border-[#ECECF1] sticky top-0 z-20">
          <div className="flex-1 min-w-0">
            <h1 className="font-serif text-lg text-[#1A1A1A] leading-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{currentLabel}</h1>
            <p className="text-[12px] text-[#9CA3AF] leading-tight">{currentSub}</p>
          </div>
          <form action="/api/auth/login" method="POST" className="flex items-center gap-2">
            <input type="hidden" name="action" value="logout" />
            <button type="submit" className="flex items-center gap-2 text-sm px-3.5 py-2 rounded-lg text-[#6B7280] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-all">
              <Icon name="logout" className="w-4 h-4" />
              <span>Salir</span>
            </button>
          </form>
        </header>
        <main className="flex-1 overflow-auto p-4 sm:p-5 md:p-7">
          {children}
        </main>
      </div>
    </div>
  );
}
