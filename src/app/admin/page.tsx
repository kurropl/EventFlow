'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/b2b/AdminLayout';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const LeadsCRM = dynamic(() => import('@/components/b2b/LeadsCRM'), { ssr: false });
const ClientsCRM = dynamic(() => import('@/components/b2b/ClientsCRM'), { ssr: false });
const KanbanPipeline = dynamic(() => import('@/components/b2b/KanbanPipeline'), { ssr: false });
const CalendarView = dynamic(() => import('@/components/b2b/CalendarView'), { ssr: false });
const CatalogCRUD = dynamic(() => import('@/components/b2b/CatalogCRUD'), { ssr: false });
const BillingPanel = dynamic(() => import('@/components/b2b/BillingPanel'), { ssr: false });
const OperationsManager = dynamic(() => import('@/components/b2b/OperationsManager'), { ssr: false });
const CocinaPanel = dynamic(() => import('@/components/b2b/CocinaPanel'), { ssr: false });
const StaffingManager = dynamic(() => import('@/components/b2b/StaffingManager'), { ssr: false });
const StockManager = dynamic(() => import('@/components/b2b/StockManager'), { ssr: false });
const TrazabilidadPanel = dynamic(() => import('@/components/b2b/TrazabilidadPanel'), { ssr: false });
const ProvidersManager = dynamic(() => import('@/components/b2b/ProvidersManager'), { ssr: false });
const HACCPPanel = dynamic(() => import('@/components/b2b/HACCPPanel'), { ssr: false });
const OCRScanner = dynamic(() => import('@/components/b2b/OCRScanner'), { ssr: false });

export default function AdminPage() {
  const [panel, setPanel] = useState<string>('');

  useEffect(() => {
    const path = window.location.pathname.replace('/admin', '');
    setPanel(path || '/');
  }, []);

  const isActive = (segment: string) => panel === segment || panel.startsWith(segment + '?');

  const navLinks = [
    { name: 'Panel', href: '/admin', segment: '/' },
    { name: 'Agenda', href: '/admin/agenda', segment: '/agenda' },
    { name: 'Kanban', href: '/admin/kanban', segment: '/kanban' },
    { name: 'Ocupación', href: '/admin/ocupacion', segment: '/ocupacion' },
    { name: 'Leads', href: '/admin/leads', segment: '/leads' },
    { name: 'Clientes', href: '/admin/clientes', segment: '/clientes' },
    { name: 'Evento', href: '/admin/evento', segment: '/evento' },
    { name: 'Invitados', href: '/admin/invitados', segment: '/invitados' },
    { name: 'Mesas', href: '/admin/mapa-mesas', segment: '/mapa-mesas' },
    { name: 'Catálogo', href: '/admin/catalog', segment: '/catalog' },
    { name: 'Cocina', href: '/admin/cocina', segment: '/cocina' },
    { name: 'Personal', href: '/admin/staffing', segment: '/staffing' },
    { name: 'Stock', href: '/admin/stock', segment: '/stock' },
    { name: 'Trazabilidad', href: '/admin/trazabilidad', segment: '/trazabilidad' },
    { name: 'APPCC', href: '/admin/checklist', segment: '/checklist' },
    { name: 'Proveedores', href: '/admin/proveedores', segment: '/proveedores' },
    { name: 'Facturación', href: '/admin/cobros', segment: '/cobros' },
    { name: 'Rentabilidad', href: '/admin/rentabilidad', segment: '/rentabilidad' },
    { name: 'Configuración', href: '/admin/config', segment: '/config' },
    { name: 'Webhooks', href: '/admin/webhooks', segment: '/webhooks' },
    { name: 'OCR', href: '/admin/ocr', segment: '/ocr' },
    { name: 'Trabajadores', href: '/admin/workers', segment: '/workers' },
    { name: 'Confirmación', href: '/admin/confirmacion', segment: '/confirmacion' },
  ];

  const fallback = (
    <div className="animate-pulse p-6 space-y-4">
      <div className="h-8 w-48 bg-cream-dark rounded" />
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-cream rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-cream rounded-xl" />
    </div>
  );

  const isLeads = isActive('/leads');
  const isClients = isActive('/clientes');
  const isKanban = isActive('/kanban');
  const isAgenda = isActive('/agenda');
  const isCatalog = isActive('/catalog');
  const isCobros = isActive('/cobros');
  const isOperations = isActive('/operations');
  const isCocina = isActive('/cocina');
  const isStaffing = isActive('/staffing');
  const isStock = isActive('/stock');
  const isTrazabilidad = isActive('/trazabilidad');
  const isProveedores = isActive('/proveedores');
  const isHACCP = isActive('/checklist');
  const isOCR = isActive('/ocr');

  return (
    <AdminLayout>
      <nav className="flex flex-wrap gap-2 p-4 border-b border-cream-dark bg-white/80 sticky top-0 z-10 overflow-x-auto">
        {navLinks.map(link => (
          <a
            key={link.href}
            href={link.href}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              isActive(link.segment) ? 'bg-gold text-white shadow-sm' : 'text-ink-soft hover:bg-cream hover:text-ink'
            }`}
          >
            {link.name}
          </a>
        ))}
      </nav>

      <div className="p-6">
        {isLeads && <Suspense fallback={fallback}><LeadsCRM /></Suspense>}
        {isClients && <Suspense fallback={fallback}><ClientsCRM /></Suspense>}
        {isKanban && <Suspense fallback={fallback}><KanbanPipeline /></Suspense>}
        {isAgenda && <Suspense fallback={fallback}><CalendarView /></Suspense>}
        {isCatalog && <Suspense fallback={fallback}><CatalogCRUD /></Suspense>}
        {isCobros && <Suspense fallback={fallback}><BillingPanel /></Suspense>}
        {isOperations && <Suspense fallback={fallback}><OperationsManager /></Suspense>}
        {isCocina && <Suspense fallback={fallback}><CocinaPanel /></Suspense>}
        {isStaffing && <Suspense fallback={fallback}><StaffingManager /></Suspense>}
        {isStock && <Suspense fallback={fallback}><StockManager /></Suspense>}
        {isTrazabilidad && <Suspense fallback={fallback}><TrazabilidadPanel /></Suspense>}
        {isProveedores && <Suspense fallback={fallback}><ProvidersManager /></Suspense>}
        {isHACCP && <Suspense fallback={fallback}><HACCPPanel /></Suspense>}
        {isOCR && <Suspense fallback={fallback}><OCRScanner /></Suspense>}
      </div>
    </AdminLayout>
  );
}