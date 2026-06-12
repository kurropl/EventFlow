import React from 'react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  PageHeader — título + subtítulo + acciones + stat strip opcional  */
/* ------------------------------------------------------------------ */

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  stats?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, stats, className }: PageHeaderProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {/* Title row */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1
            className="text-xl font-bold text-[#1A1A1A] leading-tight"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="text-[13px] text-[#9CA3AF] mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>

      {/* Optional stat strip */}
      {stats && <div>{stats}</div>}
    </div>
  );
}
