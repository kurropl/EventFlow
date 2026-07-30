'use client';

/**
 * EventFlow — Staffing Planning Page
 * /admin/staffing/planificacion
 * 
 * Shows staffing requirements for events and allows:
 * - Viewing staffing lines per event
 * - Sending offers to workers
 * - Tracking offer status (sent/accepted/rejected)
 */

import { useState, useEffect } from 'react';
import { 
  Users, 
  Calendar, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Send,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  MapPin,
  Mail
} from 'lucide-react';

// ============================================================
// Types
// ============================================================

interface StaffingLine {
  id: string;
  event_id: string;
  role: string;
  slots_needed: number;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  status: string;
  event_name: string;
  event_date: string;
  assigned_count: number;
  offers_sent: number;
}

interface StaffingOffer {
  id: string;
  worker_id: string;
  status: string;
  sent_at: string;
  responded_at: string | null;
  worker_name: string;
  worker_phone: string;
}

// ============================================================
// Main Component
// ============================================================

export default function StaffingPlanificacionPage() {
  const [lines, setLines] = useState<StaffingLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLine, setExpandedLine] = useState<string | null>(null);
  const [offers, setOffers] = useState<StaffingOffer[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [sendingOffers, setSendingOffers] = useState(false);

  // Fetch staffing lines
  useEffect(() => {
    fetchLines();
  }, []);

  const fetchLines = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/staffing/lines');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al cargar líneas de staffing');
      }
      
      setLines(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  // Fetch offers for a specific line
  const fetchOffers = async (lineId: string) => {
    try {
      setLoadingOffers(true);
      const response = await fetch(`/api/staffing/lines/${lineId}/offers`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al cargar ofertas');
      }
      
      setOffers(data.data || []);
    } catch (err) {
      console.error('Error fetching offers:', err);
    } finally {
      setLoadingOffers(false);
    }
  };

  // Handle expand/collapse line
  const toggleLine = async (lineId: string) => {
    if (expandedLine === lineId) {
      setExpandedLine(null);
      setOffers([]);
    } else {
      setExpandedLine(lineId);
      await fetchOffers(lineId);
    }
  };

  // Handle send offers
  const handleSendOffers = async (lineId: string) => {
    try {
      setSendingOffers(true);
      const response = await fetch(`/api/staffing/lines/${lineId}/offers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}) // Empty body = auto-select workers by role
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al enviar ofertas');
      }
      
      // Refresh offers
      await fetchOffers(lineId);
      await fetchLines(); // Refresh counts
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al enviar ofertas');
    } finally {
      setSendingOffers(false);
    }
  };

  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Por definir';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Format time
  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  // Get status badge color
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-yellow-100 text-yellow-700';
      case 'filled':
        return 'bg-green-100 text-green-700';
      case 'cancelled':
        return 'bg-gray-100 text-gray-500';
      default:
        return 'bg-gray-100 text-gray-500';
    }
  };

  // Get offer status badge
  const getOfferStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-blue-100 text-blue-700';
      case 'accepted':
        return 'bg-green-100 text-green-700';
      case 'rejected':
        return 'bg-red-100 text-red-700';
      case 'expired':
        return 'bg-gray-100 text-gray-500';
      default:
        return 'bg-gray-100 text-gray-500';
    }
  };

  // ============================================================
  // Render
  // ============================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5" />
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Planificación de Personal</h1>
        <p className="text-gray-600 mt-1">
          Gestiona las necesidades de personal y envía ofertas a los trabajadores
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Líneas</p>
              <p className="text-xl font-bold text-gray-800">{lines.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pendientes</p>
              <p className="text-xl font-bold text-gray-800">
                {lines.filter(l => l.status === 'open').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Completadas</p>
              <p className="text-xl font-bold text-gray-800">
                {lines.filter(l => l.status === 'filled').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Send className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Ofertas Enviadas</p>
              <p className="text-xl font-bold text-gray-800">
                {lines.reduce((sum, l) => sum + l.offers_sent, 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Staffing Lines List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Líneas de Staffing</h2>
        </div>
        
        {lines.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No hay líneas de staffing creadas</p>
            <p className="text-sm mt-1">
              Las líneas se generan automáticamente al confirmar eventos
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {lines.map((line) => (
              <div key={line.id} className="hover:bg-gray-50">
                {/* Line Header */}
                <div 
                  className="px-6 py-4 cursor-pointer"
                  onClick={() => toggleLine(line.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-blue-600" />
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-800 capitalize">
                            {line.role}
                          </h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(line.status)}`}>
                            {line.status === 'open' ? 'Abierto' : line.status === 'filled' ? 'Completado' : line.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {line.event_name} — {formatDate(line.event_date)}
                          </span>
                          {line.start_time && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {formatTime(line.start_time)} - {formatTime(line.end_time)}
                            </span>
                          )}
                          {line.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              {line.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-800">
                          {line.assigned_count} / {line.slots_needed}
                        </p>
                        <p className="text-xs text-gray-500">Asignados</p>
                      </div>
                      
                      {expandedLine === line.id ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Expanded Content */}
                {expandedLine === line.id && (
                  <div className="px-6 pb-4 bg-gray-50">
                    {/* Action Buttons */}
                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={() => handleSendOffers(line.id)}
                        disabled={sendingOffers || line.status === 'filled'}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {sendingOffers ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        Enviar Ofertas
                      </button>
                    </div>
                    
                    {/* Offers List */}
                    <div className="bg-white rounded-lg border border-gray-200">
                      <div className="px-4 py-3 border-b border-gray-200">
                        <h4 className="font-medium text-gray-700">Ofertas Enviadas</h4>
                      </div>
                      
                      {loadingOffers ? (
                        <div className="p-4 text-center">
                          <Loader2 className="w-6 h-6 text-blue-500 animate-spin mx-auto" />
                        </div>
                      ) : offers.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                          <Mail className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                          <p className="text-sm">No se han enviado ofertas aún</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-100">
                          {offers.map((offer) => (
                            <div key={offer.id} className="px-4 py-3 flex items-center justify-between">
                              <div>
                                <p className="font-medium text-gray-800">{offer.worker_name}</p>
                                <p className="text-sm text-gray-500">{offer.worker_phone}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getOfferStatusBadge(offer.status)}`}>
                                  {offer.status === 'sent' ? 'Enviado' :
                                   offer.status === 'accepted' ? 'Aceptado' :
                                   offer.status === 'rejected' ? 'Rechazado' :
                                   offer.status === 'expired' ? 'Expirado' : offer.status}
                                </span>
                                {offer.responded_at && (
                                  <span className="text-xs text-gray-400">
                                    {new Date(offer.responded_at).toLocaleString('es-ES')}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
