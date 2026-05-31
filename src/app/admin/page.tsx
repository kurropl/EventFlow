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
import DashboardOverview from '@/components/b2b/DashboardOverview';
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
        <DashboardOverview />
      )}
    </AdminLayout>
  );
}
