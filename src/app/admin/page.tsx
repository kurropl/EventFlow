'use client';
import AdminLayout from '@/components/b2b/AdminLayout';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

// ── Lazy-loaded panels (code-split per tab) ───────────────────
// Only the active panel's JS is downloaded. Reduces initial bundle by ~70%.

const DashboardOverview = dynamic(() => import('@/components/b2b/DashboardOverview'), {
  loading: () => <PanelSkeleton />,
});
const CalendarView = dynamic(() => import('@/components/b2b/CalendarView'), {
  loading: () => <PanelSkeleton />,
});
const KanbanPipeline = dynamic(() => import('@/components/b2b/KanbanPipeline'), {
  loading: () => <PanelSkeleton />,
});
const ClientsCRM = dynamic(() => import('@/components/b2b/ClientsCRM'), {
  loading: () => <PanelSkeleton />,
});
const LeadsCRM = dynamic(() => import('@/components/b2b/LeadsCRM'), {
  loading: () => <PanelSkeleton />,
});
const BillingPanel = dynamic(() => import('@/components/b2b/BillingPanel'), {
  loading: () => <PanelSkeleton />,
});
const GuestsManager = dynamic(() => import('@/components/b2b/GuestsManager'), {
  loading: () => <PanelSkeleton />,
});
const CatalogCRUD = dynamic(() => import('@/components/b2b/CatalogCRUD'), {
  loading: () => <PanelSkeleton />,
});
const OperationsManager = dynamic(() => import('@/components/b2b/OperationsManager'), {
  loading: () => <PanelSkeleton />,
});
const WebhooksPanel = dynamic(() => import('@/components/b2b/WebhooksPanel'), {
  loading: () => <PanelSkeleton />,
});
const ProvidersManager = dynamic(() => import('@/components/b2b/ProvidersManager'), {
  loading: () => <PanelSkeleton />,
});
const StockManager = dynamic(() => import('@/components/b2b/StockManager'), {
  loading: () => <PanelSkeleton />,
});
const StaffingManager = dynamic(() => import('@/components/b2b/StaffingManager'), {
  loading: () => <PanelSkeleton />,
});

function PanelSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-6">
      <div className="h-8 w-48 bg-stone-200 rounded" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-stone-100 rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-stone-100 rounded-xl" />
    </div>
  );
}

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
  const isStock = pathname?.includes('stock');
  const isStaffing = pathname?.includes('staffing');
  const isMapa = pathname?.includes('mapa-mesas');
  const isLeads = pathname?.includes('leads');
  const isOther = isLeads || isAgenda || isKanban || isClients || isBilling || isGuests || isCatalog || isOperations || isWebhooks || isMapa || isProveedores || isStock || isStaffing;

  return (
    <AdminLayout>
      {isLeads && <LeadsCRM />}
      {isAgenda && <CalendarView />}
      {isKanban && <KanbanPipeline />}
      {isClients && <ClientsCRM />}
      {isBilling && <BillingPanel />}
      {isGuests && <GuestsManager />}
      {isCatalog && <CatalogCRUD />}
      {isStock && <StockManager />}
      {isStaffing && <StaffingManager />}
      {isOperations && <OperationsManager />}
      {isWebhooks && <WebhooksPanel />}
      {isProveedores && <ProvidersManager />}
      {isMapa && <OperationsManager />}
      {!isOther && <DashboardOverview />}
    </AdminLayout>
  );
}
