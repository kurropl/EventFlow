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

export default function AdminDashboard() {
  const pathname = usePathname();
  const isKanban = pathname?.includes('kanban');
  const isCatalog = pathname?.includes('catalog');
  const isOperations = pathname?.includes('operations');
  const isTableMap = pathname?.includes('mapa-mesas');

  return (
    <AdminLayout>
      {isKanban && <KanbanPipeline />}
      {isCatalog && <CatalogCRUD />}
      {isOperations && <OperationsManager />}
      {isTableMap && <TableMapEditor />}
      {!isKanban && !isCatalog && !isOperations && !isTableMap && (
        <div className="p-8">
          <div className="text-center py-12">
            <h2 className="font-serif text-2xl text-stone-800 mb-4">Panel de Control J.Benitez</h2>
            <p className="text-stone-500 mb-8">Selecciona una sección del panel lateral para comenzar</p>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
              {[
                { title: 'Presupuestos', desc: 'Pipeline de cotizaciones', icon: '📋', path: '/admin/kanban' },
                { title: 'Catálogo', desc: 'Gestión de platos y complementos', icon: '🍽️', path: '/admin/catalog' },
                { title: 'Operaciones', desc: 'Gestión de eventos y operaciones', icon: '⚙️', path: '/admin/operations' },
                { title: 'Mapa de Mesas', desc: 'Editor drag & drop de mesas', icon: '🗺️', path: '/admin/mapa-mesas' },
              ].map((item) => (
                <a
                  key={item.title}
                  href={item.path}
                  className="p-6 rounded-xl border border-stone-200 bg-white hover:border-[#C9A84C] hover:shadow-lg transition-all duration-300 group"
                >
                  <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">{item.icon}</div>
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
