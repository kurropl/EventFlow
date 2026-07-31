'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';

// ============================================================
// Portal Layout — Layout principal del portal del cliente
// ============================================================

interface PortalData {
  portal: {
    id: string;
    status: string;
    freezeDate: string | null;
  };
  event: {
    eventId: string;
    clientName: string;
    eventType: string;
    eventDate: string;
    guestCount: number;
    status: string;
    totalPvp: number;
    totalPaid: number;
    pendingAmount: number;
  };
}

interface PortalLayoutProps {
  children: React.ReactNode;
  params: { token: string };
}

export default function PortalLayout({ children, params }: PortalLayoutProps) {
  const { token } = params;
  const pathname = usePathname();
  const router = useRouter();
  const [portalData, setPortalData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPortal() {
      try {
        const response = await fetch(`/api/portal/${token}`);
        const data = await response.json();
        
        if (!data.success) {
          setError(data.error || 'Portal no encontrado');
          return;
        }

        setPortalData(data);
      } catch (err) {
        setError('Error al cargar el portal');
      } finally {
        setLoading(false);
      }
    }

    loadPortal();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FAF8F5] to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#C9A84C] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#6B7280]">Cargando portal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FAF8F5] to-white flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🔒</span>
          </div>
          <h1 className="text-xl font-semibold text-[#1A1A1A] mb-2">Acceso no disponible</h1>
          <p className="text-[#6B7280] mb-6">{error}</p>
          <Link
            href="/"
            className="inline-block bg-[#C9A84C] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#B8973D] transition-colors"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  const isReadOnly = portalData?.portal.status === 'congelado';
  const eventDate = portalData?.event.eventDate 
    ? new Date(portalData.event.eventDate).toLocaleDateString('es-ES', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      })
    : '';

  // Calculate days until event
  const daysUntilEvent = portalData?.event.eventDate 
    ? Math.ceil((new Date(portalData.event.eventDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  // Navigation items
  const navItems = [
    { href: `/portal/${token}`, label: 'Inicio', icon: '🏠' },
    { href: `/portal/${token}/guests`, label: 'Invitados', icon: '👥' },
    { href: `/portal/${token}/menu`, label: 'Menú', icon: '🍽️' },
    { href: `/portal/${token}/extras`, label: 'Extras', icon: '✨' },
    { href: `/portal/${token}/messages`, label: 'Mensajes', icon: '💬' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAF8F5] to-white">
      {/* Header */}
      <header className="bg-white border-b border-[#E5E7EB] sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-[#1A1A1A]">
                {portalData?.event.eventType || 'Mi evento'}
              </h1>
              <p className="text-sm text-[#6B7280]">{eventDate}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-[#1A1A1A]">
                {portalData?.event.clientName}
              </p>
              {daysUntilEvent !== null && daysUntilEvent > 0 && (
                <p className="text-xs text-[#C9A84C] font-medium">
                  {daysUntilEvent} días para tu evento
                </p>
              )}
            </div>
          </div>

          {/* Frozen banner */}
          {isReadOnly && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 flex items-center gap-2">
              <span className="text-amber-600">⚠️</span>
              <span className="text-sm text-amber-700">
                Portal congelado — Solo lectura permitida
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex overflow-x-auto gap-1 -mb-px">
            {navItems.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== `/portal/${token}` && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-[#C9A84C] text-[#C9A84C]'
                      : 'border-transparent text-[#6B7280] hover:text-[#1A1A1A] hover:border-[#E5E7EB]'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E5E7EB] mt-8">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center">
          <p className="text-sm text-[#6B7280]">
            J.Benitez — Salón de Celebraciones Premium en Sevilla
          </p>
          <p className="text-xs text-[#9CA3AF] mt-1">
            ¿Necesitas ayuda? Contacta con nosotros
          </p>
        </div>
      </footer>
    </div>
  );
}
