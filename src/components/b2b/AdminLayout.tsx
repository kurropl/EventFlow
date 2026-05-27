'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

type Tab = 'kanban' | 'catalog' | 'operations' | 'webhooks' | 'login';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'kanban', label: 'Pipeline', icon: 'K' },
  { id: 'catalog', label: 'Catálogo', icon: 'C' },
  { id: 'operations', label: 'Operaciones', icon: 'O' },
  { id: 'webhooks', label: 'Webhooks', icon: 'W' },
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = async () => {
    await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
    router.push('/admin/login');
    router.refresh();
  };

  const currentTab: Tab = TABS.find((t) => pathname?.includes(t.id))?.id || 'kanban';

  return (
    <div className="min-h-screen flex" style={{ background: '#0d0a06' }}>
      {/* Sidebar */}
      <motion.aside
        initial={{ x: -240 }}
        animate={{ x: 0 }}
        className={`fixed lg:relative z-30 h-full flex flex-col transition-all duration-300 overflow-hidden border-r ${
          sidebarOpen ? 'w-60' : 'w-0 lg:w-16'
        }`}
        style={{ background: '#14100a', borderColor: '#d4a54833' }}
      >
        {/* Logo */}
        <div className="p-4 flex items-center gap-3" style={{ borderBottom: '1px solid #d4a5481a' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#d4a548' }}>
            <span className="font-bold text-sm" style={{ color: '#0d0a06' }}>AE</span>
          </div>
          {sidebarOpen && (
            <div>
              <div className="font-serif text-sm" style={{ color: '#f8f3e6' }}>J. Benitez</div>
              <div style={{ color: '#d4a54899', fontSize: '0.7rem' }}>Admin Panel</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {TABS.map((tab) => (
            <Link
              key={tab.id}
              href={`/admin/${tab.id}`}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                currentTab === tab.id
                  ? 'text-[#d4a548]'
                  : 'text-[#f8f3e680] hover:text-[#f8f3e6]'
              }`}
              style={currentTab === tab.id ? { background: '#d4a54826' } : {}}
            >
              <span
                className="w-6 h-6 rounded text-xs flex items-center justify-center font-bold"
                style={currentTab === tab.id
                  ? { background: '#d4a5481a', color: '#d4a548' }
                  : { background: '#f8f3e60a', color: '#f8f3e680' }
                }
              >
                {tab.icon}
              </span>
              {sidebarOpen && <span>{tab.label}</span>}
            </Link>
          ))}
        </nav>

        {/* B2C Link */}
        <div className="p-3" style={{ borderTop: '1px solid #d4a5481a' }}>
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all"
            style={{ color: '#f8f3e666' }}
          >
            <span
              className="w-6 h-6 rounded text-xs flex items-center justify-center"
              style={{ background: '#f8f3e60a', color: '#f8f3e666' }}
            >
              V
            </span>
            {sidebarOpen && <span>Ver Portal</span>}
          </Link>
        </div>
      </motion.aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 flex items-center px-4 gap-3 border-b" style={{ background: '#14100acc', borderColor: '#d4a5481a' }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 rounded transition-all"
            style={{ color: '#f8f3e680' }}
          >
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
            style={{ color: '#f8f3e666' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#ef44441a'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#f8f3e666'; e.currentTarget.style.background = 'transparent'; }}
          >
            Salir
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}