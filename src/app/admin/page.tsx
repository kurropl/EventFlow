'use client';
/**
 * EventFlow — Admin Dashboard (B2B)
 * 
 * Entry point for the admin panel.
 * Uses usePathname to determine active tab.
 */

import { usePathname } from 'next/navigation';
import AdminLayout from '@/components/b2b/AdminLayout';
import KanbanPipeline from '@/components/b2b/KanbanPipeline';
import CatalogCRUD from '@/components/b2b/CatalogCRUD';
import OperationsManager from '@/components/b2b/OperationsManager';

export default function AdminDashboard() {
  const pathname = usePathname();
  const isKanban = pathname?.includes('kanban');
  const isCatalog = pathname?.includes('catalog');
  const isOperations = pathname?.includes('operations');

  return (
    <AdminLayout>
      {isKanban && <KanbanPipeline />}
      {isCatalog && <CatalogCRUD />}
      {isOperations && <OperationsManager />}
      {!isKanban && !isCatalog && !isOperations && (
        <div className="text-center py-20 text-cream/30">
          <div className="text-4xl mb-4">📋</div>
          <p className="text-lg mb-2">Pipeline de Presupuestos</p>
          <p className="text-sm">Selecciona una pestaña del panel lateral para comenzar.</p>
        </div>
      )}
    </AdminLayout>
  );
}
