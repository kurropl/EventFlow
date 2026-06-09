'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const StaffingManager = dynamic(() => import('@/components/b2b/StaffingManager'), {
  ssr: false,
  loading: () => (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-[#ECECF1] rounded-lg" />
          <div className="h-4 w-72 bg-[#ECECF1] rounded-lg" />
        </div>
      </div>
      <div className="flex gap-1 bg-[#F8F3E6] rounded-xl p-1">
        <div className="flex-1 h-10 bg-[#ECECF1] rounded-lg" />
        <div className="flex-1 h-10 bg-[#ECECF1] rounded-lg" />
      </div>
      <div className="bg-white rounded-2xl border border-[#ECECF1] p-6 space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 bg-[#F8F3E6] rounded-lg" />
        ))}
      </div>
    </div>
  ),
});

export default function StaffingPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6 animate-pulse p-6">
        <div className="h-6 w-48 bg-[#ECECF1] rounded-lg" />
        <div className="h-64 bg-[#F8F3E6] rounded-xl" />
      </div>
    }>
      <StaffingManager />
    </Suspense>
  );
}
