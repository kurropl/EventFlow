'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import PremiumTableMapEditor from '@/components/b2b/PremiumTableMapEditor';
import AdminLayout from '@/components/b2b/AdminLayout';

// F4.4: OperationsManager navega con ?event_id=… pero antes se ignoraba por
// completo — el editor abría siempre sin evento (guardar no persistía nada)
// y nunca podía cargar el plano del venue (venue_pdf_url).
function LoadedMapaMesas() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get('event_id') || undefined;
  return <PremiumTableMapEditor readOnly={false} eventId={eventId} />;
}

export default function MapaMesasAdminPage() {
  return (
    <AdminLayout>
      <div className="h-[calc(100vh-60px)]">
        <Suspense fallback={<div className="text-center py-16 text-stone-500">Cargando...</div>}>
          <LoadedMapaMesas />
        </Suspense>
      </div>
    </AdminLayout>
  );
}