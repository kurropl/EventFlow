'use client';

import React from 'react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  DataCard — fila genérica de lista (patrón Clientes)               */
/*  Avatar izq · título+subtítulo · badges arriba-der · meta fila     */
/*  inferior · acciones abajo-der. Responsive: <640 apilado, ≥640 horiz */
/* ------------------------------------------------------------------ */

export interface BadgeItem {
  label: string;
  variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

export interface MetaItem {
  label: string;
  value: string;
}

export interface AvatarProps {
  initials?: string;
  color?: string;
  icon?: React.ReactNode;
}

export interface DataCardProps {
  avatar?: AvatarProps;
  title: string;
  subtitle?: string;
  badges?: BadgeItem[];
  meta?: MetaItem[];
  actions?: React.ReactNode;
  onClick?: () => void;
  href?: string;
  className?: string;
}

const badgeStyles: Record<string, string> = {
  success: 'bg-[#EFFAF2] text-[#15803D] border-[#BBF7D0]',
  warning: 'bg-[#FFF8EC] text-[#B45309] border-[#FDE68A]',
  danger:  'bg-[#FEF3F3] text-[#DC2626] border-[#FECACA]',
  info:    'bg-[#EFF4FF] text-[#2563EB] border-[#BFDBFE]',
  neutral: 'bg-[#F5F5F8] text-[#6B7280] border-[#E5E7EB]',
};

export function DataCard({
  avatar,
  title,
  subtitle,
  badges = [],
  meta = [],
  actions,
  onClick,
  href,
  className,
}: DataCardProps) {
  const Tag = href ? 'a' : 'button';
  const extra = href ? { href } : {};

  return (
    <Tag
      {...extra}
      onClick={onClick}
      className={cn(
        'w-full text-left flex flex-col gap-3 px-5 py-4',
        'border-b border-[#F2F2F5] last:border-b-0',
        'hover:bg-[#FAFAFC] transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C]/40 focus-visible:ring-offset-1',
        'sm:flex-row sm:items-center sm:gap-4',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {/* ── Left: Avatar + Title ── */}
      <div className="flex items-center gap-3 min-w-0 flex-1 sm:flex-[2]">
        {avatar && (
          <div
            className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-semibold text-white"
            style={{ background: avatar.color || 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
          >
            {avatar.icon || avatar.initials}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-[#1A1A1A] truncate">{title}</div>
          {subtitle && (
            <div className="text-[12px] text-[#9CA3AF] truncate">{subtitle}</div>
          )}
        </div>
      </div>

      {/* ── Center: Meta ── */}
      {meta.length > 0 && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12px] sm:flex-[3]">
          {meta.map((m) => (
            <div key={m.label} className="min-w-0">
              <span className="text-[#9CA3AF] mr-1">{m.label}:</span>
              <span className="text-[#374151] font-medium tabular-nums">{m.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Right: Badges + Actions ── */}
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:justify-end sm:flex-[1]">
        {badges.map((b) => (
          <span
            key={b.label}
            className={cn(
              'inline-flex items-center rounded-full border px-2.5 py-0.5',
              'text-[11px] font-medium whitespace-nowrap',
              badgeStyles[b.variant] || badgeStyles.neutral,
            )}
          >
            {b.label}
          </span>
        ))}
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </div>
    </Tag>
  );
}
