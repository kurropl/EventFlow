'use client';

import React, { Suspense } from 'react';
import EventDetail from '@/components/b2b/EventDetail';
import { use } from 'react';

export default function EventoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense>
      <EventDetail eventId={id} />
    </Suspense>
  );
}
