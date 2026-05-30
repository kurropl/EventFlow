'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

type Tab = 'kanban' | 'catalog' | 'operations' | 'mapa-mesas' | 'webhooks';

const TABS: { id: Tab; label: string; icon: string; desc: string }[] = [
  { id: 'kanban', label: 'Pipeline', icon: 'K', desc: 'Presupuestos y cotizaciones' },
  { id: 'catalog', label: 'Catálogo', icon: 'C', desc: 'Platos y menús' },
  { id: 'operations', label: 'Operaciones', icon: 'O', desc: 'Gestión del día' },
  { id: 'mapa-mesas', label: 'Mapa Mesas', icon: 'M', desc: 'Distribución del salón' },
  { id: 'webhooks', label: 'Webhooks', icon: 'W', desc: 'Integraciones' },
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const currentTab: Tab = TABS.find((t) => pathname?.includes(t.id))?.id || 'kanban';

  const handleLogout = async () => {
    await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
    router.push('/admin/login');
    router.refresh();
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row" style={{ background: '#0d0a06' }}>
      {/* MOBILE TOP BAR */}
      <header className="md:hidden flex items-center justify-between px-4 h-14 border-b z-40"
        style={{ background: '#14100a', borderColor: '#d4a5481a' }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="p-1 rounded"
            style={{ color: '#f8f3e680' }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d={mobileNavOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
            </svg>
          </button>
          <span className="font-serif text-sm" style={{ color: '#f8f3e6' }}>J. Benitez Admin</span>
        </div>
        <button onClick={handleLogout} className="text-xs px-3 py-1.5 rounded" style={{ color: '#f8f3e666' }}>
          Salir
        </button>
      </header>

      {/* MOBILE SIDEBAR DRAWER */}
      {isMobile && mobileNavOpen && (
        <div className="fixed inset-0 z-30" onClick={() => setMobileNavOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <aside
            className="absolute left-0 top-14 bottom-0 w-64 flex flex-col border-r z-40"
            style={{ background: '#14100a', borderColor: '#d4a54833' }}
            onClick={(e) => e.stopPropagation()}>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {TABS.map((tab) => (
                <Link
                  key={tab.id}
                  href={`/admin/${tab.id}`}
                  onClick={() => setMobileNavOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all`}
                  style={
                    currentTab === tab.id
                      ? { background: '#d4a54826', color: '#d4a548' }
                      : { color: '#f8f3e680' }
                  }>
                  <span
                    className="w-7 h-7 rounded text-xs flex items-center justify-center font-bold flex-shrink-0"
                    style={
                      currentTab === tab.id
                        ? { background: '#d4a5481a', color: '#d4a548' }
                        : { background: '#f8f3e60a', color: '#f8f3e680' }
                    }>
                    {tab.icon}
                  </span>
                  <div>
                    <div>{tab.label}</div>
                    <div className="text-xs opacity-60 font-normal">{tab.desc}</div>
                  </div>
                </Link>
              ))}
            </nav>
            <div className="p-3 border-t" style={{ borderColor: '#d4a5481a' }}>
              <Link
                href="/"
                onClick={() => setMobileNavOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all"
                style={{ color: '#f8f3e666' }}>
                <span className="w-7 h-7 rounded text-xs flex items-center justify-center flex-shrink-0"
                  style={{ background: '#f8f3e60a', color: '#f8f3e666' }}>V</span>
                <span>Ver Portal Web</span>
              </Link>
            </div>
          </aside>
        </div>
      )}

      {/* DESKTOP SIDEBAR */}
      <aside
        className={`hidden md:flex flex-col transition-all duration-300 overflow-hidden border-r ${
          sidebarOpen ? 'w-60' : 'w-16'
        }`}
        style={{ background: '#14100a', borderColor: '#d4a54833' }}>
        <div className="p-4 flex items-center gap-3 min-h-[60px]" style={{ borderBottom: '1px solid #d4a5481a' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#d4a548' }}>
            <span className="font-bold text-sm" style={{ color: '#0d0a06', fontFamily: "'Playfair Display', Georgia, serif" }}>JB</span>
          </div>
          {sidebarOpen && (
            <div>
              <div className="font-serif text-sm" style={{ color: '#f8f3e6' }}>J. Benitez</div>
              <div style={{ color: '#d4a54899', fontSize: '0.7rem' }}>Admin Panel</div>
            </div>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {TABS.map((tab) => (
            <Link
              key={tab.id}
              href={`/admin/${tab.id}`}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all`}
              style={
                currentTab === tab.id
                  ? { background: '#d4a54826', color: '#d4a548' }
                  : { color: '#f8f3e680' }
              }>
              <span
                className="w-6 h-6 rounded text-xs flex items-center justify-center font-bold flex-shrink-0"
                style={
                  currentTab === tab.id
                    ? { background: '#d4a5481a', color: '#d4a548' }
                    : { background: '#f8f3e60a', color: '#f8f3e680' }
                }>
                {tab.icon}
              </span>
              {sidebarOpen && (
                <div className="overflow-hidden">
                  <div>{tab.label}</div>
                  <div className="text-xs opacity-60 font-normal truncate">{tab.desc}</div>
                </div>
              )}
            </Link>
          ))}
        </nav>

        <div className="p-3" style={{ borderTop: '1px solid #d4a5481a' }}>
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all"
            style={{ color: '#f8f3e666' }}>
            <span className="w-6 h-6 rounded text-xs flex items-center justify-center flex-shrink-0"
              style={{ background: '#f8f3e60a', color: '#f8f3e666' }}>V</span>
            {sidebarOpen && <span>Ver Portal Web</span>}
          </Link>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="hidden md:flex h-14 items-center px-4 gap-3 border-b flex-shrink-0"
          style={{ background: '#14100acc', borderColor: '#d4a5481a' }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 rounded transition-all"
            style={{ color: '#f8f3e680' }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="font-serif text-lg flex-1" style={{ color: '#f8f3e6' }}>
            {TABS.find((t) => t.id === currentTab)?.label}
          </h1>
          <button
            onClick={handleLogout}
            className="text-xs px-3 py-1.5 rounded transition-all"
            style={{ color: '#f8f3e666' }}>
            Salir
          </button>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="p-3 md:p-6 max-w-full">
            {children}
          </div>
        </main>

        {/* MOBILE BOTTOM NAV */}
        <nav className="md:hidden flex border-t flex-shrink-0 overflow-x-auto"
          style={{ background: '#14100a', borderColor: '#d4a5481a' }}>
          {TABS.map((tab) => (
            <Link
              key={tab.id}
              href={`/admin/${tab.id}`}
              className="flex-1 flex flex-col items-center py-2 px-1 text-[10px] font-medium transition-all min-w-0"
              style={
                currentTab === tab.id
                  ? { color: '#d4a548', background: '#d4a5480d' }
                  : { color: '#f8f3e680' }
              }>
              <span className="w-6 h-6 rounded text-xs flex items-center justify-center font-bold mb-0.5"
                style={
                  currentTab === tab.id
                    ? { background: '#d4a5481a', color: '#d4a548' }
                    : { background: 'transparent', color: '#f8f3e680' }
                }>
                {tab.icon}
              </span>
              <span className="truncate w-full text-center">{tab.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
