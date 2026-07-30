'use client';

/**
 * EventFlow — Public Shift Confirmation Page
 * /turno/[token] — Workers can accept or reject their assigned shifts
 * No login required, uses offer_token for authentication.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  MapPin, 
  Calendar, 
  User,
  Loader2,
  AlertCircle,
  Utensils
} from 'lucide-react';

// ============================================================
// Types
// ============================================================

interface ShiftData {
  id: string;
  worker_name: string;
  worker_phone: string;
  role: string;
  event_name: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  status: string;
}

// ============================================================
// Role icons mapping
// ============================================================

const roleIcons: Record<string, React.ReactNode> = {
  camarero: <Utensils className="w-5 h-5" />,
  cocinero: <Utensils className="w-5 h-5" />,
  maitre: <User className="w-5 h-5" />,
  barman: <Utensils className="w-5 h-5" />,
};

// ============================================================
// Main Component
// ============================================================

export default function TurnoPage() {
  const params = useParams();
  const token = params.token as string;

  const [shift, setShift] = useState<ShiftData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch shift data
  const fetchShift = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/public/shift/${token}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al cargar el turno');
      }

      setShift(data.data);
      if (data.message) {
        setSuccessMessage(data.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchShift();
    }
  }, [token, fetchShift]);

  // Handle accept/reject action
  const handleAction = async (action: 'accept' | 'reject') => {
    try {
      setActionLoading(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch(`/api/public/shift/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al procesar la solicitud');
      }

      // Update local state
      if (shift) {
        setShift({
          ...shift,
          status: action === 'accept' ? 'accepted' : 'rejected',
        });
      }

      setSuccessMessage(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setActionLoading(false);
    }
  };

  // ============================================================
  // Render states
  // ============================================================

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Cargando información del turno...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !shift) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Turno no encontrado</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <p className="text-sm text-gray-500">
            El enlace puede haber expirado o ser incorrecto.
            <br />
            Contacta con tu maitre para obtener un nuevo enlace.
          </p>
        </div>
      </div>
    );
  }

  // Success state (after action)
  if (successMessage && shift) {
    const isAccepted = shift.status === 'accepted';
    return (
      <div className={`min-h-screen ${isAccepted ? 'bg-gradient-to-br from-green-50 to-emerald-100' : 'bg-gradient-to-br from-gray-50 to-slate-100'} flex items-center justify-center p-4`}>
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
          {isAccepted ? (
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          ) : (
            <XCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          )}
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            {isAccepted ? '¡Turno Aceptado!' : 'Turno Rechazado'}
          </h1>
          <p className="text-gray-600 mb-6">{successMessage}</p>
          
          <div className="bg-gray-50 rounded-xl p-4 text-left">
            <h3 className="font-semibold text-gray-700 mb-2">Resumen:</h3>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Evento:</span> {shift.event_name}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Fecha:</span> {shift.event_date}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Rol:</span> {shift.role}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Main shift display
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500 rounded-full mb-4">
            <Utensils className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">EventFlow</h1>
          <p className="text-gray-600">Confirmación de Turno</p>
        </div>

        {/* Shift Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Role Header */}
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 text-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-white/20 rounded-lg">
                {roleIcons[shift?.role || ''] || <User className="w-5 h-5" />}
              </div>
              <div>
                <h2 className="text-xl font-bold capitalize">{shift?.role}</h2>
                <p className="text-blue-100 text-sm">{shift?.worker_name}</p>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="p-6 space-y-4">
            {/* Event Info */}
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="font-medium text-gray-800">{shift?.event_name}</p>
                <p className="text-sm text-gray-600">{shift?.event_date}</p>
              </div>
            </div>

            {/* Time */}
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="font-medium text-gray-800">
                  {shift?.start_time && shift?.end_time
                    ? `${shift.start_time} - ${shift.end_time}`
                    : 'Horario por definir'}
                </p>
                {shift?.start_time && shift?.end_time && (
                  <p className="text-sm text-gray-600">
                    {(() => {
                      const start = new Date(`2000-01-01T${shift.start_time}`);
                      const end = new Date(`2000-01-01T${shift.end_time}`);
                      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                      return `${hours} horas`;
                    })()}
                  </p>
                )}
              </div>
            </div>

            {/* Location */}
            {shift?.location && (
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-800">{shift.location}</p>
                </div>
              </div>
            )}

            {/* Status Badge */}
            {shift?.status && shift.status !== 'sent' && (
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                shift.status === 'accepted' 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {shift.status === 'accepted' ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                {shift.status === 'accepted' ? 'Aceptado' : 'Rechazado'}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {shift?.status === 'sent' && (
            <div className="p-6 pt-0 space-y-3">
              <button
                onClick={() => handleAction('accept')}
                disabled={actionLoading}
                className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <CheckCircle className="w-5 h-5" />
                )}
                Aceptar Turno
              </button>

              <button
                onClick={() => handleAction('reject')}
                disabled={actionLoading}
                className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
                Rechazar Turno
              </button>

              <p className="text-xs text-center text-gray-500 mt-4">
                Por favor, confirma tu disponibilidad lo antes posible.
              </p>
            </div>
          )}

          {/* Error display */}
          {error && shift && (
            <div className="p-4 bg-red-50 border-t border-red-100">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5" />
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-6">
          EventFlow — Sistema de Gestión de Eventos
        </p>
      </div>
    </div>
  );
}
