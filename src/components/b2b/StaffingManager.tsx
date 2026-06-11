'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Icon from '../shared/Icon';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Worker {
  id: string;
  name: string;
  phone: string;
  roles: string[];
  default_uniform: string;
  active: boolean;
  contract_url?: string;
  contract_name?: string;
}

interface EventOption {
  id: string;
  client_name: string;
  event_date: string;
  status: string;
  guest_count?: number;
}

interface StaffingLine {
  id: string;
  event_id: string;
  role: string;
  slots_needed: number;
  start_time: string;
  end_time: string;
  location: string;
  uniform: string;
  notes: string;
  status: string;
  created_at: string;
  event_name: string;
  assigned_count: number;
  offers_sent: number;
}

interface Offer {
  id: string;
  staffing_line_id: string;
  worker_id: string;
  status: string;
  sent_at: string;
  responded_at: string;
  worker_name: string;
  worker_phone: string;
  worker_roles: string[];
}

interface Assignment {
  id: string;
  worker_id: string;
  worker_name: string;
  worker_phone: string;
  position: number;
  confirmed_at: string;
}

interface Uniform {
  id: string;
  name: string;
  description: string;
  color: string;
  gender: string;
}

type Tab = 'workers' | 'event_staffing';
type EventSubTab = 'lines' | 'nomina';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ROLE_OPTIONS = ['Camarero', 'Cocinero', 'Metre'];

const ROLE_LOWERCASE_MAP: Record<string, string> = {
  camarero: 'Camarero',
  cocinero: 'Cocinero',
  metre: 'Metre',
  'camarero/a': 'Camarero',
  'cocinero/a': 'Cocinero',
  metres: 'Metre',
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function normalizeRole(role: string): string {
  return ROLE_LOWERCASE_MAP[role.toLowerCase()] || role;
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    active: { label: 'Activo', bg: 'bg-[#EFFAF2]', color: 'text-[#16A34A]' },
    inactive: { label: 'Inactivo', bg: 'bg-[#FEF3F3]', color: 'text-[#DC2626]' },
    confirmed: { label: 'Confirmado', bg: 'bg-[#EFFAF2]', color: 'text-[#16A34A]' },
    pending: { label: 'Pendiente', bg: 'bg-[#FFF8EC]', color: 'text-[#D97706]' },
    open: { label: 'Abierto', bg: 'bg-[#EEF2FF]', color: 'text-[#4F46E5]' },
    filled: { label: 'Completo', bg: 'bg-[#EFFAF2]', color: 'text-[#16A34A]' },
    draft: { label: 'Borrador', bg: 'bg-[#F5F5F8]', color: 'text-[#6B7280]' },
    declined: { label: 'Rechazado', bg: 'bg-[#FEF3F3]', color: 'text-[#DC2626]' },
    rejected: { label: 'Rechazado', bg: 'bg-[#FEF3F3]', color: 'text-[#DC2626]' },
    accepted: { label: 'Aceptado', bg: 'bg-[#EFFAF2]', color: 'text-[#16A34A]' },
    sent: { label: 'Enviado', bg: 'bg-[#EEF2FF]', color: 'text-[#4F46E5]' },
    expired: { label: 'Expirado', bg: 'bg-[#F5F5F8]', color: 'text-[#9CA3AF]' },
  };
  return map[status] || map.draft;
}

function formatTime(t: string) {
  if (!t) return '--';
  if (t.includes('T')) {
    const d = new Date(t);
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }
  return t;
}

function formatDate(d: string) {
  if (!d) return '--';
  return new Date(d).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(d: string) {
  if (!d) return '--';
  const date = new Date(d);
  return (
    date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) +
    ' ' +
    date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  );
}

function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return phone;
  const visible = phone.slice(-3);
  const masked = phone.slice(0, -3).replace(/./g, '*');
  return masked + visible;
}

/* ------------------------------------------------------------------ */
/*  Timeline Stepper                                                   */
/* ------------------------------------------------------------------ */

interface StepperProps {
  offersSent: number;
  totalWorkers: number;
  acceptedCount: number;
  pendingCount: number;
  slotsNeeded: number;
  assignedCount: number;
  lineStatus: string;
}

function TimelineStepper({
  offersSent,
  totalWorkers,
  acceptedCount,
  pendingCount,
  slotsNeeded,
  assignedCount,
  lineStatus,
}: StepperProps) {
  const isFilled = lineStatus === 'filled';
  const hasOffers = offersSent > 0;
  const hasResponses = acceptedCount > 0 || pendingCount === 0;

  const steps = [
    {
      label: 'Necesidad definida',
      done: true,
      detail: '',
    },
    {
      label: 'Notificaciones enviadas',
      done: hasOffers,
      active: hasOffers && !isFilled,
      detail: hasOffers ? `(${offersSent} trabajadores)` : '',
    },
    {
      label: 'Esperando respuestas',
      done: isFilled,
      active: hasOffers && !isFilled,
      detail: hasOffers
        ? `(${acceptedCount} aceptados, ${pendingCount} pendientes)`
        : '',
    },
    {
      label: 'Reparto cerrado',
      done: isFilled,
      active: false,
      detail: isFilled ? `(${assignedCount}/${slotsNeeded} plazas)` : '',
    },
  ];

  return (
    <div className="flex flex-col gap-0 ml-1">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        return (
          <div key={i} className="flex items-start gap-3">
            {/* Circle + connector */}
            <div className="flex flex-col items-center">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border-2 shrink-0 ${
                  step.done
                    ? 'bg-[#C9A84C] border-[#C9A84C] text-white'
                    : step.active
                      ? 'bg-white border-[#C9A84C] text-[#C9A84C]'
                      : 'bg-[#F5F5F8] border-[#E5E5EC] text-[#A8A8B0]'
                }`}
              >
                {step.done ? <Icon name="check" className="w-3 h-3" /> : i + 1}
              </div>
              {!isLast && (
                <div
                  className={`w-0.5 min-h-[20px] ${
                    step.done ? 'bg-[#C9A84C]' : 'bg-[#E5E5EC]'
                  }`}
                />
              )}
            </div>
            {/* Label */}
            <div className={`pb-3 ${!step.detail ? 'pt-0.5' : ''}`}>
              <span
                className={`text-xs font-medium ${
                  step.done ? 'text-[#1A1A1A]' : step.active ? 'text-[#D97706]' : 'text-[#9CA3AF]'
                }`}
              >
                {step.label}
              </span>
              {step.detail && (
                <span className="text-[11px] text-[#9CA3AF] ml-1.5">{step.detail}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  StaffingLine Card                                                  */
/* ------------------------------------------------------------------ */

interface StaffingLineCardProps {
  line: StaffingLine;
  offers: Offer[];
  assignments: Assignment[];
  workers: Worker[];
  uniforms: Uniform[];
  loadingOffers: boolean;
  onEdit: (line: StaffingLine) => void;
  onDelete: (id: string) => void;
  onBroadcast: (lineId: string, role: string) => void;
  onCloseLine: (lineId: string) => void;
  onRefresh: () => void;
}

function StaffingLineCard({
  line,
  offers,
  assignments,
  workers,
  uniforms,
  loadingOffers,
  onEdit,
  onDelete,
  onBroadcast,
  onCloseLine,
  onRefresh,
}: StaffingLineCardProps) {
  const [expanded, setExpanded] = useState(false);

  const acceptedOffers = offers.filter((o) => o.status === 'accepted');
  const sentOffers = offers.filter((o) => o.status === 'sent');
  const rejectedOffers = offers.filter((o) => o.status === 'rejected');
  const expiredOffers = offers.filter((o) => o.status === 'expired');
  const pendingCount = sentOffers.length;
  const totalWorkersForRole = workers.filter(
    (w) => w.active && w.roles.some((r) => normalizeRole(r) === normalizeRole(line.role))
  ).length;

  const isFilled = line.status === 'filled';
  const isOpen = line.status === 'open';
  const hasOffers = offers.length > 0;

  const uniform = uniforms.find((u) => u.id === line.uniform || u.name === line.uniform);

  const sortedAssignments = [...assignments].sort((a, b) => a.position - b.position);

  const handleBroadcast = (e: React.MouseEvent) => {
    e.stopPropagation();
    onBroadcast(line.id, line.role);
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCloseLine(line.id);
  };

  return (
    <div className="bg-white rounded-2xl border border-[#ECECF1] overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      {/* Header row - clickable */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-[#FAFCFE] transition-colors text-left"
      >
        <Icon
          name="chevronDown"
          className={`w-4 h-4 text-[#9CA3AF] transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
        <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
          {/* Role badge */}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FBF6E9] text-[#A88A3A] text-xs font-semibold">
            <Icon name="user" className="w-3 h-3" />
            {line.role}
          </span>
          {/* Slots */}
          <span className={`text-sm font-semibold ${isFilled ? 'text-[#16A34A]' : 'text-[#6B7280]'}`}>
            {line.assigned_count}/{line.slots_needed} plazas
          </span>
          {/* Uniform */}
          {uniform && (
            <span className="inline-flex items-center gap-1 text-xs text-[#6B7280]">
              <UniformIcons uniformName={uniform.name} />
              <span className="truncate">{uniform.name}</span>
            </span>
          )}
          {!uniform && line.uniform && (
            <span className="inline-flex items-center gap-1 text-xs text-[#6B7280]">
              <UniformIcons uniformName={line.uniform} />
              <span className="truncate">{line.uniform}</span>
            </span>
          )}
          {/* Time */}
          {(line.start_time || line.end_time) && (
            <span className="text-xs text-[#9CA3AF] flex items-center gap-1">
              <Icon name="clock" className="w-3 h-3" />
              {formatTime(line.start_time)} -- {formatTime(line.end_time)}
            </span>
          )}
          {/* Location */}
          {line.location && (
            <span className="text-xs text-[#9CA3AF] flex items-center gap-1">
              <Icon name="pin" className="w-3 h-3" />
              {line.location}
            </span>
          )}
        </div>
        {/* Status badge */}
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
            statusBadge(line.status).bg
          } ${statusBadge(line.status).color}`}
        >
          {statusBadge(line.status).label}
        </span>
        {/* Action buttons */}
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {isOpen && (
            <button
              onClick={handleBroadcast}
              className="p-2 rounded-lg text-[#6B7280] hover:bg-[#EEF2FF] hover:text-[#4F46E5] transition-colors"
              title="Difundir oferta"
            >
              <Icon name="send" className="w-4 h-4" />
            </button>
          )}
          {isOpen && hasOffers && (
            <button
              onClick={handleClose}
              className="p-2 rounded-lg text-[#6B7280] hover:bg-[#EFFAF2] hover:text-[#16A34A] transition-colors"
              title="Cerrar reparto"
            >
              <Icon name="check" className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(line); }}
            className="p-2 rounded-lg text-[#6B7280] hover:bg-[#FBF6E9] hover:text-[#C9A84C] transition-colors"
            title="Editar"
          >
            <Icon name="edit" className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(line.id); }}
            className="p-2 rounded-lg text-[#6B7280] hover:bg-[#FEF3F3] hover:text-[#DC2626] transition-colors"
            title="Eliminar"
          >
            <Icon name="trash" className="w-4 h-4" />
          </button>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-[#ECECF1] bg-[#FAFAFE] px-5 py-4 space-y-5">
          {/* Timeline stepper */}
          <div>
            <h5 className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-3">
              Flujo de reparto
            </h5>
            <TimelineStepper
              offersSent={line.offers_sent || offers.length}
              totalWorkers={totalWorkersForRole}
              acceptedCount={acceptedOffers.length}
              pendingCount={pendingCount}
              slotsNeeded={line.slots_needed}
              assignedCount={line.assigned_count}
              lineStatus={line.status}
            />
          </div>

          {/* Assigned workers */}
          {sortedAssignments.length > 0 && (
            <div>
              <h5 className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-2">
                Trabajadores asignados
              </h5>
              <div className="space-y-1.5">
                {sortedAssignments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white border border-[#ECECF1]"
                  >
                    <span className="text-[#C9A84C] text-xs font-bold w-5 text-center">#{a.position}</span>
                    <Icon name="user" className="w-3.5 h-3.5 text-[#9CA3AF]" />
                    <span className="text-sm font-medium text-[#1A1A1A]">{a.worker_name}</span>
                    {a.worker_phone && (
                      <span className="text-xs text-[#9CA3AF]">{maskPhone(a.worker_phone)}</span>
                    )}
                    <span className="text-[10px] text-[#9CA3AF] ml-auto">{formatDateTime(a.confirmed_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Offers table */}
          {loadingOffers ? (
            <div className="text-center py-6 text-[#9CA3AF]">
              <Icon name="spinner" className="w-4 h-4 animate-spin mx-auto mb-1" />
              <span className="text-xs">Cargando ofertas...</span>
            </div>
          ) : offers.length > 0 ? (
            <div>
              <h5 className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-2">
                Ofertas enviadas ({offers.length})
              </h5>
              <div className="bg-white rounded-xl border border-[#ECECF1] overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#F2F2F5]">
                      <th className="text-left px-3 py-2 text-[#9CA3AF] font-medium text-[10px] uppercase tracking-wider">
                        Trabajador
                      </th>
                      <th className="text-left px-3 py-2 text-[#9CA3AF] font-medium text-[10px] uppercase tracking-wider">
                        Telefono
                      </th>
                      <th className="text-center px-3 py-2 text-[#9CA3AF] font-medium text-[10px] uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="text-left px-3 py-2 text-[#9CA3AF] font-medium text-[10px] uppercase tracking-wider">
                        Enviado
                      </th>
                      <th className="text-left px-3 py-2 text-[#9CA3AF] font-medium text-[10px] uppercase tracking-wider">
                        Respondido
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {offers.map((o) => {
                      const st = statusBadge(o.status);
                      return (
                        <tr key={o.id} className="border-b border-[#F8F8FA] last:border-0">
                          <td className="px-3 py-2 text-[#1A1A1A] font-medium">{o.worker_name}</td>
                          <td className="px-3 py-2 text-[#6B7280]">{maskPhone(o.worker_phone)}</td>
                          <td className="px-3 py-2 text-center">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.bg} ${st.color}`}
                            >
                              {st.label}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-[#9CA3AF]">{formatDateTime(o.sent_at)}</td>
                          <td className="px-3 py-2 text-[#9CA3AF]">
                            {o.responded_at ? formatDateTime(o.responded_at) : '--'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#9CA3AF]">No se han enviado ofertas todavia.</p>
          )}

          {/* Close line button (manual) */}
          {isOpen && hasOffers && (
            <div className="pt-1">
              <button
                onClick={handleClose}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium text-[#16A34A] bg-[#EFFAF2] hover:bg-[#DCFCE7] transition-colors"
              >
                <Icon name="check" className="w-3.5 h-3.5" />
                Cerrar reparto{line.assigned_count < line.slots_needed ? ' (manual)' : ''}
              </button>
            </div>
          )}

          {/* Notes */}
          {line.notes && (
            <div className="pt-1">
              <h5 className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">
                Notas
              </h5>
              <p className="text-xs text-[#6B7280] bg-[#F8F3E6] rounded-lg px-3 py-2">{line.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

  /* ── Uniform Icons — Elegant fashion-illustration SVGs ── */
  const UniformIcons = ({ uniformName, size = 16 }: { uniformName: string; size?: number }) => {
    const name = uniformName.toLowerCase();
    const s = size;
    const color = '#2C2C2C';
    const light = '#B0A89A';

    const icon = (() => {
      // Traje negro completo — elegante traje con pantalón
      if (name.includes('traje negro completo')) {
        return (
          <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            {/* Jacket */}
            <path d="M8 2h8l1 6-5 2-5-2L8 2z" fill={color} stroke="none" />
            <path d="M8 2l-1 6 5 2 5-2-1-6" />
            <path d="M12 10v4" />
            <path d="M10 10v2M14 10v2" />
            {/* Pants */}
            <path d="M9 14l-1 8M15 14l1 8" />
            <path d="M9 14h6" />
          </svg>
        );
      }
      // Chaleco negro + camisa blanca — chaleco sobre camisa
      if (name.includes('chaleco negro') && name.includes('camisa')) {
        return (
          <svg width={s} height={s} viewBox="0 0 24 24" fill="none" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            {/* Shirt (white) */}
            <path d="M8 3h8v10H8V3z" fill="#FFFFFF" stroke={light} />
            <path d="M10 3l-2 3h4l-2-3" stroke={light} />
            <path d="M12 6v3" stroke={light} />
            {/* Vest (black) */}
            <path d="M9 6h6v7H9V6z" fill={color} stroke={color} />
            <path d="M12 6v7" stroke="#444" strokeWidth="0.8" />
          </svg>
        );
      }
      // Chaleco de chef — chaqueta de cocina
      if (name.includes('chaleco de chef')) {
        return (
          <svg width={s} height={s} viewBox="0 0 24 24" fill="none" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 4h8v12H8V4z" fill="#FAFAFA" stroke={light} />
            <path d="M10 4l-1 3h4l-1-3" stroke={light} />
            <path d="M12 7v2" stroke={light} />
            <circle cx="12" cy="11" r="0.8" fill={light} />
            <circle cx="12" cy="14" r="0.8" fill={light} />
          </svg>
        );
      }
      // Gorra de chef — gorra alta
      if (name.includes('gorra de chef')) {
        return (
          <svg width={s} height={s} viewBox="0 0 24 24" fill="none" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 8h8v10H8V8z" fill="#FAFAFA" stroke={light} />
            <path d="M7 8c0-3 2-5 5-5s5 2 5 5" fill="#FAFAFA" stroke={light} />
            <path d="M7 8h10" />
          </svg>
        );
      }
      // Polo negro — camiseta con cuello
      if (name.includes('polo negro')) {
        return (
          <svg width={s} height={s} viewBox="0 0 24 24" fill="none" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3h8v11H8V3z" fill={color} stroke="none" />
            <path d="M8 3l-2 4h3M16 3l2 4h-3" stroke={color} />
            <path d="M10 3l-1 3h4l-1-3" stroke="#444" />
            <path d="M12 6v2" stroke="#444" strokeWidth="0.8" />
          </svg>
        );
      }
      // Vestido rojo — vestido femenino elegante
      if (name.includes('vestido rojo')) {
        return (
          <svg width={s} height={s} viewBox="0 0 24 24" fill="none" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 3h4l1 5-3 5-3-5L10 3z" fill="#C0392B" stroke="none" />
            <path d="M10 3c0 0 1.5 1.5 2 1.5S14 3 14 3" stroke="#A93226" strokeWidth="1" />
            <path d="M8 14l-1 7M16 14l1 7" stroke="#C0392B" />
            <path d="M8 14h8" stroke="#C0392B" />
          </svg>
        );
      }
      // Vestido negro elegante
      if (name.includes('vestido negro')) {
        return (
          <svg width={s} height={s} viewBox="0 0 24 24" fill="none" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 3h4l1 5-3 5-3-5L10 3z" fill={color} stroke="none" />
            <path d="M10 3c0 0 1.5 1.5 2 1.5S14 3 14 3" stroke="#444" strokeWidth="1" />
            <path d="M8 14l-1 7M16 14l1 7" stroke={color} />
            <path d="M8 14h8" stroke={color} />
          </svg>
        );
      }
      // Delantal de cuero — delantal artesanal
      if (name.includes('delantal de cuero')) {
        return (
          <svg width={s} height={s} viewBox="0 0 24 24" fill="none" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 4h6v14H9V4z" fill="#8B6914" stroke="#7A5C10" strokeWidth="0.8" />
            <path d="M10 4v-2M14 4v-2" stroke="#7A5C10" strokeWidth="1.5" />
            <rect x="10" y="7" width="4" height="3" fill="#6B5210" rx="1" stroke="none" />
            <path d="M10 12h4" stroke="#7A5C10" strokeWidth="0.6" />
          </svg>
        );
      }
      // Manta blanca + delantal
      if (name.includes('manta blanca') || name.includes('delantal blanco')) {
        return (
          <svg width={s} height={s} viewBox="0 0 24 24" fill="none" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 4h6v14H9V4z" fill="#FAFAFA" stroke={light} />
            <path d="M10 4v-2M14 4v-2" stroke={light} strokeWidth="1.5" />
            <rect x="10" y="7" width="4" height="3" fill="#F0EDE6" rx="1" stroke="none" />
            <path d="M10 12h4" stroke={light} strokeWidth="0.6" />
          </svg>
        );
      }
      // Uniforme de limpieza
      if (name.includes('limpieza')) {
        return (
          <svg width={s} height={s} viewBox="0 0 24 24" fill="none" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 4h8v12H8V4z" fill="#6B7280" stroke="none" />
            <path d="M10 4l-1 3h4l-1-3" stroke="#555" />
            <path d="M12 7v2" stroke="#555" strokeWidth="0.8" />
          </svg>
        );
      }
      // Default — elegante círculo con borde dorado
      return (
        <span className="w-4 h-4 rounded-full border border-[#C9A84C]/40 bg-[#F8F3E6] flex-shrink-0" />
      );
    })();

    return <span className="inline-flex items-center flex-shrink-0">{icon}</span>;
  };


export default function StaffingManager() {
  const searchParams = useSearchParams();
  const initialEventId = searchParams.get('event_id') || '';
  const [activeTab, setActiveTab] = useState<Tab>(initialEventId ? 'event_staffing' : 'workers');

  /* ── Workers state ── */
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(true);
  const [searchWorker, setSearchWorker] = useState('');
  const [showWorkerForm, setShowWorkerForm] = useState(false);
  const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);
  const [workerForm, setWorkerForm] = useState({
    name: '',
    phone: '',
    roles: [] as string[],
    uniform: '',
    active: true,
  });
  const [savingWorker, setSavingWorker] = useState(false);
  const [workerFormError, setWorkerFormError] = useState('');
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [uploadingContract, setUploadingContract] = useState(false);

  /* ── Uniforms state ── */
  const [uniforms, setUniforms] = useState<Uniform[]>([]);

  /* ── Event staffing state ── */
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEvent, setSelectedEvent] = useState(initialEventId);
  const [staffingLines, setStaffingLines] = useState<StaffingLine[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);
  const [showLineForm, setShowLineForm] = useState(false);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [lineForm, setLineForm] = useState({
    role: '',
    slots_needed: '1',
    start_time: '',
    end_time: '',
    location: '',
    uniform: '',
    notes: '',
  });
  const [savingLine, setSavingLine] = useState(false);

  /* ── Offers / Assignments per line ── */
  const [lineOffers, setLineOffers] = useState<Record<string, Offer[]>>({});
  const [lineAssignments, setLineAssignments] = useState<Record<string, Assignment[]>>({});
  const [loadingOffers, setLoadingOffers] = useState<Record<string, boolean>>({});

  /* ── Offer modal state ── */
  const [offerLineId, setOfferLineId] = useState<string | null>(null);
  const [offerLineRole, setOfferLineRole] = useState('');
  const [offerSelectedWorkers, setOfferSelectedWorkers] = useState<Set<string>>(new Set());
  const [sendingOffers, setSendingOffers] = useState(false);

  /* ── Close line confirmation ── */
  const [closeLineId, setCloseLineId] = useState<string | null>(null);

  /* ── Event staffing sub-tab ── */
  const [eventSubTab, setEventSubTab] = useState<EventSubTab>('lines');

  /* ── Worker pay (Nomina) state ── */
  const [workerPay, setWorkerPay] = useState<any[]>([]);
  const safeNum = (v: unknown, fallback = 0): number => {
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? fallback));
    return isNaN(n) ? fallback : n;
  };
  const fmt = (v: unknown, decimals = 2): string => safeNum(v).toFixed(decimals);
  const [payMeta, setPayMeta] = useState({ totalHours: 0, totalPay: 0, count: 0, pendingCount: 0, paidCount: 0 });
  const [loadingPay, setLoadingPay] = useState(false);
  const [editingPayId, setEditingPayId] = useState<string | null>(null);
  const [payForm, setPayForm] = useState({ hours: '', hourly_rate: '', notes: '' });
  const [savingPay, setSavingPay] = useState(false);
  const [showAddPay, setShowAddPay] = useState(false);
  const [newPayForm, setNewPayForm] = useState({ worker_id: '', hours: '', hourly_rate: '10', notes: '' });

  /* ───────────────────────────────────────────────────────────────── */
  /*  Data loading                                                     */
  /* ───────────────────────────────────────────────────────────────── */

  const loadWorkers = useCallback(async () => {
    try {
      setLoadingWorkers(true);
      const res = await fetch('/api/staffing/workers');
      const data = await res.json();
      if (data.success) setWorkers(data.data || []);
    } catch {
      /* ignore */
    } finally {
      setLoadingWorkers(false);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/events?limit=200');
      const data = await res.json();
      if (data.success) setEvents(data.data || []);
    } catch {
      /* ignore */
    }
  }, []);

  const loadUniforms = useCallback(async () => {
    try {
      const res = await fetch('/api/staffing/uniforms');
      const data = await res.json();
      if (data.success) setUniforms(data.data || []);
    } catch {
      /* ignore */
    }
  }, []);

  const loadStaffingLines = useCallback(async (eventId: string) => {
    if (!eventId) {
      setStaffingLines([]);
      return;
    }
    try {
      setLoadingLines(true);
      const res = await fetch(`/api/staffing/lines?event_id=${eventId}`);
      const data = await res.json();
      if (data.success) setStaffingLines(data.data || []);
      else setStaffingLines([]);
    } catch {
      setStaffingLines([]);
    } finally {
      setLoadingLines(false);
    }
  }, []);

  const loadLineOffers = useCallback(async (lineId: string) => {
    try {
      setLoadingOffers((prev) => ({ ...prev, [lineId]: true }));
      const res = await fetch(`/api/staffing/lines/${lineId}/offers`);
      const data = await res.json();
      setLineOffers((prev) => ({ ...prev, [lineId]: data.data || [] }));
    } catch {
      setLineOffers((prev) => ({ ...prev, [lineId]: [] }));
    } finally {
      setLoadingOffers((prev) => ({ ...prev, [lineId]: false }));
    }
  }, []);

  const loadLineAssignments = useCallback(async (lineId: string) => {
    try {
      const res = await fetch(`/api/staffing/lines/${lineId}/assignments`);
      const data = await res.json();
      setLineAssignments((prev) => ({ ...prev, [lineId]: data.data || [] }));
    } catch {
      setLineAssignments((prev) => ({ ...prev, [lineId]: [] }));
    }
  }, []);

  const loadLineDetails = useCallback(
    async (lineId: string) => {
      await Promise.all([loadLineOffers(lineId), loadLineAssignments(lineId)]);
    },
    [loadLineOffers, loadLineAssignments]
  );

  const loadWorkerPay = useCallback(async (eventId: string) => {
    if (!eventId) {
      setWorkerPay([]);
      setPayMeta({ totalHours: 0, totalPay: 0, count: 0, pendingCount: 0, paidCount: 0 });
      return;
    }
    try {
      setLoadingPay(true);
      const res = await fetch(`/api/staffing/pay?event_id=${eventId}`);
      const data = await res.json();
      if (data.success) {
        setWorkerPay(data.data || []);
        const m = data.meta || { totalHours: 0, totalPay: 0, count: 0, pendingCount: 0, paidCount: 0 };
        setPayMeta({ totalHours: Number(m.totalHours) || 0, totalPay: Number(m.totalPay) || 0, count: Number(m.count) || 0, pendingCount: Number(m.pendingCount) || 0, paidCount: Number(m.paidCount) || 0 });
      } else {
        setWorkerPay([]);
        setPayMeta({ totalHours: 0, totalPay: 0, count: 0, pendingCount: 0, paidCount: 0 });
      }
    } catch {
      setWorkerPay([]);
      setPayMeta({ totalHours: 0, totalPay: 0, count: 0, pendingCount: 0, paidCount: 0 });
    } finally {
      setLoadingPay(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'workers') loadWorkers();
    if (activeTab === 'event_staffing' && events.length === 0) loadEvents();
    if (initialEventId && events.length === 0) loadEvents();
    // Always load uniforms
    loadUniforms();
  }, [activeTab, loadWorkers, loadEvents, loadUniforms, events.length, initialEventId]);

  useEffect(() => {
    if (selectedEvent) {
      loadStaffingLines(selectedEvent);
      loadWorkerPay(selectedEvent);
    }
  }, [selectedEvent, loadStaffingLines, loadWorkerPay]);

  // Load offers/assignments for all lines when lines change
  useEffect(() => {
    staffingLines.forEach((line) => {
      if (!lineOffers[line.id] && !loadingOffers[line.id]) {
        loadLineDetails(line.id);
      }
    });
  }, [staffingLines, lineOffers, loadingOffers, loadLineDetails]);

  /* ───────────────────────────────────────────────────────────────── */
  /*  Derived data                                                     */
  /* ───────────────────────────────────────────────────────────────── */

  const selectedEventInfo = useMemo(
    () => events.find((e) => e.id === selectedEvent) || null,
    [events, selectedEvent]
  );

  const filteredWorkers = useMemo(() => {
    if (!searchWorker) return workers;
    const q = searchWorker.toLowerCase();
    return workers.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.phone.includes(q) ||
        w.roles.some((r) => r.toLowerCase().includes(q))
    );
  }, [workers, searchWorker]);

  const activeWorkersCount = useMemo(() => workers.filter((w) => w.active).length, [workers]);

  const workersForOffer = useMemo(() => {
    if (!offerLineRole) return [];
    return workers.filter(
      (w) => w.active && w.roles.some((r) => normalizeRole(r) === normalizeRole(offerLineRole))
    );
  }, [workers, offerLineRole]);

  const linesByRole = useMemo(() => {
    const grouped: Record<string, StaffingLine[]> = {};
    staffingLines.forEach((line) => {
      const role = normalizeRole(line.role);
      if (!grouped[role]) grouped[role] = [];
      grouped[role].push(line);
    });
    return grouped;
  }, [staffingLines]);

  /* ───────────────────────────────────────────────────────────────── */
  /*  Worker actions                                                   */
  /* ───────────────────────────────────────────────────────────────── */

  const resetWorkerForm = () => {
    setWorkerForm({ name: '', phone: '', roles: [], uniform: '', active: true });
    setWorkerFormError('');
    setEditingWorkerId(null);
    setShowWorkerForm(false);
    setContractFile(null);
  };

  const startEditWorker = (w: Worker) => {
    setEditingWorkerId(w.id);
    setWorkerForm({
      name: w.name,
      phone: w.phone,
      roles: w.roles,
      uniform: w.default_uniform || '',
      active: w.active,
    });
    setShowWorkerForm(true);
    setWorkerFormError('');
  };

  const toggleWorkerRole = (role: string) => {
    setWorkerForm((f) => ({
      ...f,
      roles: f.roles.includes(role) ? f.roles.filter((r) => r !== role) : [...f.roles, role],
    }));
  };

  const saveWorker = async () => {
    if (!workerForm.name.trim()) {
      setWorkerFormError('El nombre es obligatorio');
      return;
    }
    if (workerForm.roles.length === 0) {
      setWorkerFormError('Selecciona al menos un rol');
      return;
    }
    setSavingWorker(true);
    try {
      const method = editingWorkerId ? 'PUT' : 'POST';
      const url = editingWorkerId
        ? `/api/staffing/workers/${editingWorkerId}`
        : '/api/staffing/workers';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...workerForm, default_uniform: workerForm.uniform }),
      });
      if (res.ok) {
        const data = await res.json();
        const workerId = editingWorkerId || data.data?.id;
        if (contractFile && workerId) {
          await uploadContract(workerId, contractFile);
        } else {
          resetWorkerForm();
          await loadWorkers();
        }
      }
    } catch {
      /* ignore */
    } finally {
      setSavingWorker(false);
    }
  };

  const deleteWorker = async (id: string) => {
    try {
      const res = await fetch(`/api/staffing/workers/${id}`, { method: 'DELETE' });
      if (res.ok) await loadWorkers();
    } catch {
      /* ignore */
    }
  };

  /* ───────────────────────────────────────────────────────────────── */
  /*  Line actions                                                     */
  /* ───────────────────────────────────────────────────────────────── */

  const resetLineForm = () => {
    setLineForm({ role: '', slots_needed: '1', start_time: '', end_time: '', location: '', uniform: '', notes: '' });
    setEditingLineId(null);
    setShowLineForm(false);
  };

  const startEditLine = (line: StaffingLine) => {
    setEditingLineId(line.id);
    setLineForm({
      role: normalizeRole(line.role),
      slots_needed: String(line.slots_needed),
      start_time: line.start_time || '',
      end_time: line.end_time || '',
      location: line.location || '',
      uniform: line.uniform || '',
      notes: line.notes || '',
    });
    setShowLineForm(true);
  };

  const saveLine = async () => {
    if (!lineForm.role.trim() || !selectedEvent) return;
    setSavingLine(true);
    try {
      const method = editingLineId ? 'PUT' : 'POST';
      const url = editingLineId
        ? `/api/staffing/lines/${editingLineId}`
        : '/api/staffing/lines';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...lineForm,
          event_id: selectedEvent,
          slots_needed: parseInt(lineForm.slots_needed) || 1,
        }),
      });
      if (res.ok) {
        resetLineForm();
        await loadStaffingLines(selectedEvent);
      }
    } catch {
      /* ignore */
    } finally {
      setSavingLine(false);
    }
  };

  const deleteLine = async (id: string) => {
    try {
      const res = await fetch(`/api/staffing/lines/${id}`, { method: 'DELETE' });
      if (res.ok && selectedEvent) {
        setLineOffers((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setLineAssignments((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        await loadStaffingLines(selectedEvent);
      }
    } catch {
      /* ignore */
    }
  };

  /* ───────────────────────────────────────────────────────────────── */
  /*  Offer actions                                                    */
  /* ───────────────────────────────────────────────────────────────── */

  const openOfferModal = (lineId: string, role: string) => {
    setOfferLineId(lineId);
    setOfferLineRole(role);
    setOfferSelectedWorkers(new Set());
  };

  const closeOfferModal = () => {
    setOfferLineId(null);
    setOfferLineRole('');
    setOfferSelectedWorkers(new Set());
  };

  const toggleOfferWorker = (workerId: string) => {
    setOfferSelectedWorkers((prev) => {
      const next = new Set(prev);
      if (next.has(workerId)) next.delete(workerId);
      else next.add(workerId);
      return next;
    });
  };

  const sendOffers = async () => {
    if (!offerLineId || offerSelectedWorkers.size === 0) return;
    setSendingOffers(true);
    try {
      const res = await fetch(`/api/staffing/lines/${offerLineId}/offers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worker_ids: Array.from(offerSelectedWorkers),
        }),
      });
      if (res.ok) {
        closeOfferModal();
        if (selectedEvent) await loadStaffingLines(selectedEvent);
        await loadLineOffers(offerLineId);
      }
    } catch {
      /* ignore */
    } finally {
      setSendingOffers(false);
    }
  };

  /* ───────────────────────────────────────────────────────────────── */
  /*  Close line action                                                */
  /* ───────────────────────────────────────────────────────────────── */

  const handleCloseLine = async (lineId: string) => {
    try {
      const res = await fetch(`/api/staffing/lines/${lineId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'filled' }),
      });
      if (res.ok && selectedEvent) {
        setCloseLineId(null);
        await loadStaffingLines(selectedEvent);
        await loadLineDetails(lineId);
      }
    } catch {
      /* ignore */
    }
  };

  /* ───────────────────────────────────────────────────────────────── */
  /*  Contract upload / delete                                         */
  /* ───────────────────────────────────────────────────────────────── */

  const uploadContract = async (workerId: string, file: File) => {
    try {
      setUploadingContract(true);
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/staffing/workers/${workerId}/contract`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        await loadWorkers();
        setContractFile(null);
      }
    } catch {
      /* ignore */
    } finally {
      setUploadingContract(false);
    }
  };

  const deleteContract = async (workerId: string) => {
    try {
      const res = await fetch(`/api/staffing/workers/${workerId}/contract`, {
        method: 'DELETE',
      });
      if (res.ok) await loadWorkers();
    } catch {
      /* ignore */
    }
  };

  /* ───────────────────────────────────────────────────────────────── */
  /*  Pay (Nomina) actions                                             */
  /* ───────────────────────────────────────────────────────────────── */

  const savePayEntry = async (workerId: string) => {
    if (!selectedEvent || !payForm.hours || !payForm.hourly_rate) return;
    setSavingPay(true);
    try {
      if (editingPayId) {
        const res = await fetch(`/api/staffing/pay?id=${editingPayId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            worker_id: workerId,
            event_id: selectedEvent,
            hours: parseFloat(payForm.hours) || 0,
            hourly_rate: parseFloat(payForm.hourly_rate) || 0,
            notes: payForm.notes,
          }),
        });
        if (res.ok) {
          setEditingPayId(null);
          setPayForm({ hours: '', hourly_rate: '', notes: '' });
          await loadWorkerPay(selectedEvent);
        }
      } else {
        const res = await fetch('/api/staffing/pay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            worker_id: workerId,
            event_id: selectedEvent,
            hours: parseFloat(payForm.hours) || 0,
            hourly_rate: parseFloat(payForm.hourly_rate) || 0,
            notes: payForm.notes,
          }),
        });
        if (res.ok) {
          setPayForm({ hours: '', hourly_rate: '', notes: '' });
          await loadWorkerPay(selectedEvent);
        }
      }
    } catch {
      /* ignore */
    } finally {
      setSavingPay(false);
    }
  };

  const deletePayEntry = async (id: string) => {
    if (!selectedEvent) return;
    try {
      const res = await fetch(`/api/staffing/pay?id=${id}`, {
        method: 'DELETE',
      });
      if (res.ok) await loadWorkerPay(selectedEvent);
    } catch {
      /* ignore */
    }
  };

  const markAsPaid = async (payId: string) => {
    setSavingPay(true);
    try {
      await fetch('/api/staffing/pay', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: payId, status: 'paid' }),
      });
      if (selectedEvent) await loadWorkerPay(String(selectedEvent));
    } catch { /* ignore */ }
    setSavingPay(false);
  };

  /* ───────────────────────────────────────────────────────────────── */
  /*  Shared styles                                                    */
  /* ───────────────────────────────────────────────────────────────── */

  const selectCls =
    'px-3 py-2.5 rounded-xl bg-white border border-[#E5E5EC] text-[#1A1A1A] text-sm focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20 focus:outline-none transition-all';

  const goldBtn =
    'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white shadow-sm transition-all hover:shadow-md';

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2
            className="text-xl font-semibold text-[#1A1A1A]"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            Personal & Staffing
          </h2>
          <p className="text-sm text-[#6B7280] mt-1">
            Gestion de trabajadores y asignacion a eventos
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F8F3E6] rounded-xl p-1 border border-[#ECECF1]">
        {(
          [
            { key: 'workers' as Tab, label: 'Trabajadores', icon: 'user' },
            { key: 'event_staffing' as Tab, label: 'Staffing por Evento', icon: 'calendar' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-white text-[#1A1A1A] shadow-sm border border-[#ECECF1]'
                : 'text-[#6B7280] hover:text-[#1A1A1A] hover:bg-white/50'
            }`}
          >
            <Icon name={tab.icon} className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ============================================================= */}
      {/*  WORKERS TAB                                                   */}
      {/* ============================================================= */}
      {activeTab === 'workers' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Icon name="user" className="w-4 h-4 text-[#C9A84C]" />
            <h3 className="text-sm font-semibold text-[#1A1A1A]">Trabajadores</h3>
            <span className="text-xs text-[#9CA3AF] ml-auto">
              {filteredWorkers.length} trabajador{filteredWorkers.length !== 1 ? 'es' : ''}
              {activeWorkersCount > 0 && (
                <span className="ml-1 text-[#16A34A]">
                  {' '}&middot; {activeWorkersCount} activos
                </span>
              )}
            </span>
          </div>

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Icon
                name="search"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8A8B0]"
              />
              <input
                type="text"
                placeholder="Buscar por nombre, telefono o rol..."
                value={searchWorker}
                onChange={(e) => setSearchWorker(e.target.value)}
                className="pl-10 pr-4 py-2.5 rounded-xl bg-white border border-[#E5E5EC] text-[#1A1A1A] text-sm placeholder:text-[#A8A8B0] focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20 focus:outline-none transition-all w-full"
              />
            </div>
            <button
              onClick={() => {
                resetWorkerForm();
                setShowWorkerForm(true);
              }}
              className={goldBtn}
              style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
            >
              <Icon name="plus" className="w-4 h-4" />
              Nuevo trabajador
            </button>
          </div>

          {/* Inline worker form */}
          {showWorkerForm && (
            <div className="bg-white rounded-2xl border border-[#C9A84C]/30 p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-[#1A1A1A]">
                  {editingWorkerId ? 'Editar trabajador' : 'Nuevo trabajador'}
                </h4>
                <button
                  onClick={resetWorkerForm}
                  className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F5F5F8] transition-colors"
                >
                  <Icon name="close" className="w-4 h-4" />
                </button>
              </div>

              {workerFormError && (
                <div className="text-xs text-[#DC2626] bg-[#FEF3F3] rounded-lg px-3 py-2">
                  {workerFormError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wider mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    value={workerForm.name}
                    onChange={(e) => setWorkerForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-[#E5E5EC] text-[#1A1A1A] text-sm focus:border-[#C9A84C] focus:outline-none"
                    placeholder="Nombre completo"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wider mb-1">
                    Telefono
                  </label>
                  <input
                    type="text"
                    value={workerForm.phone}
                    onChange={(e) => setWorkerForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-[#E5E5EC] text-[#1A1A1A] text-sm focus:border-[#C9A84C] focus:outline-none"
                    placeholder="600 000 000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wider mb-2">
                  Roles *
                </label>
                <div className="flex flex-wrap gap-2">
                  {ROLE_OPTIONS.map((role) => (
                    <button
                      key={role}
                      onClick={() => toggleWorkerRole(role)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        workerForm.roles.includes(role)
                          ? 'text-white shadow-sm'
                          : 'bg-[#F5F5F8] text-[#6B7280] hover:bg-[#ECECF1]'
                      }`}
                      style={
                        workerForm.roles.includes(role)
                          ? { background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }
                          : undefined
                      }
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>

              {/* Contract upload */}
              <div>
                <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wider mb-1">
                  Contrato laboral
                </label>
                {editingWorkerId && workers.find(w => w.id === editingWorkerId)?.contract_name && (
                  <div className="flex items-center gap-2 mb-2 p-2 bg-[#F8F3E6] rounded-lg border border-[#ECECF1]">
                    <Icon name="fileText" className="w-4 h-4 text-[#C9A84C]" />
                    <a
                      href={workers.find(w => w.id === editingWorkerId)?.contract_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#1A1A1A] underline hover:text-[#C9A84C] truncate flex-1"
                    >
                      {workers.find(w => w.id === editingWorkerId)?.contract_name}
                    </a>
                    <button
                      type="button"
                      onClick={() => editingWorkerId && deleteContract(editingWorkerId)}
                      className="p-1 rounded-lg text-[#DC2626] hover:bg-[#FEF3F3] transition-colors shrink-0"
                      title="Eliminar contrato"
                    >
                      <Icon name="trash" className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && file.size > 10 * 1024 * 1024) {
                      setWorkerFormError('El archivo no puede superar 10 MB');
                      return;
                    }
                    setContractFile(file || null);
                  }}
                  className="w-full text-sm text-[#6B7280] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-[#FBF6E9] file:text-[#A88A3A] hover:file:bg-[#F0E6C8] file:transition-colors file:cursor-pointer"
                />
                <p className="text-[10px] text-[#9CA3AF] mt-1">PDF, JPG, PNG o DOC. Max. 10 MB.</p>
                {contractFile && (
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-[#1A1A1A]">
                    <Icon name="fileText" className="w-3 h-3 text-[#C9A84C]" />
                    <span className="truncate">{contractFile.name}</span>
                    <button
                      type="button"
                      onClick={() => setContractFile(null)}
                      className="text-[#DC2626] hover:underline ml-1"
                    >
                      Quitar
                    </button>
                  </div>
                )}
                {uploadingContract && (
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-[#C9A84C]">
                    <Icon name="spinner" className="w-3 h-3 animate-spin" />
                    <span>Subiendo contrato...</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={workerForm.active}
                    onChange={(e) => setWorkerForm((f) => ({ ...f, active: e.target.checked }))}
                    className="w-4 h-4 rounded border-[#E5E5EC] text-[#C9A84C] focus:ring-[#C9A84C]"
                  />
                  <span className="text-sm text-[#6B7280]">Activo</span>
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={saveWorker}
                  disabled={savingWorker}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
                >
                  {savingWorker ? (
                    <Icon name="spinner" className="w-4 h-4 animate-spin" />
                  ) : (
                    <Icon name="check" className="w-4 h-4" />
                  )}
                  {editingWorkerId ? 'Actualizar' : 'Crear'}
                </button>
                <button
                  onClick={resetWorkerForm}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-[#6B7280] bg-[#F5F5F8] hover:bg-[#ECECF1] transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Workers table */}
          <div className="bg-white rounded-2xl border border-[#ECECF1] overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="max-h-[calc(100vh-420px)] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#FAFAFC] z-10">
                  <tr className="border-b border-[#ECECF1]">
                    <th className="text-left px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">
                      Nombre
                    </th>
                    <th className="text-left px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">
                      Telefono
                    </th>
                    <th className="text-left px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">
                      Roles
                    </th>
                    <th className="text-center px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="text-center px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWorkers.map((w) => {
                    const st = statusBadge(w.active ? 'active' : 'inactive');
                    return (
                      <tr
                        key={w.id}
                        className="border-b border-[#F2F2F5] hover:bg-[#FAFCFE] transition-colors"
                      >
                        <td className="px-4 py-2.5 text-[#1A1A1A] text-[13px] font-medium max-w-[200px] truncate" title={w.name}>
                          {w.name}
                        </td>
                        <td className="px-4 py-2.5 text-[#6B7280] text-[13px]">
                          {w.phone ? (
                            <span className="inline-flex items-center gap-1">
                              <Icon name="phone" className="w-3 h-3 text-[#C9A84C]" />
                              {w.phone}
                            </span>
                          ) : (
                            '--'
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {w.roles.map((r) => (
                              <span
                                key={r}
                                className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FBF6E9] text-[#A88A3A]"
                              >
                                {r}
                              </span>
                            ))}
                            {w.roles.length === 0 && (
                              <span className="text-[#A8A8B0] text-[12px]">--</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${st.bg} ${st.color}`}
                          >
                            {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => startEditWorker(w)}
                              className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#FBF6E9] hover:text-[#C9A84C] transition-colors"
                              title="Editar"
                            >
                              <Icon name="edit" className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteWorker(w.id)}
                              className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#FEF3F3] hover:text-[#DC2626] transition-colors"
                              title="Eliminar"
                            >
                              <Icon name="trash" className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {loadingWorkers && (
              <div className="text-center py-12 text-[#9CA3AF]">
                <Icon name="spinner" className="w-5 h-5 animate-spin mx-auto mb-2" />
                Cargando trabajadores...
              </div>
            )}
            {!loadingWorkers && filteredWorkers.length === 0 && (
              <div className="text-center py-12 text-[#9CA3AF]">
                <Icon name="user" className="w-8 h-8 mx-auto mb-2 opacity-40" />
                {searchWorker
                  ? 'No se encontraron trabajadores'
                  : 'No hay trabajadores registrados'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/*  EVENT STAFFING TAB                                            */}
      {/* ============================================================= */}
      {activeTab === 'event_staffing' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Icon name="calendar" className="w-4 h-4 text-[#C9A84C]" />
            <h3 className="text-sm font-semibold text-[#1A1A1A]">Staffing por Evento</h3>
          </div>

          {/* Event selector + New line button */}
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
              className={`${selectCls} sm:w-96`}
            >
              <option value="">Seleccionar evento...</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.client_name} -- {formatDate(ev.event_date)}
                </option>
              ))}
            </select>

            {selectedEvent && (
              <button
                onClick={() => {
                  resetLineForm();
                  setShowLineForm(true);
                }}
                className={goldBtn}
                style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
              >
                <Icon name="plus" className="w-4 h-4" />
                Nueva linea
              </button>
            )}
          </div>

          {/* Event info header */}
          {selectedEventInfo && (
            <div className="bg-[#F8F3E6] rounded-2xl border border-[#ECECF1] px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-full bg-[#C9A84C]/10 flex items-center justify-center shrink-0">
                  <Icon name="calendar" className="w-5 h-5 text-[#C9A84C]" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-[#1A1A1A] truncate">
                    {selectedEventInfo.client_name}
                  </h4>
                  <div className="flex items-center gap-2 flex-wrap text-xs text-[#6B7280]">
                    <span>{formatDate(selectedEventInfo.event_date)}</span>
                    <span>&middot;</span>
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        statusBadge(selectedEventInfo.status).bg
                      } ${statusBadge(selectedEventInfo.status).color}`}
                    >
                      {statusBadge(selectedEventInfo.status).label}
                    </span>
                    {selectedEventInfo.guest_count != null && (
                      <>
                        <span>&middot;</span>
                        <span>{selectedEventInfo.guest_count} invitados</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-[#6B7280] shrink-0">
                <span>
                  {staffingLines.length} linea{staffingLines.length !== 1 ? 's' : ''}
                </span>
                <span>
                  {staffingLines.filter((l) => l.status === 'filled').length} completa
                  {staffingLines.filter((l) => l.status === 'filled').length !== 1 ? 's' : ''}
                </span>
                {payMeta.totalPay > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FBF6E9] text-[#A88A3A] font-semibold">
                    <Icon name="banknote" className="w-3 h-3" />
                    Coste personal: {fmt(payMeta.totalPay)} EUR
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Event sub-tabs */}
          {selectedEvent && (
            <div className="flex gap-1 bg-[#F8F3E6] rounded-xl p-1 border border-[#ECECF1]">
              {([
                { key: 'lines' as EventSubTab, label: 'Lineas de staffing', icon: 'clipboardList' },
                { key: 'nomina' as EventSubTab, label: 'Nomina', icon: 'banknote' },
              ] as const).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setEventSubTab(tab.key)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    eventSubTab === tab.key
                      ? 'bg-white text-[#1A1A1A] shadow-sm border border-[#ECECF1]'
                      : 'text-[#6B7280] hover:text-[#1A1A1A] hover:bg-white/50'
                  }`}
                >
                  <Icon name={tab.icon} className="w-4 h-4" />
                  {tab.label}
                  {tab.key === 'nomina' && payMeta.count > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#C9A84C] text-white font-bold">
                      {payMeta.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Inline line form */}
          {showLineForm && selectedEvent && eventSubTab === 'lines' && (
            <div className="bg-white rounded-2xl border border-[#C9A84C]/30 p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-[#1A1A1A]">
                  {editingLineId ? 'Editar linea' : 'Nueva linea de staffing'}
                </h4>
                <button
                  onClick={resetLineForm}
                  className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F5F5F8] transition-colors"
                >
                  <Icon name="close" className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wider mb-1">
                    Rol *
                  </label>
                  <select
                    value={lineForm.role}
                    onChange={(e) => setLineForm((f) => ({ ...f, role: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-[#E5E5EC] text-[#1A1A1A] text-sm focus:border-[#C9A84C] focus:outline-none"
                  >
                    <option value="">Seleccionar rol...</option>
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wider mb-1">
                    Plazas
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={lineForm.slots_needed}
                    onChange={(e) => setLineForm((f) => ({ ...f, slots_needed: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-[#E5E5EC] text-[#1A1A1A] text-sm focus:border-[#C9A84C] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wider mb-1">
                    Inicio
                  </label>
                  <input
                    type="time"
                    value={lineForm.start_time}
                    onChange={(e) => setLineForm((f) => ({ ...f, start_time: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-[#E5E5EC] text-[#1A1A1A] text-sm focus:border-[#C9A84C] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wider mb-1">
                    Fin
                  </label>
                  <input
                    type="time"
                    value={lineForm.end_time}
                    onChange={(e) => setLineForm((f) => ({ ...f, end_time: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-[#E5E5EC] text-[#1A1A1A] text-sm focus:border-[#C9A84C] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wider mb-1">
                    Lugar
                  </label>
                  <input
                    type="text"
                    value={lineForm.location}
                    onChange={(e) => setLineForm((f) => ({ ...f, location: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-[#E5E5EC] text-[#1A1A1A] text-sm focus:border-[#C9A84C] focus:outline-none"
                    placeholder="Ej: Sala principal"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wider mb-1">
                    Uniforme
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setLineForm((f) => ({ ...f, uniform: '' }))}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all ${
                        !lineForm.uniform
                          ? 'border-[#C9A84C] bg-[#FFF8EC] text-[#8B6914] ring-1 ring-[#C9A84C]'
                          : 'border-[#E5E5EC] bg-white text-[#6B7280] hover:border-[#C9A84C]/50'
                      }`}
                    >
                      <span className="w-5 h-5 rounded-full border-2 border-dashed border-[#D1D5DB] flex items-center justify-center text-[10px] text-[#9CA3AF]">-</span>
                      Ninguno
                    </button>
                    {uniforms.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setLineForm((f) => ({ ...f, uniform: u.id }))}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all ${
                          lineForm.uniform === u.id
                            ? 'border-[#C9A84C] bg-[#FFF8EC] text-[#8B6914] ring-1 ring-[#C9A84C]'
                            : 'border-[#E5E5EC] bg-white text-[#6B7280] hover:border-[#C9A84C]/50'
                        }`}
                      >
                        <UniformIcons uniformName={u.name} />
                        <span className="truncate">{u.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wider mb-1">
                    Notas
                  </label>
                  <input
                    type="text"
                    value={lineForm.notes}
                    onChange={(e) => setLineForm((f) => ({ ...f, notes: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-[#E5E5EC] text-[#1A1A1A] text-sm focus:border-[#C9A84C] focus:outline-none"
                    placeholder="Notas adicionales"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={saveLine}
                  disabled={savingLine || !lineForm.role}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
                >
                  {savingLine ? (
                    <Icon name="spinner" className="w-4 h-4 animate-spin" />
                  ) : (
                    <Icon name="check" className="w-4 h-4" />
                  )}
                  {editingLineId ? 'Actualizar' : 'Crear'}
                </button>
                <button
                  onClick={resetLineForm}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-[#6B7280] bg-[#F5F5F8] hover:bg-[#ECECF1] transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Staffing lines grouped by role */}
          {selectedEvent && !loadingLines && staffingLines.length > 0 && eventSubTab === 'lines' && (
            <div className="space-y-6">
              {Object.entries(linesByRole).map(([role, lines]) => (
                <div key={role}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FBF6E9] text-[#A88A3A] text-xs font-semibold">
                      <Icon name="user" className="w-3 h-3" />
                      {role}
                    </span>
                    <span className="text-xs text-[#9CA3AF]">
                      {lines.length} linea{lines.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {lines.map((line) => (
                      <StaffingLineCard
                        key={line.id}
                        line={line}
                        offers={lineOffers[line.id] || []}
                        assignments={lineAssignments[line.id] || []}
                        workers={workers}
                        uniforms={uniforms}
                        loadingOffers={!!loadingOffers[line.id]}
                        onEdit={startEditLine}
                        onDelete={deleteLine}
                        onBroadcast={openOfferModal}
                        onCloseLine={(lineId) => handleCloseLine(lineId)}
                        onRefresh={() => {
                          if (selectedEvent) loadStaffingLines(selectedEvent);
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Loading */}
          {selectedEvent && loadingLines && eventSubTab === 'lines' && (
            <div className="text-center py-12 text-[#9CA3AF]">
              <Icon name="spinner" className="w-5 h-5 animate-spin mx-auto mb-2" />
              Cargando lineas de staffing...
            </div>
          )}

          {/* Empty state */}
          {selectedEvent && !loadingLines && staffingLines.length === 0 && eventSubTab === 'lines' && (
            <div className="bg-white rounded-2xl border border-[#ECECF1] p-12 text-center text-[#9CA3AF]">
              <Icon name="clipboardList" className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No hay lineas de staffing para este evento</p>
              <p className="text-xs mt-1">Crea una nueva linea para empezar a planificar el personal</p>
            </div>
          )}

          {/* ──────────────── Nomina sub-tab ──────────────── */}
          {selectedEvent && eventSubTab === 'nomina' && (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white rounded-xl border border-[#ECECF1] px-4 py-3">
                  <p className="text-[10px] font-medium text-[#9CA3AF] uppercase tracking-wider">Total horas</p>
                  <p className="text-lg font-bold text-[#1A1A1A] mt-0.5">{fmt(payMeta.totalHours, 1)}</p>
                </div>
                <div className="bg-white rounded-xl border border-[#ECECF1] px-4 py-3">
                  <p className="text-[10px] font-medium text-[#9CA3AF] uppercase tracking-wider">Coste total</p>
                  <p className="text-lg font-bold text-[#C9A84C] mt-0.5">{fmt(payMeta.totalPay)} EUR</p>
                </div>
                <div className="bg-white rounded-xl border border-[#ECECF1] px-4 py-3">
                  <p className="text-[10px] font-medium text-[#9CA3AF] uppercase tracking-wider">Trabajadores</p>
                  <p className="text-lg font-bold text-[#1A1A1A] mt-0.5">{payMeta.count}</p>
                </div>
              </div>

              {/* Add pay entry button */}
              <div className="flex justify-end">
                <button
                  onClick={() => setShowAddPay(!showAddPay)}
                  className="px-4 py-2 rounded-xl text-xs font-medium border border-[#C9A84C]/30 text-[#A88A3A] hover:bg-[#FBF6E9] transition-all"
                >
                  {showAddPay ? 'Cancelar' : '+ Agregar trabajador a nómina'}
                </button>
              </div>

              {/* Add pay entry form */}
              {showAddPay && (
                <div className="bg-white rounded-2xl border border-[#C9A84C]/30 p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] font-medium text-[#6B7280] uppercase tracking-wider mb-1">Trabajador</label>
                      <select
                        value={newPayForm.worker_id}
                        onChange={(e) => setNewPayForm(f => ({ ...f, worker_id: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-[#E5E5EC] text-sm focus:border-[#C9A84C] focus:outline-none"
                      >
                        <option value="">Seleccionar...</option>
                        {workers.filter(w => w.active && !workerPay.some(p => p.worker_id === w.id)).map(w => (
                          <option key={w.id} value={w.id}>{w.name} ({w.roles.join(', ')})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-[#6B7280] uppercase tracking-wider mb-1">Horas</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={newPayForm.hours}
                        onChange={(e) => setNewPayForm(f => ({ ...f, hours: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-[#E5E5EC] text-sm focus:border-[#C9A84C] focus:outline-none"
                        placeholder="8"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-[#6B7280] uppercase tracking-wider mb-1">Tarifa (EUR/h)</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={newPayForm.hourly_rate}
                        onChange={(e) => setNewPayForm(f => ({ ...f, hourly_rate: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-[#E5E5EC] text-sm focus:border-[#C9A84C] focus:outline-none"
                        placeholder="10"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={async () => {
                          if (!newPayForm.worker_id || !newPayForm.hours) return;
                          setSavingPay(true);
                          try {
                            await fetch('/api/staffing/pay', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                worker_id: newPayForm.worker_id,
                                event_id: String(selectedEvent),
                                hours: parseFloat(newPayForm.hours),
                                hourly_rate: parseFloat(newPayForm.hourly_rate) || 10,
                                notes: newPayForm.notes,
                              }),
                            });
                            setShowAddPay(false);
                            setNewPayForm({ worker_id: '', hours: '', hourly_rate: '10', notes: '' });
                            await loadWorkerPay(String(selectedEvent));
                          } catch { /* ignore */ }
                          setSavingPay(false);
                        }}
                        disabled={!newPayForm.worker_id || !newPayForm.hours || savingPay}
                        className="w-full px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40 transition-all"
                        style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
                      >
                        {savingPay ? 'Guardando...' : 'Guardar'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Pay table */}
              {loadingPay ? (
                <div className="text-center py-12 text-[#9CA3AF]">
                  <Icon name="spinner" className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Cargando nómina...
                </div>
              ) : workerPay.length > 0 ? (
                <div className="space-y-4">
                  {/* Summary cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white rounded-xl border border-[#ECECF1] p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                        <p className="text-[10px] font-medium text-[#9CA3AF] uppercase tracking-wider">Pendientes</p>
                      </div>
                      <p className="text-xl font-bold text-[#F59E0B]">{payMeta.pendingCount || 0}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-[#ECECF1] p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
                        <p className="text-[10px] font-medium text-[#9CA3AF] uppercase tracking-wider">Pagados</p>
                      </div>
                      <p className="text-xl font-bold text-[#16A34A]">{payMeta.paidCount || 0}</p>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="bg-white rounded-2xl border border-[#ECECF1] overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                    <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#ECECF1] bg-[#FAFAFC]">
                          <th className="text-left px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Trabajador</th>
                          <th className="text-left px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Rol</th>
                          <th className="text-center px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Horas</th>
                          <th className="text-center px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Tarifa (EUR/h)</th>
                          <th className="text-right px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Total (EUR)</th>
                          <th className="text-center px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Estado</th>
                          <th className="text-left px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Pagado el</th>
                          <th className="text-left px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Notas</th>
                          <th className="text-center px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workerPay.map((p: any) => {
                          const isEditing = editingPayId === p.id;
                          const isPaid = p.status === 'paid';
                          const computedTotal = isEditing
                            ? (parseFloat(payForm.hours) || 0) * (parseFloat(payForm.hourly_rate) || 0)
                            : (p.total_pay || 0);
                          return (
                            <tr key={p.id} className={`border-b border-[#F2F2F5] hover:bg-[#FAFCFE] transition-colors ${isPaid ? 'opacity-60' : ''}`}>
                              <td className="px-4 py-2.5 text-[#1A1A1A] text-[13px] font-medium">{p.worker_name}</td>
                              <td className="px-4 py-2.5">
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FBF6E9] text-[#A88A3A]">
                                  {p.role || (p.worker_roles && p.worker_roles[0]) || '--'}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    value={payForm.hours}
                                    onChange={(e) => setPayForm(f => ({ ...f, hours: e.target.value }))}
                                    className="w-16 px-2 py-1 text-center rounded-lg border border-[#C9A84C] text-sm focus:outline-none"
                                  />
                                ) : (
                                  <span className="text-[13px]">{fmt(p.hours, 1)}</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    value={payForm.hourly_rate}
                                    onChange={(e) => setPayForm(f => ({ ...f, hourly_rate: e.target.value }))}
                                    className="w-16 px-2 py-1 text-center rounded-lg border border-[#C9A84C] text-sm focus:outline-none"
                                  />
                                ) : (
                                  <span className="text-[13px]">{fmt(p.hourly_rate)}</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <span className="text-[13px] font-semibold text-[#C9A84C]">
                                  {isEditing ? fmt(computedTotal) : fmt(p.total_pay)} EUR
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <span
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                  style={isPaid
                                    ? { backgroundColor: '#DCFCE7', color: '#16A34A' }
                                    : { backgroundColor: '#FEF9C3', color: '#F59E0B' }
                                  }
                                >
                                  {isPaid ? 'Pagado' : 'Pendiente'}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-[12px] text-[#6B7280]">
                                {p.paid_at ? new Date(p.paid_at).toLocaleDateString('es-ES') : '--'}
                              </td>
                              <td className="px-4 py-2.5 text-[#6B7280] text-[12px]">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={payForm.notes}
                                    onChange={(e) => setPayForm(f => ({ ...f, notes: e.target.value }))}
                                    className="w-full px-2 py-1 rounded-lg border border-[#C9A84C] text-sm focus:outline-none"
                                    placeholder="Notas..."
                                  />
                                ) : (
                                  <span className="truncate block max-w-[100px]">{p.notes || '--'}</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {isEditing ? (
                                    <>
                                      <button
                                        onClick={() => savePayEntry(p.worker_id)}
                                        disabled={savingPay}
                                        className="p-1.5 rounded-lg text-[#16A34A] hover:bg-[#EFFAF2] transition-colors"
                                        title="Guardar"
                                      >
                                        {savingPay ? (
                                          <Icon name="spinner" className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                          <Icon name="check" className="w-3.5 h-3.5" />
                                        )}
                                      </button>
                                      <button
                                        onClick={() => { setEditingPayId(null); setPayForm({ hours: '', hourly_rate: '', notes: '' }); }}
                                        className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F5F5F8] transition-colors"
                                        title="Cancelar"
                                      >
                                        <Icon name="close" className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => {
                                          setEditingPayId(p.id);
                                          setPayForm({ hours: String(p.hours), hourly_rate: String(p.hourly_rate), notes: p.notes || '' });
                                        }}
                                        className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#FBF6E9] hover:text-[#C9A84C] transition-colors"
                                        title="Editar"
                                      >
                                        <Icon name="edit" className="w-3.5 h-3.5" />
                                      </button>
                                      {!isPaid && (
                                        <button
                                          onClick={() => markAsPaid(p.id)}
                                          disabled={savingPay}
                                          className="p-1.5 rounded-lg text-[#16A34A] hover:bg-[#EFFAF2] transition-colors"
                                          title="Marcar Pagado"
                                        >
                                          <Icon name="check-circle" className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                      <button
                                        onClick={() => deletePayEntry(p.id)}
                                        className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#FEF3F3] hover:text-[#DC2626] transition-colors"
                                        title="Eliminar"
                                      >
                                        <Icon name="trash" className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-[#F8F3E6] font-semibold">
                          <td className="px-4 py-2.5 text-[13px] text-[#1A1A1A]" colSpan={2}>Total ({payMeta.count} registros)</td>
                          <td className="px-4 py-2.5 text-center text-[13px] text-[#1A1A1A]">{fmt(payMeta.totalHours, 1)}</td>
                          <td className="px-4 py-2.5 text-center text-[13px] text-[#1A1A1A]">--</td>
                          <td className="px-4 py-2.5 text-right text-[13px]">
                            <span className="text-[#C9A84C]">{fmt(payMeta.totalPay)} EUR</span>
                          </td>
                          <td className="px-4 py-2.5 text-center text-[11px]">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#FEF9C3', color: '#F59E0B' }}>
                              {payMeta.pendingCount || 0} pend.
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center text-[11px]">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#DCFCE7', color: '#16A34A' }}>
                              {payMeta.paidCount || 0} pag.
                            </span>
                          </td>
                          <td className="px-4 py-2.5"></td>
                          <td className="px-4 py-2.5"></td>
                        </tr>
                      </tfoot>
                    </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-[#ECECF1] p-12 text-center text-[#9CA3AF]">
                  <Icon name="banknote" className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No hay registros de nómina para este evento</p>
                  <p className="text-xs mt-1 mb-4">Agrega trabajadores y registra sus horas para calcular la nómina</p>
                  <button
                    onClick={() => setShowAddPay(true)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-white"
                    style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
                  >
                    + Agregar primer trabajador
                  </button>
                </div>
              )}
            </div>
          )}

          {!selectedEvent && (
            <div className="bg-white rounded-2xl border border-[#ECECF1] p-12 text-center text-[#9CA3AF]">
              <Icon name="calendar" className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Selecciona un evento para ver y gestionar su staffing</p>
            </div>
          )}
        </div>
      )}

      {/* ============================================================= */}
      {/*  OFFER MODAL                                                   */}
      {/* ============================================================= */}
      {offerLineId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={closeOfferModal}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-2xl border border-[#ECECF1] shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-[#ECECF1] flex items-center justify-between">
              <div>
                <h3
                  className="text-base font-semibold text-[#1A1A1A]"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                >
                  Difundir oferta
                </h3>
                <p className="text-xs text-[#9CA3AF] mt-0.5">
                  Rol: {offerLineRole} -- Selecciona trabajadores para enviar la oferta por WhatsApp
                </p>
              </div>
              <button
                onClick={closeOfferModal}
                className="p-2 rounded-lg text-[#6B7280] hover:bg-[#F5F5F8] transition-colors"
              >
                <Icon name="close" className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto px-6 py-4 space-y-2">
              {workersForOffer.length === 0 ? (
                <div className="text-center py-8 text-[#9CA3AF]">
                  <Icon name="user" className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">
                    No hay trabajadores activos con el rol &ldquo;{offerLineRole}&rdquo;
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-[#9CA3AF]">
                      {workersForOffer.length} trabajador{workersForOffer.length !== 1 ? 'es' : ''} disponible{workersForOffer.length !== 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={() => {
                        if (offerSelectedWorkers.size === workersForOffer.length) {
                          setOfferSelectedWorkers(new Set());
                        } else {
                          setOfferSelectedWorkers(new Set(workersForOffer.map((w) => w.id)));
                        }
                      }}
                      className="text-xs text-[#C9A84C] hover:underline font-medium"
                    >
                      {offerSelectedWorkers.size === workersForOffer.length
                        ? 'Deseleccionar todos'
                        : 'Seleccionar todos'}
                    </button>
                  </div>
                  {workersForOffer.map((w) => (
                    <label
                      key={w.id}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                        offerSelectedWorkers.has(w.id)
                          ? 'border-[#C9A84C] bg-[#FBF6E9]'
                          : 'border-[#ECECF1] hover:border-[#D0D0D8] hover:bg-[#FAFCFE]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={offerSelectedWorkers.has(w.id)}
                        onChange={() => toggleOfferWorker(w.id)}
                        className="w-4 h-4 rounded border-[#E5E5EC] text-[#C9A84C] focus:ring-[#C9A84C]"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-[#1A1A1A]">{w.name}</span>
                        {w.phone && (
                          <span className="text-xs text-[#9CA3AF] ml-2">{maskPhone(w.phone)}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {w.roles.slice(0, 3).map((r) => (
                          <span
                            key={r}
                            className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F5F5F8] text-[#6B7280]"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </label>
                  ))}
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-[#F2F2F5] flex items-center justify-between">
              <span className="text-xs text-[#9CA3AF]">
                {offerSelectedWorkers.size} seleccionado{offerSelectedWorkers.size !== 1 ? 's' : ''}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={closeOfferModal}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-[#6B7280] bg-[#F5F5F8] hover:bg-[#ECECF1] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={sendOffers}
                  disabled={sendingOffers || offerSelectedWorkers.size === 0}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
                >
                  {sendingOffers ? (
                    <Icon name="spinner" className="w-4 h-4 animate-spin" />
                  ) : (
                    <Icon name="send" className="w-4 h-4" />
                  )}
                  Enviar oferta{offerSelectedWorkers.size > 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
