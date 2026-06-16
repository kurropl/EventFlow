'use client';

import React, { Suspense } from 'react';
import AdminLayout from '@/components/b2b/AdminLayout';
import EventDetail from '@/components/b2b/EventDetail';

export default function EventoPage({ params }: { params: { id: string } }) {
  const { id } = params;
  return (
    <AdminLayout>
      <Suspense>
        <EventDetail eventId={id} />
      </Suspense>
    </AdminLayout>
  );
}
