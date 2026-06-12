'use client';
/**
 * EventFlow — Configuración del Negocio
 * Datos del negocio, parámetros, webhooks (oculto por defecto)
 */
import { useState, useEffect } from 'react';
import AdminLayout from '@/components/b2b/AdminLayout';

interface Settings {
  business_name: string;
  address: string;
  cif: string;
  phone: string;
  email: string;
  logo_url: string;
  bar_price_per_hour: number;
  iva_pct: number;
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
};

// Validation patterns
const CIF_REGEX = /^[A-Z]\d{8}$|^\d{8}[A-Z]$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[679]\d{8}$/;

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
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif text-[#1A1A1A]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Configuración
            </h1>
            <p className="text-[13px] text-[#6B7280] mt-1">Datos del negocio y parámetros del sistema</p>
          </div>
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
        <div className="bg-white rounded-2xl border border-[#ECECF1] p-6">
          <h2 className="text-base font-semibold text-[#1A1A1A] mb-4">Datos del Negocio</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Nombre del negocio</label>
              <input
                type="text"
                value={settings.business_name}
                onChange={(e) => update('business_name', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-[#E5E7EB] bg-[#FAF8F5] text-sm focus:ring-2 focus:ring-[#C9A84C] focus:border-[#C9A84C] transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">CIF / NIF</label>
              <input
                type="text"
                value={settings.cif}
                onChange={(e) => update('cif', e.target.value)}
                placeholder="B12345678"
                className={`w-full px-3 py-2.5 rounded-lg border bg-[#FAF8F5] text-sm focus:ring-2 transition-all ${
                  validationErrors.cif
                    ? 'border-red-400 focus:ring-red-300 focus:border-red-400'
                    : 'border-[#E5E7EB] focus:ring-[#C9A84C] focus:border-[#C9A84C]'
                }`}
              />
              {validationErrors.cif && (
                <p className="text-xs text-red-500 mt-1">{validationErrors.cif}</p>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Dirección</label>
              <input
                type="text"
                value={settings.address}
                onChange={(e) => update('address', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-[#E5E7EB] bg-[#FAF8F5] text-sm focus:ring-2 focus:ring-[#C9A84C] focus:border-[#C9A84C] transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Telefono</label>
              <input
                type="tel"
                value={settings.phone}
                onChange={(e) => update('phone', e.target.value)}
                placeholder="612 345 678"
                className={`w-full px-3 py-2.5 rounded-lg border bg-[#FAF8F5] text-sm focus:ring-2 transition-all ${
                  validationErrors.phone
                    ? 'border-red-400 focus:ring-red-300 focus:border-red-400'
                    : 'border-[#E5E7EB] focus:ring-[#C9A84C] focus:border-[#C9A84C]'
                }`}
              />
              {validationErrors.phone && (
                <p className="text-xs text-red-500 mt-1">{validationErrors.phone}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Email</label>
              <input
                type="email"
                value={settings.email}
                onChange={(e) => update('email', e.target.value)}
                placeholder="info@negocio.es"
                className={`w-full px-3 py-2.5 rounded-lg border bg-[#FAF8F5] text-sm focus:ring-2 transition-all ${
                  validationErrors.email
                    ? 'border-red-400 focus:ring-red-300 focus:border-red-400'
                    : 'border-[#E5E7EB] focus:ring-[#C9A84C] focus:border-[#C9A84C]'
                }`}
              />
              {validationErrors.email && (
                <p className="text-xs text-red-500 mt-1">{validationErrors.email}</p>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-[#6B7280] mb-1">URL del logo</label>
              <input
                type="url"
                value={settings.logo_url}
                onChange={(e) => update('logo_url', e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2.5 rounded-lg border border-[#E5E7EB] bg-[#FAF8F5] text-sm focus:ring-2 focus:ring-[#C9A84C] focus:border-[#C9A84C] transition-all"
              />
            </div>
          </div>
        </div>

        {/* Parametros */}
        <div className="bg-white rounded-2xl border border-[#ECECF1] p-6">
          <h2 className="text-base font-semibold text-[#1A1A1A] mb-4">Parametros del Sistema</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Precio barra por hora (EUR)</label>
              <input
                type="number"
                step="0.50"
                value={settings.bar_price_per_hour}
                onChange={(e) => update('bar_price_per_hour', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2.5 rounded-lg border border-[#E5E7EB] bg-[#FAF8F5] text-sm focus:ring-2 focus:ring-[#C9A84C] focus:border-[#C9A84C] transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">IVA (%)</label>
              <input
                type="number"
                step="0.5"
                value={settings.iva_pct}
                onChange={(e) => update('iva_pct', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2.5 rounded-lg border border-[#E5E7EB] bg-[#FAF8F5] text-sm focus:ring-2 focus:ring-[#C9A84C] focus:border-[#C9A84C] transition-all"
              />
            </div>
          </div>
        </div>

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
