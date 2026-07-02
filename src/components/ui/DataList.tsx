'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { EmptyState } from './EmptyState';

/* ------------------------------------------------------------------ */
/*  DataList — contenedor de lista con skeleton, vacío, filtros       */
/* ------------------------------------------------------------------ */

interface DataListProps {
  children?: React.ReactNode;
  loading?: boolean;
  emptyIcon?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  filters?: React.ReactNode;
  count?: number;
  className?: string;
}

/** Skeleton de carga — 3 filas pulsantes que imitan DataCard */
function DataListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="divide-y divide-[#F2F2F5]">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
          <div className="w-9 h-9 rounded-full bg-[#ECECF1]" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-32 bg-[#ECECF1] rounded" />
            <div className="h-3 w-20 bg-[#F0F0F4] rounded" />
          </div>
          <div className="hidden sm:flex gap-3">
            <div className="h-3 w-16 bg-[#F0F0F4] rounded" />
            <div className="h-3 w-16 bg-[#F0F0F4] rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Estado vacío con icono, título, descripción y CTA — delega en EmptyState
 *  (Sprint 5, C1: eran dos implementaciones casi idénticas duplicadas). */
function DataListEmpty(props: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return <EmptyState {...props} />;
}

export function DataList({
  children,
  loading = false,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyAction,
  filters,
  count,
  className,
}: DataListProps) {
  return (
    <div className={cn('bg-white rounded-2xl border border-[#ECECF1] shadow-[0_1px_2px_rgba(16,24,40,0.04)] overflow-hidden', className)}>
      {/* Filters / Search bar */}
      {filters && (
        <div className="px-5 py-3 border-b border-[#F2F2F5] flex items-center gap-3 flex-wrap">
          {filters}
          {count !== undefined && (
            <span className="text-[12px] text-[#9CA3AF] ml-auto">{count} resultado{count !== 1 ? 's' : ''}</span>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <DataListSkeleton />
      ) : count === 0 && emptyTitle ? (
        <DataListEmpty
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      ) : (
        <div className="divide-y divide-[#F2F2F5]">{children}</div>
      )}
    </div>
  );
}

export { DataListSkeleton, DataListEmpty };
