import React from 'react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  EmptyState — icono + título + descripción + CTA                    */
/* ------------------------------------------------------------------ */

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-6 text-center', className)}>
      {icon && (
        <div className="w-14 h-14 rounded-full bg-[#F5F5F8] flex items-center justify-center mb-4 text-[#9CA3AF]">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-[#374151] mb-1">{title}</h3>
      {description && (
        <p className="text-[12px] text-[#9CA3AF] max-w-xs mb-4">{description}</p>
      )}
      {action}
    </div>
  );
}
