import React from 'react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Spinner — estado de carga único (Sprint 5, C1): antes cada panel   */
/*  hardcodeaba su propio div-spinner o texto "Cargando...".          */
/* ------------------------------------------------------------------ */

interface SpinnerProps {
  label?: string;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

const SIZES: Record<NonNullable<SpinnerProps['size']>, string> = {
  sm: 'h-4 w-4 border-2',
  default: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-[3px]',
};

export function Spinner({ label, size = 'default', className }: SpinnerProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-12 text-center', className)}>
      <div
        className={cn(
          'animate-spin rounded-full border-gold border-t-transparent',
          SIZES[size]
        )}
        role="status"
        aria-label={label || 'Cargando'}
      />
      {label && <p className="text-sm text-ink-soft">{label}</p>}
    </div>
  );
}
