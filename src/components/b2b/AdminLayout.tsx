'use client';
/**
 * EventFlow — Admin Dashboard Layout (B2B)
 * 
 * Sidebar navigation + main content area.
 * Protected: only accessible via /admin
 * Uses internal tab state for navigation.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

type Tab = 'kanban' | 'catalog' | 'operations' | 'webhooks';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'kanban', label: 'Pipeline', icon: '📋' },
  { id: 'catalog', label: 'Catálogo', icon: '🍽️' },
  { id: 'operations', label: 'Operaciones', icon: '⚙️' },
  { id: 'webhooks', label: 'Webhooks', icon: '🔗' },
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const currentTab: Tab = TABS.find((t) => pathname?.includes(t.id))?.id || 'kanban';

  return (
    <div className="min-h-screen bg-ink-950 flex">
      {/* Sidebar */}
      <motion.aside
        initial={{ x: -240 }}
        animate={{ x: 0 }}
        className={`fixed lg:relative z-30 h-full bg-ink-900 border-r border-gold/20 flex flex-col
          ${sidebarOpen ? 'w-60' : 'w-0 lg:w-16'} overflow-hidden transition-all duration-300`}
      >
        {/* Logo */}
        <div className="p-4 border-b border-gold/10 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gold flex items-center justify-center flex-shrink-0">
            <span className="text-ink font-bold text-sm">AE</span>
          </div>
          {sidebarOpen && (
            <div>
              <div className="text-cream font-serif text-sm">Alboroto</div>
              <div className="text-gold/60 text-xs">Admin Panel</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {TABS.map((tab) => (
            <Link
              key={tab.id}
              href={`/admin/${tab.id}`}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                ${currentTab === tab.id
                  ? 'bg-gold/15 text-gold'
                  : 'text-cream/50 hover:text-cream hover:bg-cream/5'
                }`}
            >
              <span className="text-lg">{tab.icon}</span>
              {sidebarOpen && <span>{tab.label}</span>}
            </Link>
          ))}
        </nav>

        {/* B2C Link */}
        <div className="p-3 border-t border-gold/10">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-cream/40 hover:text-cream/70 transition-all"
          >
            <span className="text-lg">🌐</span>
            {sidebarOpen && <span>Ver Portal</span>}
          </Link>
        </div>
      </motion.aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 bg-ink-900/80 border-b border-gold/10 flex items-center px-4 gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-cream/50 hover:text-cream p-1 rounded hover:bg-cream/5"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-cream font-serif text-lg">
            {TABS.find((t) => t.id === currentTab)?.icon} {TABS.find((t) => t.id === currentTab)?.label}
          </h1>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
