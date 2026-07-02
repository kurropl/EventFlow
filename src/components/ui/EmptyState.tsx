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
        <div className="w-14 h-14 rounded-full bg-cream flex items-center justify-center mb-4 text-ink-soft">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-ink mb-1">{title}</h3>
      {description && (
        <p className="text-[12px] text-ink-soft max-w-xs mb-4">{description}</p>
      )}
      {action}
    </div>
  );
}
