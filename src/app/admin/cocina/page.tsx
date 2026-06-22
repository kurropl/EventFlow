'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const CocinaPanel = dynamic(() => import('@/components/b2b/CocinaPanel'), {
  loading: () => (
    <div className="animate-pulse space-y-4 p-6 bg-[#0a0a0a] min-h-screen">
      <div className="h-8 w-48 bg-[#1e1e1e] rounded" />
      <div className="h-64 bg-[#1e1e1e] rounded-xl" />
    </div>
  ),
});

export default function CocinaPage() {
  return (
    <Suspense>
      <CocinaPanel />
    </Suspense>
  );
}