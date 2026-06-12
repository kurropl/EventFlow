import React from 'react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  StatStrip — franja horizontal compacta de métricas                 */
/*  Cada métrica: label + número, inline-flex, scrollable en móvil     */
/* ------------------------------------------------------------------ */

export interface StatItem {
  label: string;
  value: string | number;
  accent?: boolean;
}

interface StatStripProps {
  items: StatItem[];
  className?: string;
}

export function StatStrip({ items, className }: StatStripProps) {
  return (
    <div
      className={cn(
        'flex gap-4 overflow-x-auto scrollbar-hide py-1',
        className,
      )}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-baseline gap-2 flex-shrink-0 px-3 py-1.5 rounded-lg bg-[#FAFAFC] border border-[#F0F0F4]"
        >
          <span className="text-[11px] text-[#9CA3AF] uppercase tracking-wide whitespace-nowrap">
            {item.label}
          </span>
          <span
            className={cn(
              'text-[14px] font-semibold tabular-nums whitespace-nowrap',
              item.accent ? 'text-[#C9A84C]' : 'text-[#1A1A1A]',
            )}
          >
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}
