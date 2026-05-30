'use client';
/**
 * J.Benitez — Admin Dashboard (B2B)
 * 
 * Mini ERP de gestión del salon de celebraciones con:
 * - Pipeline de presupuestos Kanban
 * - CRUD de catálogo
 * - Gestión de operaciones
 * - Editor de mapa de mesas drag & drop
 */

import { usePathname } from 'next/navigation';
import AdminLayout from '@/components/b2b/AdminLayout';
import KanbanPipeline from '@/components/b2b/KanbanPipeline';
import CatalogCRUD from '@/components/b2b/CatalogCRUD';
import OperationsManager from '@/components/b2b/OperationsManager';
import TableMapEditor from '@/components/b2b/TableMapEditor';
import WebhooksPanel from '@/components/b2b/WebhooksPanel';

export default function AdminDashboard() {
  const pathname = usePathname();
  const isKanban = pathname?.includes('kanban');
  const isCatalog = pathname?.includes('catalog');
  const isOperations = pathname?.includes('operations');
  const isTableMap = pathname?.includes('mapa-mesas');
  const isWebhooks = pathname?.includes('webhooks');

  return (
    <AdminLayout>
      {isKanban && <KanbanPipeline />}
      {isCatalog && <CatalogCRUD />}
      {isOperations && <OperationsManager />}
      {isTableMap && (
        <div
          className="rounded-2xl border border-[#ECECF1] bg-white overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
          style={{ height: 'calc(100vh - 120px)', minHeight: 500 }}
        >
          <TableMapEditor />
        </div>
      )}
      {isWebhooks && <WebhooksPanel />}
      {!isKanban && !isCatalog && !isOperations && !isTableMap && !isWebhooks && (
        <div className="p-8">
          <div className="text-center py-12">
            <h2 className="font-serif text-2xl text-stone-800 mb-4">Panel de Control J.Benitez</h2>
            <p className="text-stone-500 mb-8">Selecciona una sección del panel lateral para comenzar</p>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
              {[
                { title: 'Presupuestos', desc: 'Pipeline de cotizaciones', icon: 'P', path: '/admin/kanban' },
                { title: 'Catálogo', desc: 'Gestión de platos y complementos', icon: 'C', path: '/admin/catalog' },
                { title: 'Operaciones', desc: 'Gestión de eventos y operaciones', icon: 'O', path: '/admin/operations' },
                { title: 'Mapa de Mesas', desc: 'Editor drag & drop de mesas', icon: 'M', path: '/admin/mapa-mesas' },
              ].map((item) => (
                <a
                  key={item.title}
                  href={item.path}
                  className="p-6 rounded-xl border border-stone-200 bg-white hover:border-[#C9A84C] hover:shadow-lg transition-all duration-300 group"
                >
                  <div className="w-12 h-12 rounded-xl mb-4 flex items-center justify-center font-serif text-lg font-bold transition-all duration-300 group-hover:scale-110"
                    style={{ background: 'linear-gradient(135deg, #1A1A1A, #2D2416)', color: '#C9A84C' }}>
                    {item.icon}
                  </div>
                  <h3 className="font-serif text-lg text-stone-800 mb-2">{item.title}</h3>
                  <p className="text-sm text-stone-500">{item.desc}</p>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
