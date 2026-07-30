'use client';

/**
 * EventFlow — Timeline de Evento
 * Muestra eventos de dominio e interacciones CRM en orden cronológico inverso.
 */

import { useState, useEffect } from 'react';
import { 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  RotateCcw,
  Calendar,
  MessageSquare,
  FileText,
  CreditCard,
  Package,
  Users,
  Settings,
  Bell
} from 'lucide-react';

interface TimelineEvent {
  id: number | string;
  type: 'domain_event' | 'interaction' | 'message';
  event_type?: string;
  payload?: Record<string, any>;
  created_at: string;
  processed_at?: string | null;
  status?: 'processed' | 'pending' | 'retrying' | 'failed';
  error?: string | null;
  // Para interacciones CRM
  interaction_type?: string;
  content?: string;
  // Para mensajes
  sender?: string;
  body?: string;
}

interface EventTimelineProps {
  eventId: string;
}

// Mapeo de tipos de eventos a iconos y colores
const eventTypeConfig: Record<string, { icon: any; color: string; label: string }> = {
  // Estados de evento
  'event.confirmed': { icon: CheckCircle, color: 'text-green-600', label: 'Evento confirmado' },
  'event.operationally_closed': { icon: Package, color: 'text-blue-600', label: 'Cierre operativo' },
  'event.financially_closed': { icon: CreditCard, color: 'text-purple-600', label: 'Cierre contable' },
  
  // Pagos
  'deposit.paid': { icon: CreditCard, color: 'text-green-600', label: 'Señal pagada' },
  'payment.milestone_due': { icon: Bell, color: 'text-orange-600', label: 'Hito de pago pendiente' },
  
  // Portal
  'portal.frozen': { icon: Settings, color: 'text-red-600', label: 'Portal congelado' },
  'portal.updated': { icon: MessageSquare, color: 'text-blue-500', label: 'Portal actualizado' },
  
  // Menús
  'menu.published': { icon: FileText, color: 'text-green-600', label: 'Menú publicado' },
  'menu.price_changed': { icon: FileText, color: 'text-yellow-600', label: 'Precio de menú cambiado' },
  
  // Stock
  'stock.below_minimum': { icon: Package, color: 'text-orange-600', label: 'Stock bajo mínimo' },
  'ingredient.price_changed': { icon: Package, color: 'text-yellow-600', label: 'Precio de ingrediente cambiado' },
  
  // Compras
  'purchase_order.received': { icon: Package, color: 'text-green-600', label: 'Compra recibida' },
  
  // Staffing
  'shift.offered': { icon: Users, color: 'text-blue-600', label: 'Turno ofrecido' },
  'shift.confirmed': { icon: Users, color: 'text-green-600', label: 'Turno confirmado' },
  
  // Interacciones CRM
  'llamada': { icon: Clock, color: 'text-blue-600', label: 'Llamada' },
  'email': { icon: MessageSquare, color: 'text-green-600', label: 'Email' },
  'whatsapp': { icon: MessageSquare, color: 'text-green-500', label: 'WhatsApp' },
  'nota': { icon: FileText, color: 'text-gray-600', label: 'Nota' },
  'reunion': { icon: Users, color: 'text-purple-600', label: 'Reunión' },
  
  // Mensajes del cliente
  'client_message': { icon: MessageSquare, color: 'text-blue-500', label: 'Mensaje del cliente' },
  'team_message': { icon: MessageSquare, color: 'text-green-600', label: 'Mensaje del equipo' },
};

// Configuración por defecto para eventos no mapeados
const defaultConfig = { icon: Clock, color: 'text-gray-600', label: 'Evento' };

function getEventConfig(eventType: string) {
  return eventTypeConfig[eventType] || defaultConfig;
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    processed: { bg: 'bg-green-100', text: 'text-green-800', label: 'Procesado' },
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pendiente' },
    retrying: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Reintentando' },
    failed: { bg: 'bg-red-100', text: 'text-red-800', label: 'Fallido' },
  }[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status };

  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

function TimelineItem({ event }: { event: TimelineEvent }) {
  const config = getEventConfig(event.event_type || event.interaction_type || '');
  const Icon = config.icon;

  return (
    <div className="flex gap-3 pb-6 last:pb-0">
      {/* Icono */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full bg-cream-dark flex items-center justify-center ${config.color}`}>
        <Icon className="w-4 h-4" />
      </div>

      {/* Contenido */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm text-ink">
            {config.label}
          </span>
          {event.status && <StatusBadge status={event.status} />}
        </div>

        {/* Payload para eventos de dominio */}
        {event.payload && Object.keys(event.payload).length > 0 && (
          <div className="text-xs text-ink-soft-600 mb-1">
            {Object.entries(event.payload).map(([key, value]) => (
              <span key={key} className="mr-3">
                <span className="font-medium">{key}:</span>{' '}
                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </span>
            ))}
          </div>
        )}

        {/* Contenido para interacciones */}
        {event.content && (
          <p className="text-sm text-ink-soft mb-1">{event.content}</p>
        )}

        {/* Contenido para mensajes */}
        {event.body && (
          <p className="text-sm text-ink-soft mb-1">{event.body}</p>
        )}

        {/* Error si existe */}
        {event.error && (
          <div className="mt-1 p-2 bg-red-50 rounded text-xs text-red-700">
            <AlertCircle className="w-3 h-3 inline mr-1" />
            {event.error}
          </div>
        )}

        {/* Timestamp */}
        <div className="flex items-center gap-2 text-xs text-ink-soft-600 mt-1">
          <Calendar className="w-3 h-3" />
          <span>{formatDate(event.created_at)}</span>
          <Clock className="w-3 h-3" />
          <span>{formatTime(event.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

export default function EventTimeline({ eventId }: EventTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTimeline() {
      try {
        setLoading(true);
        const res = await fetch(`/api/events/${eventId}/domain-events`);
        const data = await res.json();
        
        if (data.success) {
          setEvents(data.data || []);
        } else {
          setError(data.error || 'Error al cargar timeline');
        }
      } catch (err) {
        setError('Error de conexión');
      } finally {
        setLoading(false);
      }
    }

    if (eventId) {
      fetchTimeline();
    }
  }, [eventId]);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-cream-dark" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-cream-dark rounded" />
              <div className="h-3 w-full bg-cream-dark rounded" />
              <div className="h-3 w-24 bg-cream-dark rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="w-8 h-8 text-ink-soft-60 mx-auto mb-2" />
        <p className="text-sm text-ink-soft-60">No hay eventos en la timeline</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {events.map((event) => (
        <TimelineItem key={`${event.type}-${event.id}`} event={event} />
      ))}
    </div>
  );
}