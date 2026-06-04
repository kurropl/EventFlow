use client;
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
import { usePathname } from 'next/navigation';

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
      {isMapa && <OperationsManager />}
      {!isOther && <DashboardOverview />}
    </AdminLayout>
  );
}
