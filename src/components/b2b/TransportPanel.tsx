'use client';
/**
 * EventFlow — Transport Panel (WP-16)
 * Pestaña de Transporte para eventos externos
 * Calcula hora de salida = hora llegada - trayecto estimado - margen configurable
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Icon from '@/components/shared/Icon';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Transport {
  id: string;
  event_id: string;
  vehicle_type: string;
  vehicle_plate: string | null;
  vehicle_description: string | null;
  driver_id: string | null;
  driver_name: string | null;
  origin_address: string | null;
  destination_address: string | null;
  estimated_trip_minutes: number;
  margin_minutes: number;
  arrival_time: string | null;
  departure_time: string | null;
  status: string;
  notes: string | null;
}

interface Worker {
  id: string;
  name: string;
  phone: string | null;
  role: string;
}

interface TransportPanelProps {
  eventId: string;
  venueType: string | null;
  eventDate: string | null;
  clientName: string | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const VEHICLE_TYPES = [
  { value: 'furgoneta', label: 'Furgoneta' },
  { value: 'camion', label: 'Camión' },
  { value: 'coche', label: 'Coche' },
  { value: 'otro', label: 'Otro' },
];

const STATUS_MAP: Record<string, { label: string; variant: string }> = {
  pendiente: { label: 'Pendiente', variant: 'warning' },
  confirmado: { label: 'Confirmado', variant: 'info' },
  en_camino: { label: 'En camino', variant: 'info' },
  completado: { label: 'Completado', variant: 'success' },
  cancelado: { label: 'Cancelado', variant: 'danger' },
};

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('es-ES', { 
    day: '2-digit', 
    month: 'short', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function TransportPanel({ 
  eventId, 
  venueType, 
  eventDate,
  clientName 
}: TransportPanelProps) {
  const [transport, setTransport] = useState<Transport | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [firstTiming, setFirstTiming] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    vehicle_type: 'furgoneta',
    vehicle_plate: '',
    vehicle_description: '',
    driver_id: '',
    driver_name: '',
    origin_address: '',
    destination_address: '',
    estimated_trip_minutes: 60,
    margin_minutes: 30,
    arrival_time: '',
    notes: '',
  });

  // Fetch transport data
  const fetchTransport = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/event-transport?event_id=${eventId}`);
      const data = await res.json();
      if (data.success && data.data) {
        setTransport(data.data);
        setFirstTiming(data.firstTiming);
        // Populate form
        setForm({
          vehicle_type: data.data.vehicle_type || 'furgoneta',
          vehicle_plate: data.data.vehicle_plate || '',
          vehicle_description: data.data.vehicle_description || '',
          driver_id: data.data.driver_id || '',
          driver_name: data.data.driver_name || '',
          origin_address: data.data.origin_address || '',
          destination_address: data.data.destination_address || '',
          estimated_trip_minutes: data.data.estimated_trip_minutes || 60,
          margin_minutes: data.data.margin_minutes || 30,
          arrival_time: data.data.arrival_time ? 
            new Date(data.data.arrival_time).toISOString().slice(0, 16) : '',
          notes: data.data.notes || '',
        });
      } else if (data.firstTiming) {
        // No transport yet, but we have timing - set arrival time
        setFirstTiming(data.firstTiming);
        setForm(prev => ({
          ...prev,
          arrival_time: new Date(data.firstTiming).toISOString().slice(0, 16),
        }));
      }
    } catch (e) {
      console.error('Error fetching transport:', e);
    }
    setLoading(false);
  }, [eventId]);

  // Fetch workers for driver selection
  const fetchWorkers = useCallback(async () => {
    try {
      const res = await fetch('/api/workers');
      const data = await res.json();
      if (data.success) {
        setWorkers(data.data || []);
      }
    } catch (e) {
      console.error('Error fetching workers:', e);
    }
  }, []);

  useEffect(() => {
    fetchTransport();
    fetchWorkers();
  }, [fetchTransport, fetchWorkers]);

  // Auto-update arrival_time when first timing changes
  useEffect(() => {
    if (firstTiming && !form.arrival_time) {
      setForm(prev => ({
        ...prev,
        arrival_time: new Date(firstTiming).toISOString().slice(0, 16),
      }));
    }
  }, [firstTiming]);

  // Calculate departure time (client-side preview)
  const calculateDeparture = useCallback(() => {
    if (!form.arrival_time) return null;
    const arrival = new Date(form.arrival_time);
    const totalMinutes = form.estimated_trip_minutes + form.margin_minutes;
    const departure = new Date(arrival.getTime() - totalMinutes * 60 * 1000);
    return departure;
  }, [form.arrival_time, form.estimated_trip_minutes, form.margin_minutes]);

  // Save transport
  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        event_id: eventId,
        vehicle_type: form.vehicle_type,
        vehicle_plate: form.vehicle_plate || null,
        vehicle_description: form.vehicle_description || null,
        driver_id: form.driver_id || null,
        driver_name: form.driver_name || null,
        origin_address: form.origin_address || null,
        destination_address: form.destination_address || null,
        estimated_trip_minutes: form.estimated_trip_minutes,
        margin_minutes: form.margin_minutes,
        arrival_time: form.arrival_time ? new Date(form.arrival_time).toISOString() : null,
        notes: form.notes || null,
      };

      const res = await fetch('/api/event-transport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setTransport(data.data);
      }
    } catch (e) {
      console.error('Error saving transport:', e);
    }
    setSaving(false);
  };

  // Update status
  const updateStatus = async (newStatus: string) => {
    if (!transport) return;
    setSaving(true);
    try {
      const res = await fetch('/api/event-transport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          status: newStatus,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTransport(data.data);
      }
    } catch (e) {
      console.error('Error updating status:', e);
    }
    setSaving(false);
  };

  // If not external venue, don't show
  if (venueType !== 'externo') {
    return null;
  }

  const departure = calculateDeparture();
  const statusInfo = transport ? STATUS_MAP[transport.status] : null;

  return (
    <div className="mt-6 pt-4 border-t border-cream-dark">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon name="truck" className="w-5 h-5 text-gold" />
          <h3 className="text-sm font-semibold text-ink">Plan de Transporte</h3>
          {transport && statusInfo && (
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
              statusInfo.variant === 'success' ? 'bg-success/10 text-success' :
              statusInfo.variant === 'danger' ? 'bg-red-100 text-red-600' :
              statusInfo.variant === 'warning' ? 'bg-warning/10 text-warning' :
              'bg-ink/10 text-ink'
            }`}>
              {statusInfo.label}
            </span>
          )}
        </div>
        {transport && (
          <div className="flex items-center gap-2">
            {transport.status === 'pendiente' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => updateStatus('confirmado')}
                disabled={saving}
                className="text-xs"
              >
                <Icon name="check" className="w-3 h-3 mr-1" />
                Confirmar
              </Button>
            )}
            {transport.status === 'confirmado' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => updateStatus('en_camino')}
                disabled={saving}
                className="text-xs"
              >
                <Icon name="play" className="w-3 h-3 mr-1" />
                Salir
              </Button>
            )}
            {transport.status === 'en_camino' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => updateStatus('completado')}
                disabled={saving}
                className="text-xs"
              >
                <Icon name="checkCircle" className="w-3 h-3 mr-1" />
                Llegado
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Info banner */}
      <div className="mb-4 p-3 rounded-lg bg-gold/10 border border-gold/20">
        <p className="text-xs text-ink-soft-60">
          <Icon name="info" className="w-3 h-3 inline mr-1" />
          La hora de salida se calcula automáticamente: <strong>Hora llegada − Trayecto − Margen</strong>
        </p>
        {firstTiming && (
          <p className="text-xs text-ink-soft-60 mt-1">
            Primer hito del timing: <strong>{formatDateTime(firstTiming)}</strong>
          </p>
        )}
      </div>

      {/* Form */}
      <div className="space-y-4">
        {/* Vehicle section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-ink-soft-60 mb-1.5">
              Tipo de vehículo *
            </label>
            <Select 
              value={form.vehicle_type} 
              onValueChange={(v) => setForm({ ...form, vehicle_type: v })}
            >
              <SelectTrigger className="bg-white border-gold/30 text-ink h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border-gold/30 text-ink">
                {VEHICLE_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-soft-60 mb-1.5">
              Matrícula
            </label>
            <Input
              value={form.vehicle_plate}
              onChange={(e) => setForm({ ...form, vehicle_plate: e.target.value })}
              placeholder="1234 ABC"
              className="bg-white border-gold/30 text-ink h-9"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-soft-60 mb-1.5">
              Descripción
            </label>
            <Input
              value={form.vehicle_description}
              onChange={(e) => setForm({ ...form, vehicle_description: e.target.value })}
              placeholder="Furgoneta blanca, logo empresa..."
              className="bg-white border-gold/30 text-ink h-9"
            />
          </div>
        </div>

        {/* Driver section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-ink-soft-60 mb-1.5">
              Conductor
            </label>
            <Select 
              value={form.driver_id} 
              onValueChange={(v) => {
                const worker = workers.find(w => w.id === v);
                setForm({ 
                  ...form, 
                  driver_id: v,
                  driver_name: worker?.name || ''
                });
              }}
            >
              <SelectTrigger className="bg-white border-gold/30 text-ink h-9">
                <SelectValue placeholder="Seleccionar conductor..." />
              </SelectTrigger>
              <SelectContent className="bg-white border-gold/30 text-ink max-h-48">
                {workers.map(w => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name} {w.phone ? `(${w.phone})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-soft-60 mb-1.5">
              Nombre conductor (si no está en la lista)
            </label>
            <Input
              value={form.driver_name}
              onChange={(e) => setForm({ ...form, driver_name: e.target.value })}
              placeholder="Nombre completo"
              className="bg-white border-gold/30 text-ink h-9"
            />
          </div>
        </div>

        {/* Route section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-ink-soft-60 mb-1.5">
              Dirección origen
            </label>
            <Input
              value={form.origin_address}
              onChange={(e) => setForm({ ...form, origin_address: e.target.value })}
              placeholder="Calle, número, ciudad"
              className="bg-white border-gold/30 text-ink h-9"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-soft-60 mb-1.5">
              Dirección destino (venue)
            </label>
            <Input
              value={form.destination_address}
              onChange={(e) => setForm({ ...form, destination_address: e.target.value })}
              placeholder="Dirección del evento"
              className="bg-white border-gold/30 text-ink h-9"
            />
          </div>
        </div>

        {/* Time calculation section */}
        <div className="p-4 rounded-lg bg-cream border border-gold/20">
          <h4 className="text-xs font-semibold text-ink mb-3 uppercase tracking-wider">
            Cálculo de horarios
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-ink-soft-60 mb-1.5">
                Hora llegada (venue) *
              </label>
              <Input
                type="datetime-local"
                value={form.arrival_time}
                onChange={(e) => setForm({ ...form, arrival_time: e.target.value })}
                className="bg-white border-gold/30 text-ink h-9"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-soft-60 mb-1.5">
                Tiempo trayecto (min) *
              </label>
              <Input
                type="number"
                min="0"
                value={form.estimated_trip_minutes}
                onChange={(e) => setForm({ ...form, estimated_trip_minutes: parseInt(e.target.value) || 0 })}
                className="bg-white border-gold/30 text-ink h-9"
              />
              <p className="text-[11px] text-ink-soft-60 mt-1">
                {formatMinutes(form.estimated_trip_minutes)}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-soft-60 mb-1.5">
                Margen seguridad (min) *
              </label>
              <Input
                type="number"
                min="0"
                value={form.margin_minutes}
                onChange={(e) => setForm({ ...form, margin_minutes: parseInt(e.target.value) || 0 })}
                className="bg-white border-gold/30 text-ink h-9"
              />
              <p className="text-[11px] text-ink-soft-60 mt-1">
                {formatMinutes(form.margin_minutes)}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-soft-60 mb-1.5">
                Hora salida calculada
              </label>
              <div className="h-9 px-3 flex items-center bg-gold/10 border border-gold/30 rounded-md">
                <span className="text-sm font-semibold text-ink">
                  {departure ? formatTime(departure.toISOString()) : '—'}
                </span>
              </div>
              <p className="text-[11px] text-ink-soft-60 mt-1">
                {departure ? formatDateTime(departure.toISOString()) : 'Establece hora llegada'}
              </p>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-ink-soft-60 mb-1.5">
            Notas
          </label>
          <Input
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Instrucciones especiales, contactos..."
            className="bg-white border-gold/30 text-ink h-9"
          />
        </div>

        {/* Save button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            variant="ghost"
            onClick={fetchTransport}
            disabled={saving}
            className="text-xs"
          >
            <Icon name="refresh" className="w-3 h-3 mr-1" />
            Recargar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !form.arrival_time}
            className="bg-gold text-ink hover:bg-gold-dark text-xs"
          >
            {saving ? (
              <>
                <Icon name="loader" className="w-3 h-3 mr-1 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Icon name="save" className="w-3 h-3 mr-1" />
                Guardar plan de transporte
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
