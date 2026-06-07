'use client';
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';

/**
 * Shared error state for admin panels.
 * Shows a friendly Spanish message + retry button.
 */
export function PanelError({
  message = 'No se pudieron cargar los datos',
  onRetry,
  className = '',
}: {
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 ${className}`}>
      <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
        <AlertTriangle className="w-7 h-7 text-red-500" />
      </div>
      <h3 className="text-lg font-semibold text-stone-800 mb-1">Algo ha salido mal</h3>
      <p className="text-sm text-stone-500 text-center max-w-md mb-5">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-800 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Reintentar
        </button>
      )}
    </div>
  );
}

/**
 * Shared empty state for admin panels.
 * Shows icon + message + optional CTA.
 */
export function PanelEmpty({
  icon: Icon = Inbox,
  title = 'Sin datos',
  description = 'No hay elementos para mostrar.',
  actionLabel,
  onAction,
  className = '',
}: {
  icon?: any;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 ${className}`}>
      <div className="w-14 h-14 rounded-full bg-stone-100 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-stone-400" />
      </div>
      <h3 className="text-lg font-semibold text-stone-800 mb-1">{title}</h3>
      <p className="text-sm text-stone-500 text-center max-w-md mb-5">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#C9A84C] text-white text-sm font-medium rounded-lg hover:bg-[#b8973f] transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

/**
 * Loading skeleton for admin panels.
 */
export function PanelLoading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-4 p-6">
      <div className="h-7 w-48 bg-stone-200 rounded" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 bg-stone-100 rounded-xl" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 bg-stone-100 rounded" />
      ))}
    </div>
  );
}
