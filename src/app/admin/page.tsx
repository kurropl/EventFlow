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
import WebhooksPanel from '@/components/b2b/WebhooksPanel';
import ProvidersManager from '@/components/b2b/ProvidersManager';
import MapaMesas from '@/components/b2b/MapaMesas';

export default function AdminDashboard() {
  const pathname = usePathname();
  const isAgenda = pathname?.includes('agenda');
  const isKanban = pathname?.includes('kanban');
  const isClients = pathname?.includes('clientes');
  const isBilling = pathname?.includes('cobros');
  const isGuests = pathname?.includes('invitados');
  const isCatalog = pathname?.includes('catalog');
  const isOperations = pathname?.includes('operations');
  const isWebhooks = pathname?.includes('webhooks');
  const isProveedores = pathname?.includes('proveedores');
  const isMapa = pathname?.includes('mapa-mesas');
  const isLeads = pathname?.includes('leads');
  const isOther = isLeads || isAgenda || isKanban || isClients || isBilling || isGuests || isCatalog || isOperations || isWebhooks || isMapa || isProveedores;

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
      {isWebhooks && <WebhooksPanel />}
      {isProveedores && <ProvidersManager />}
      {isMapa && <MapaMesas />}
      {!isOther && <DashboardOverview />}
    </AdminLayout>
  );
}
