'use client';

/**
 * EventFlow — StatusBadge
 * Renders event/lead status with consistent colors and Spanish labels.
 */

export const EVENT_STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  draft:      { label: 'Borrador',    color: 'text-blue-700',    bg: 'bg-blue-100' },
  sent:       { label: 'Enviado',     color: 'text-amber-700',   bg: 'bg-amber-100' },
  accepted:   { label: 'Aceptado',    color: 'text-green-700',   bg: 'bg-green-100' },
  done:       { label: 'Realizado',   color: 'text-purple-700',  bg: 'bg-purple-100' },
  completed:  { label: 'Realizado',   color: 'text-purple-700',  bg: 'bg-purple-100' },
  lost:       { label: 'Perdido',     color: 'text-red-700',     bg: 'bg-red-100' },
  cancelled:  { label: 'Cancelado',   color: 'text-gray-700',    bg: 'bg-gray-100' },
  reopened:   { label: 'Reabierto',   color: 'text-orange-700',  bg: 'bg-orange-100' },
  paid:       { label: 'Pagado',      color: 'text-emerald-700', bg: 'bg-emerald-100' },
  expired:    { label: 'Expirado',    color: 'text-gray-500',    bg: 'bg-gray-100' },
  rejected:   { label: 'Rechazado',   color: 'text-red-600',     bg: 'bg-red-50' },
  // Lead statuses
  nuevo:      { label: 'Nuevo',       color: 'text-blue-700',    bg: 'bg-blue-100' },
  contactado: { label: 'Contactado',  color: 'text-indigo-700',  bg: 'bg-indigo-100' },
  presupuestado: { label: 'Presupuestado', color: 'text-amber-700', bg: 'bg-amber-100' },
  convertido: { label: 'Convertido',  color: 'text-green-700',   bg: 'bg-green-100' },
  perdido:    { label: 'Perdido',     color: 'text-red-700',     bg: 'bg-red-100' },
  // Staffing lines (staffing_lines.status): distinto dominio de quotes/leads,
  // reutiliza este mismo componente — antes se veían sin traducir ("open").
  open:       { label: 'Abierto',     color: 'text-amber-700',   bg: 'bg-amber-100' },
  filled:     { label: 'Cubierto',    color: 'text-green-700',   bg: 'bg-green-100' },
};

export function getStatusBadge(status: string) {
  return EVENT_STATUS_MAP[status] ?? { label: status, color: 'text-gray-700', bg: 'bg-gray-100' };
}

export default function StatusBadge({ status }: { status: string }) {
  const { label, color, bg } = getStatusBadge(status);
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${color} ${bg}`}>
      {label}
    </span>
  );
}
