'use client';
/**
 * EventFlow — Configuración del Negocio
 * Datos del negocio, parámetros, webhooks (oculto por defecto)
 */
import { useState, useEffect } from 'react';
import AdminLayout from '@/components/b2b/AdminLayout';
import UsersManager from '@/components/b2b/UsersManager';
import { PageHeader, Spinner } from '@/components/ui';

interface Settings {
  business_name: string;
  address: string;
  cif: string;
  phone: string;
  email: string;
  logo_url: string;
  bar_price_per_hour: number;
  iva_pct: number;
  block_accept_on_stock_shortage: boolean;
  // Ratios de mesas/camareros (FR-A05) — antes hardcodeados en lib/operations.ts
  asientos_por_mesa: number;
  asientos_por_mesa_infantil: number;
  pax_por_camarero_coctel: number;
  pax_por_camarero_menu: number;
  refuerzo_cada: number;
  // Ficha técnica: precio mínimo de venta = coste unitario × este multiplicador
  min_price_multiplier: number;
}

const defaultSettings: Settings = {
  business_name: 'J.Benitez',
  address: '',
  cif: '',
  phone: '',
  email: '',
  logo_url: '',
  bar_price_per_hour: 15,
  iva_pct: 10,
  block_accept_on_stock_shortage: false,
  asientos_por_mesa: 10,
  asientos_por_mesa_infantil: 8,
  pax_por_camarero_coctel: 12,
  pax_por_camarero_menu: 10,
  refuerzo_cada: 25,
  min_price_multiplier: 3,
};

// Validation patterns
const CIF_REGEX = /^[A-Z]\d{8}$|^\d{8}[A-Z]$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[679]\d{8}$/;

/* ── Event Jobs Panel ── */
interface JobDef {
  id: string;
  label: string;
  description: string;
  endpoint: string;
  method: 'GET' | 'POST';
  icon: string;
}

const EVENT_JOBS: JobDef[] = [
  {
    id: 'payment-reminders',
    label: 'Recordatorios de cobro',
    description: 'Envia email a clientes con pagos pendientes vencidos o proximos a vencer.',
    endpoint: '/api/cron/payment-reminders',
    method: 'GET',
    icon: '1',
  },
  {
    id: 'pre-event-reminders',
    label: 'Recordatorios pre-evento',
    description: 'Envia recordatorios 3 dias y 1 dia antes del evento a los clientes.',
    endpoint: '/api/cron/pre-event-reminders',
    method: 'GET',
    icon: '2',
  },
  {
    id: 'post-event-followup',
    label: 'Seguimiento post-evento',
    description: 'Envia email de seguimiento 1-3 dias despues de finalizar un evento.',
    endpoint: '/api/cron/post-event-followup',
    method: 'GET',
    icon: '3',
  },
  {
    id: 'auto-orders',
    label: 'Pedidos automaticos a proveedores',
    description: 'Detecta ingredientes por debajo del stock minimo y genera pedidos agrupados por proveedor.',
    endpoint: '/api/stock/auto-orders',
    method: 'POST',
    icon: '4',
  },
];

function EventJobsPanel() {
  const [results, setResults] = useState<Record<string, { ok: boolean; msg: string; data?: any }>>({});
  const [running, setRunning] = useState<Record<string, boolean>>({});

  const runJob = async (job: JobDef) => {
    setRunning((p) => ({ ...p, [job.id]: true }));
    setResults((p) => ({ ...p, [job.id]: { ok: false, msg: 'Ejecutando...' } }));
    try {
      const res = await fetch(job.endpoint, { method: job.method });
      const data = await res.json();
      if (data.success) {
        // Build a summary message based on the job type
        let msg = '';
        if (job.id === 'payment-reminders') {
          msg = data.sent > 0
            ? `${data.sent} recordatorio(s) enviado(s). ${data.failed || 0} fallido(s).`
            : data.message || 'No hay pagos pendientes para recordar.';
        } else if (job.id === 'pre-event-reminders') {
          const total = (data.three_day || 0) + (data.one_day || 0);
          msg = total > 0
            ? `${data.sent} recordatorio(s) enviado(s) (${data.three_day} a 3d, ${data.one_day} a 1d).`
            : 'No hay eventos proximos para recordar.';
        } else if (job.id === 'post-event-followup') {
          msg = data.sent > 0
            ? `${data.sent} email(s) de seguimiento enviado(s).`
            : data.message || 'No hay eventos recientes para hacer seguimiento.';
        } else if (job.id === 'auto-orders') {
          msg = data.orders_created > 0
            ? `${data.orders_created} pedido(s) creado(s) con ${data.total_items} ingrediente(s) bajo minimo.`
            : data.message || 'No hay ingredientes por debajo del stock minimo.';
        }
        setResults((p) => ({ ...p, [job.id]: { ok: true, msg, data } }));
      } else {
        setResults((p) => ({ ...p, [job.id]: { ok: false, msg: data.error || 'Error desconocido' } }));
      }
    } catch (e) {
      setResults((p) => ({ ...p, [job.id]: { ok: false, msg: 'Error de conexión' } }));
    }
    setRunning((p) => ({ ...p, [job.id]: false }));
  };

  return (
    <div className="bg-white rounded-2xl border border-cream-dark p-6">
      <h2 className="text-base font-semibold text-ink mb-1">Configuración de Eventos</h2>
      <p className="text-xs text-ink-soft mb-5">Ejecución manual de tareas automáticas. Puedes lanzar cada job cuando lo necesites.</p>
      <div className="space-y-3">
        {EVENT_JOBS.map((job) => {
          const isRunning = running[job.id];
          const result = results[job.id];
          return (
            <div key={job.id} className="flex items-start gap-4 p-4 rounded-xl bg-cream border border-cream-dark">
              {/* Icon */}
              <div className="w-9 h-9 rounded-lg bg-gold/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-sm font-bold text-gold">{job.icon}</span>
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-medium text-ink">{job.label}</h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-cream-dark text-ink-soft font-mono">{job.method} {job.endpoint}</span>
                </div>
                <p className="text-xs text-ink-soft mt-0.5">{job.description}</p>
                {/* Result */}
                {result && (
                  <div className={`mt-2 text-xs px-3 py-1.5 rounded-lg ${result.ok ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                    {result.msg}
                  </div>
                )}
              </div>
              {/* Button */}
              <button
                onClick={() => runJob(job)}
                disabled={isRunning}
                className="flex-shrink-0 px-4 py-2 rounded-lg text-xs font-medium border border-gold text-gold hover:bg-gold hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-0.5"
              >
                {isRunning ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                    Ejecutando
                  </span>
                ) : 'Ejecutar'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function validateField(field: keyof Settings, value: string): string {
  switch (field) {
    case 'cif':
      if (!value) return 'El CIF/NIF es obligatorio';
      if (!CIF_REGEX.test(value.toUpperCase())) return 'Formato: letra + 8 digitos o 8 digitos + letra';
      return '';
    case 'email':
      if (!value) return 'El email es obligatorio';
      if (!EMAIL_REGEX.test(value)) return 'Formato de email no valido';
      return '';
    case 'phone':
      if (!value) return '';
      const digits = value.replace(/\s/g, '');
      if (!PHONE_REGEX.test(digits)) return 'Formato: 6XX, 7XX o 9XX seguido de 7 digitos';
      return '';
    default:
      return '';
  }
}

export default function ConfigPage() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data) setSettings(prev => ({ ...prev, ...d.data }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const validate = (current: Settings): boolean => {
    const errors: Record<string, string> = {};
    const cifErr = validateField('cif', current.cif);
    const emailErr = validateField('email', current.email);
    const phoneErr = validateField('phone', current.phone);
    if (cifErr) errors.cif = cifErr;
    if (emailErr) errors.email = emailErr;
    if (phoneErr) errors.phone = phoneErr;
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validate(settings)) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(data.error || 'Error al guardar');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const update = (field: keyof Settings, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    // Clear validation error for this field when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <Spinner label="Cargando configuración..." />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <PageHeader title="Configuración" subtitle="Datos del negocio y parámetros del sistema" />
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
          >
            {saving ? 'Guardando...' : saved ? 'Guardado ✓' : 'Guardar cambios'}
          </button>
        </div>

        {/* Success/Error */}
        {saved && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-green-700 text-sm">
            Configuración guardada correctamente.
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Datos del negocio */}
        <div className="bg-white rounded-2xl border border-cream-dark p-6">
          <h2 className="text-base font-semibold text-ink mb-4">Datos del Negocio</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Nombre del negocio</label>
              <input
                type="text"
                value={settings.business_name}
                onChange={(e) => update('business_name', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-cream-dark bg-cream text-sm focus:ring-2 focus:ring-gold focus:border-gold transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">CIF / NIF</label>
              <input
                type="text"
                value={settings.cif}
                onChange={(e) => update('cif', e.target.value)}
                placeholder="B12345678"
                className={`w-full px-3 py-2.5 rounded-lg border bg-cream text-sm focus:ring-2 transition-all ${
                  validationErrors.cif
                    ? 'border-danger focus:ring-danger/30 focus:border-danger'
                    : 'border-cream-dark focus:ring-gold focus:border-gold'
                }`}
              />
              {validationErrors.cif && (
                <p className="text-xs text-danger mt-1">{validationErrors.cif}</p>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-ink-soft mb-1">Dirección</label>
              <input
                type="text"
                value={settings.address}
                onChange={(e) => update('address', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-cream-dark bg-cream text-sm focus:ring-2 focus:ring-gold focus:border-gold transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Telefono</label>
              <input
                type="tel"
                value={settings.phone}
                onChange={(e) => update('phone', e.target.value)}
                placeholder="612 345 678"
                className={`w-full px-3 py-2.5 rounded-lg border bg-cream text-sm focus:ring-2 transition-all ${
                  validationErrors.phone
                    ? 'border-danger focus:ring-danger/30 focus:border-danger'
                    : 'border-cream-dark focus:ring-gold focus:border-gold'
                }`}
              />
              {validationErrors.phone && (
                <p className="text-xs text-danger mt-1">{validationErrors.phone}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Email</label>
              <input
                type="email"
                value={settings.email}
                onChange={(e) => update('email', e.target.value)}
                placeholder="info@negocio.es"
                className={`w-full px-3 py-2.5 rounded-lg border bg-cream text-sm focus:ring-2 transition-all ${
                  validationErrors.email
                    ? 'border-danger focus:ring-danger/30 focus:border-danger'
                    : 'border-cream-dark focus:ring-gold focus:border-gold'
                }`}
              />
              {validationErrors.email && (
                <p className="text-xs text-danger mt-1">{validationErrors.email}</p>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-ink-soft mb-1">URL del logo</label>
              <input
                type="url"
                value={settings.logo_url}
                onChange={(e) => update('logo_url', e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2.5 rounded-lg border border-cream-dark bg-cream text-sm focus:ring-2 focus:ring-gold focus:border-gold transition-all"
              />
            </div>
          </div>
        </div>

        {/* Parametros */}
        <div className="bg-white rounded-2xl border border-cream-dark p-6">
          <h2 className="text-base font-semibold text-ink mb-4">Parametros del Sistema</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Precio barra por hora (EUR)</label>
              <input
                type="number"
                step="0.50"
                value={settings.bar_price_per_hour}
                onChange={(e) => update('bar_price_per_hour', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2.5 rounded-lg border border-cream-dark bg-cream text-sm focus:ring-2 focus:ring-gold focus:border-gold transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">IVA (%)</label>
              <input
                type="number"
                step="0.5"
                value={settings.iva_pct}
                onChange={(e) => update('iva_pct', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2.5 rounded-lg border border-cream-dark bg-cream text-sm focus:ring-2 focus:ring-gold focus:border-gold transition-all"
              />
            </div>
            <div className="md:col-span-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.block_accept_on_stock_shortage}
                  onChange={(e) => update('block_accept_on_stock_shortage', e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-gold"
                />
                <span>
                  <span className="block text-sm font-medium text-ink">
                    Bloquear la aceptación de presupuestos si falta stock
                  </span>
                  <span className="block text-xs text-ink-soft mt-0.5">
                    Por defecto, si al aceptar un presupuesto no hay stock suficiente solo se avisa y se
                    genera un pedido borrador a proveedores. Con esto activo, la aceptación se rechaza (409)
                    hasta que se resuelva el faltante.
                  </span>
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Ratios de mesas y camareros (FR-A05) */}
        <div className="bg-white rounded-2xl border border-cream-dark p-6">
          <h2 className="text-base font-semibold text-ink mb-1">Ratios de mesas y camareros</h2>
          <p className="text-xs text-ink-soft mb-4">
            Fórmula: mesas = comensales ÷ asientos por mesa · cóctel = pax ÷ ratio cóctel ·
            menú sentado = (pax ÷ ratio base) + (pax ÷ refuerzo cada N adicionales)
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Asientos por mesa (adultos)</label>
              <input
                type="number" min={1} step={1}
                value={settings.asientos_por_mesa}
                onChange={(e) => update('asientos_por_mesa', parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2.5 rounded-lg border border-cream-dark bg-cream text-sm focus:ring-2 focus:ring-gold focus:border-gold transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Asientos por mesa infantil</label>
              <input
                type="number" min={1} step={1}
                value={settings.asientos_por_mesa_infantil}
                onChange={(e) => update('asientos_por_mesa_infantil', parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2.5 rounded-lg border border-cream-dark bg-cream text-sm focus:ring-2 focus:ring-gold focus:border-gold transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Comensales por camarero (cóctel)</label>
              <input
                type="number" min={1} step={1}
                value={settings.pax_por_camarero_coctel}
                onChange={(e) => update('pax_por_camarero_coctel', parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2.5 rounded-lg border border-cream-dark bg-cream text-sm focus:ring-2 focus:ring-gold focus:border-gold transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Comensales por camarero (menú sentado)</label>
              <input
                type="number" min={1} step={1}
                value={settings.pax_por_camarero_menu}
                onChange={(e) => update('pax_por_camarero_menu', parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2.5 rounded-lg border border-cream-dark bg-cream text-sm focus:ring-2 focus:ring-gold focus:border-gold transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Refuerzo cada N comensales (menú sentado)</label>
              <input
                type="number" min={1} step={1}
                value={settings.refuerzo_cada}
                onChange={(e) => update('refuerzo_cada', parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2.5 rounded-lg border border-cream-dark bg-cream text-sm focus:ring-2 focus:ring-gold focus:border-gold transition-all"
              />
            </div>
          </div>
        </div>

        {/* Ficha técnica de recetas */}
        <div className="bg-white rounded-2xl border border-cream-dark p-6">
          <h2 className="text-base font-semibold text-ink mb-1">Ficha técnica de recetas</h2>
          <p className="text-xs text-ink-soft mb-4">
            Precio mínimo de venta sugerido = coste unitario × este multiplicador (referencia: 3 ≈ 33% food cost).
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Multiplicador precio mínimo</label>
              <input
                type="number" min={1} step={0.1}
                value={settings.min_price_multiplier}
                onChange={(e) => update('min_price_multiplier', parseFloat(e.target.value) || 1)}
                className="w-full px-3 py-2.5 rounded-lg border border-cream-dark bg-cream text-sm focus:ring-2 focus:ring-gold focus:border-gold transition-all"
              />
            </div>
          </div>
        </div>

        {/* Configuración de Eventos — Jobs */}
        <EventJobsPanel />

        {/* Usuarios y perfiles (RBAC) — solo admin */}
        <UsersManager />

        {/* Save button bottom */}
        <div className="flex justify-end pb-8">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-8 py-3 rounded-xl text-sm font-medium text-white shadow-sm hover:shadow transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
          >
            {saving ? 'Guardando...' : saved ? 'Guardado ✓' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
