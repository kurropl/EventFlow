'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import AdminLayout from '@/components/b2b/AdminLayout';
import EventDetail from '@/components/b2b/EventDetail';

function EventoContent() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get('id');

  return <EventDetail eventId={eventId || undefined} />;
}

export default function EventoPage() {
  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <Suspense fallback={<div className="text-center py-16 text-stone-500">Cargando...</div>}>
          <EventoContent />
        </Suspense>
      </div>
    </AdminLayout>
  );
}