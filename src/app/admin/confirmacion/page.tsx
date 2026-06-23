'use client';
import AdminLayout from '@/components/b2b/AdminLayout';
import ConfirmacionDashboard from '@/components/b2b/ConfirmacionDashboard';

export default function ConfirmacionPage() {
  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-stone-900">Confirmación Invitados</h1>
          <p className="text-sm text-stone-500 mt-1">Invitados confirmados vs mesas disponibles por evento</p>
        </div>
        <ConfirmacionDashboard />
      </div>
    </AdminLayout>
  );
}
