'use client';
import AdminLayout from '@/components/b2b/AdminLayout';
import ConfirmacionDashboard from '@/components/b2b/ConfirmacionDashboard';
import { PageHeader } from '@/components/ui';

export default function ConfirmacionPage() {
  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <PageHeader
            title="Confirmación Invitados"
            subtitle="Invitados confirmados vs mesas disponibles por evento"
          />
        </div>
        <ConfirmacionDashboard />
      </div>
    </AdminLayout>
  );
}
