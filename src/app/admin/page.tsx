'use client';
/**
 * J.Benitez — Admin Dashboard (B2B)
 *
 * Mini ERP de gestión del salon de celebraciones con:
 * - Resumen general (dashboard)
 * - Agenda / calendario (eventos, citas, bloqueos)
 * - Pipeline de presupuestos Kanban
 * - Clientes (CRM)
 * - Facturación y cobros
 * - Invitados (RSVP + dietas)
 * - CRUD de catálogo
 * - Gestión de operaciones
 * - Editor de mapa de mesas drag & drop
 * - Webhooks
 */

import { usePathname } from 'next/navigation';
import AdminLayout from '@/components/b2b/AdminLayout';
import DashboardOverview from '@/components/b2b/DashboardOverview';
import CalendarView from '@/components/b2b/CalendarView';
import KanbanPipeline from '@/components/b2b/KanbanPipeline';
import ClientsCRM from '@/components/b2b/ClientsCRM';
import LeadsCRM from '@/components/b2b/LeadsCRM';
import BillingPanel from '@/components/b2b/BillingPanel';
import GuestsManager from '@/components/b2b/GuestsManager';
import CatalogCRUD from '@/components/b2b/CatalogCRUD';
import OperationsManager from '@/components/b2b/OperationsManager';
import TableMapEditor from '@/components/b2b/TableMapEditor';
import WebhooksPanel from '@/components/b2b/WebhooksPanel';

export default function AdminDashboard() {
  const pathname = usePathname();
  const isAgenda = pathname?.includes('agenda');
  const isKanban = pathname?.includes('kanban');
  const isClients = pathname?.includes('clientes');
  const isBilling = pathname?.includes('cobros');
  const isGuests = pathname?.includes('invitados');
  const isCatalog = pathname?.includes('catalog');
  const isOperations = pathname?.includes('operations');
  const isTableMap = pathname?.includes('mapa-mesas');
  const isWebhooks = pathname?.includes('webhooks');

  const isLeads = pathname?.includes('leads');
  const isOther = isLeads || isAgenda || isKanban || isClients || isBilling || isGuests || isCatalog || isOperations || isTableMap || isWebhooks;

  return (
    <AdminLayout>
      {isLeads && <LeadsCRM />}
      {isAgenda && <CalendarView />}
      {isKanban && <KanbanPipeline />}
      {isClients && <ClientsCRM />}
      {isBilling && <BillingPanel />}
      {isGuests && <GuestsManager />}
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
      {!isOther && <DashboardOverview />}
    </AdminLayout>
  );
}
