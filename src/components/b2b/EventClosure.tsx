'use client';

/**
 * EventFlow — Pestaña de Cierre Operativo (WP-18)
 * Checklist de cierre con autocompletado y override por Gerente.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Lock,
  Clock,
  Users,
  ClipboardCheck,
  ShieldCheck,
} from 'lucide-react';

import { formatDate } from '@/lib/format';

// ============================================================
// Types
// ============================================================

interface ClosureStatus {
  checklist: {
    id: string;
    event_id: string;
    logistics_override: boolean | null;
    waste_override: boolean | null;
    hours_override: boolean | null;
    appcc_override: boolean | null;
    override_reason: string | null;
    closed_by: string | null;
    closed_at: string | null;
  } | null;
  autoStatus: {
    logistics_returned: boolean;
    waste_recorded: boolean;
    hours_validated: boolean;
    appcc_resolved: boolean;
  };
  effectiveStatus: {
    logistics_returned: boolean;
    waste_recorded: boolean;
    hours_validated: boolean;
    appcc_resolved: boolean;
  };
  isComplete: boolean;
  canClose: boolean;
}

interface EventClosureProps {
  eventId: string;
  eventStatus: string;
  onStatusChange?: () => void;
}

// ============================================================
// Check Item Component
// ============================================================

interface CheckItemProps {
  label: string;
  description: string;
  icon: React.ReactNode;
  autoValue: boolean;
  effectiveValue: boolean;
  overrideValue: boolean | null;
  onOverride: (value: boolean | null) => void;
  isClosed: boolean;
}

function CheckItem({
  label,
  description,
  icon,
  autoValue,
  effectiveValue,
  overrideValue,
  onOverride,
  isClosed,
}: CheckItemProps) {
  const [showOverride, setShowOverride] = useState(false);

  const status = effectiveValue ? 'complete' : 'pending';
  const isOverridden = overrideValue !== null;

  return (
    <div className={`p-4 rounded-lg border transition-colors ${
      status === 'complete'
        ? 'bg-success/5 border-success/20'
        : 'bg-cream-dark border-cream-dark'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center ${
            status === 'complete'
              ? 'bg-success/10 text-success'
              : 'bg-ink/10 text-ink-soft-60'
          }`}>
            {status === 'complete' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Clock className="w-4 h-4" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-ink">{label}</h4>
              {isOverridden && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-warning/10 text-warning">
                  Override
                </span>
              )}
            </div>
            <p className="text-xs text-ink-soft-60 mt-0.5">{description}</p>
            <p className="text-[10px] text-ink-soft-60 mt-1">
              Estado automático: {autoValue ? '✓ Cumplido' : 'Pendiente'}
            </p>
          </div>
        </div>

        {!isClosed && (
          <div className="relative">
            <button
              onClick={() => setShowOverride(!showOverride)}
              className="p-1.5 rounded-lg hover:bg-cream-dark transition-colors"
              title="Override manual"
            >
              <RotateCcw className="w-4 h-4 text-ink-soft-60" />
            </button>

            {showOverride && (
              <div className="absolute right-0 top-full mt-1 z-10 bg-white rounded-lg shadow-lg border border-cream-dark p-2 min-w-[160px]">
                <p className="text-[10px] text-ink-soft-60 mb-2 font-medium">Forzar estado:</p>
                <div className="space-y-1">
                  <button
                    onClick={() => { onOverride(true); setShowOverride(false); }}
                    className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-success/10 text-ink flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-3 h-3 text-success" />
                    Cumplido
                  </button>
                  <button
                    onClick={() => { onOverride(false); setShowOverride(false); }}
                    className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-danger/10 text-ink flex items-center gap-2"
                  >
                    <XCircle className="w-3 h-3 text-danger" />
                    No cumplido
                  </button>
                  <button
                    onClick={() => { onOverride(null); setShowOverride(false); }}
                    className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-cream text-ink-soft flex items-center gap-2"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Restaurar automático
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export default function EventClosure({ eventId, eventStatus, onStatusChange }: EventClosureProps) {
  const [status, setStatus] = useState<ClosureStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [hasOverrides, setHasOverrides] = useState(false);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch closure status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/closure`);
      const data = await res.json();
      if (data.success) {
        setStatus(data.data);
        // Check if there are existing overrides
        const cl = data.data.checklist;
        if (cl && (cl.logistics_override !== null || cl.waste_override !== null ||
            cl.hours_override !== null || cl.appcc_override !== null)) {
          setHasOverrides(true);
          setOverrideReason(cl.override_reason || '');
        }
      } else {
        setError(data.error);
      }
    } catch {
      setError('Error al cargar el checklist');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Handle override change
  const handleOverride = async (field: string, value: boolean | null) => {
    if (!status) return;

    // Check if we need a reason
    const autoValue = status.autoStatus[field as keyof typeof status.autoStatus];
    const needsReason = value !== autoValue && value !== null;

    if (needsReason && !overrideReason.trim()) {
      setMessage({ type: 'error', text: 'El motivo es obligatorio para sobreescribir un check' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/events/${eventId}/closure`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [`${field}_override`]: value,
          override_reason: overrideReason.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setStatus(data.data.status);
        setHasOverrides(true);
        setMessage({ type: 'success', text: 'Checklist actualizado' });
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch {
      setMessage({ type: 'error', text: 'Error al actualizar' });
    } finally {
      setSaving(false);
    }
  };

  // Handle close event
  const handleClose = async () => {
    if (!status?.canClose) return;

    setClosing(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/events/${eventId}/closure`, {
        method: 'POST',
      });

      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Evento cerrado operativamente' });
        onStatusChange?.();
        fetchStatus();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch {
      setMessage({ type: 'error', text: 'Error al cerrar el evento' });
    } finally {
      setClosing(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-cream-dark rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error || !status) {
    return (
      <div className="p-4 rounded-lg bg-danger/10 border border-danger/20 text-sm text-danger">
        {error || 'No se pudo cargar el checklist'}
      </div>
    );
  }

  const isClosed = eventStatus === 'cerrado_operativo' || eventStatus === 'completed';
  const checks = [
    {
      key: 'logistics_returned',
      label: 'Logística retornada',
      description: 'Todos los ítems de carga y logística han sido retornados correctamente.',
      icon: <RotateCcw className="w-4 h-4" />,
    },
    {
      key: 'waste_recorded',
      label: 'Mermas registradas',
      description: 'Las mermas y consumos del evento han sido registrados en el sistema.',
      icon: <AlertTriangle className="w-4 h-4" />,
    },
    {
      key: 'hours_validated',
      label: 'Horas aprobadas',
      description: 'Las horas del personal asignado al evento están aprobadas.',
      icon: <Users className="w-4 h-4" />,
    },
    {
      key: 'appcc_resolved',
      label: 'APPCC sin incidencias',
      description: 'No hay incidencias abiertas de APPCC/HACCP para este evento.',
      icon: <ShieldCheck className="w-4 h-4" />,
    },
  ];

  const completedCount = checks.filter(
    (c) => status.effectiveStatus[c.key as keyof typeof status.effectiveStatus]
  ).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-gold" />
          <h3 className="font-heading text-lg font-semibold text-ink">Checklist de Cierre</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            status.isComplete
              ? 'bg-success/10 text-success'
              : 'bg-warning/10 text-warning'
          }`}>
            {completedCount}/4 completados
          </span>
          {isClosed && (
            <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-ink/10 text-ink">
              <Lock className="w-3 h-3" />
              Cerrado
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-cream-dark rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${
            status.isComplete ? 'bg-success' : 'bg-gold'
          }`}
          style={{ width: `${(completedCount / 4) * 100}%` }}
        />
      </div>

      {/* Checks */}
      <div className="space-y-3">
        {checks.map((check) => (
          <CheckItem
            key={check.key}
            label={check.label}
            description={check.description}
            icon={check.icon}
            autoValue={status.autoStatus[check.key as keyof typeof status.autoStatus]}
            effectiveValue={status.effectiveStatus[check.key as keyof typeof status.effectiveStatus]}
            overrideValue={status.checklist?.[`${check.key}_override` as keyof typeof status.checklist] as boolean | null}
            onOverride={(value) => handleOverride(check.key, value)}
            isClosed={isClosed}
          />
        ))}
      </div>

      {/* Override reason */}
      {hasOverrides && !isClosed && (
        <div className="p-3 bg-cream-dark rounded-lg">
          <label className="block text-[11px] uppercase tracking-wider text-ink-soft-60 font-semibold mb-1.5">
            Motivo del override
          </label>
          <textarea
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            placeholder="Indica el motivo por el que sobreescribes el estado automático..."
            rows={2}
            className="w-full text-sm border border-cream-dark rounded-lg px-3 py-2 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-gold/30"
          />
        </div>
      )}

      {/* Messages */}
      {message && (
        <div className={`p-3 rounded-lg text-sm ${
          message.type === 'success'
            ? 'bg-success/10 text-success border border-success/20'
            : 'bg-danger/10 text-danger border border-danger/20'
        }`}>
          {message.text}
        </div>
      )}

      {/* Close button */}
      {!isClosed && (
        <div className="pt-2">
          <button
            onClick={handleClose}
            disabled={!status.canClose || closing}
            className={`w-full py-3 rounded-lg font-medium text-sm transition-colors ${
              status.canClose
                ? 'bg-ink text-white hover:bg-ink-light'
                : 'bg-cream-dark text-ink-soft-600 cursor-not-allowed'
            } disabled:opacity-50`}
          >
            {closing ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Cerrando evento...
              </span>
            ) : status.canClose ? (
              <span className="flex items-center justify-center gap-2">
                <Lock className="w-4 h-4" />
                Cerrar Evento Operativamente
              </span>
            ) : (
              `Checklist incompleto (${4 - completedCount} pendientes)`
            )}
          </button>
          {!status.canClose && (
            <p className="text-[10px] text-ink-soft-60 text-center mt-2">
              Completa todos los checks o usa override para poder cerrar
            </p>
          )}
        </div>
      )}

      {/* Closed info */}
      {isClosed && status.checklist?.closed_at && (
        <div className="p-3 bg-ink/5 rounded-lg text-sm text-ink-soft">
          <p>Evento cerrado el {formatDate(status.checklist.closed_at)}</p>
        </div>
      )}
    </div>
  );
}
