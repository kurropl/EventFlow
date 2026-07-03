'use client';
/**
 * EventFlow — Proveedores (Providers CRM)
 * Catálogo de proveedores externos para eventos: catering, decoración, fotografía, etc.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { CATEGORY_LABELS } from '@/types/specs';
import { Spinner } from '@/components/ui';

interface ProviderRow {
  id: string;
  name: string;
  category: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

const money = (n: number | string) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n) || 0);

function fmtDate(d: string | null) {
  if (!d) return '—';
  const iso = d.slice(0, 10);
  const [y, m, day] = iso.split('-');
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return y && m && day ? `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}` : iso;
}

const initials = (n: string) =>
  n.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

const CATEGORY_COLORS: Record<string, string> = {
  catering: 'bg-amber-100 text-amber-800',
  decoracion: 'bg-purple-100 text-purple-800',
  flores: 'bg-pink-100 text-pink-800',
  fotografia: 'bg-blue-100 text-blue-800',
  video: 'bg-cyan-100 text-cyan-800',
  musica: 'bg-indigo-100 text-indigo-800',
  animacion: 'bg-orange-100 text-orange-800',
  transporte: 'bg-yellow-100 text-yellow-800',
  vestido: 'bg-rose-100 text-rose-800',
  reposteria: 'bg-green-100 text-green-800',
  extras: 'bg-gray-100 text-gray-800',
  otro: 'bg-slate-100 text-slate-800',
};

export default function ProvidersManager() {
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selected, setSelected] = useState<ProviderRow | null>(null);
  const [showNew, setShowNew] = useState(false);
  // F4.2: cuentas a pagar (FR-A10) — pestaña nueva junto al directorio.
  const [activeTab, setActiveTab] = useState<'directorio' | 'cuentas'>('directorio');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter) params.set('category', categoryFilter);
      const res = await fetch(`/api/providers?${params.toString()}`).then((r) => r.json());
      if (res.success) setProviders(res.data);
    } catch {
      /* keep empty */
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return providers;
    return providers.filter(
      (p) =>
        [p.name, p.contact_name, p.email, p.phone].some((v) => (v || '').toLowerCase().includes(q))
    );
  }, [providers, search]);

  const categories = useMemo(() => {
    const set = new Set(providers.map((p) => p.category));
    return Array.from(set).sort();
  }, [providers]);

  const activeCount = providers.filter((p) => p.active).length;
  const totalCount = providers.length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-heading text-ink">
            Proveedores
          </h2>
          <p className="text-ink-soft text-sm">
            {totalCount} proveedores · {activeCount} activos
          </p>
        </div>
        {activeTab === 'directorio' && (
          <button
            onClick={() => setShowNew(true)}
            className="text-sm font-medium text-white px-4 py-2.5 rounded-xl shadow-sm hover:shadow transition-all self-start"
            style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
          >
            + Nuevo proveedor
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg bg-cream-dark border border-gold/20 w-fit">
        {[
          { id: 'directorio' as const, label: 'Directorio' },
          { id: 'cuentas' as const, label: 'Cuentas a pagar' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === t.id ? 'bg-gold text-black shadow-sm' : 'text-ink-soft hover:text-ink hover:bg-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'cuentas' ? (
        <ProviderInvoicesTab providers={providers} />
      ) : (
      <>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, contacto, email…"
            className="w-full text-sm bg-white border border-cream-dark rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:border-gold transition-colors"
          />
          <svg
            className="w-4 h-4 text-ink-soft-60 absolute left-3 top-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4-4" />
          </svg>
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="text-sm bg-white border border-cream-dark rounded-xl px-3 py-2.5 focus:outline-none focus:border-gold transition-colors"
        >
          <option value="">Todas las categorías</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_LABELS[cat] || cat}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-cream-dark shadow-[0_1px_2px_rgba(16,24,40,0.04)] overflow-hidden">
        <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-3 border-b border-cream-dark text-[11px] font-semibold uppercase tracking-wide text-ink-soft-60">
          <div className="col-span-3">Proveedor</div>
          <div className="col-span-2">Categoría</div>
          <div className="col-span-2">Contacto</div>
          <div className="col-span-3">Email / Teléfono</div>
          <div className="col-span-1 text-center">Estado</div>
          <div className="col-span-1 text-right">Creado</div>
        </div>
        <div className="divide-y divide-cream-dark">
          {loading && (
            <Spinner label="Cargando…" />
          )}
          {!loading && filtered.length === 0 && (
            <div className="px-5 py-12 text-center text-sm text-ink-soft-60">
              No hay proveedores que coincidan.
            </div>
          )}
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              className="w-full text-left grid grid-cols-2 md:grid-cols-12 gap-3 px-5 py-3.5 items-center hover:bg-cream transition-colors"
            >
              <div className="col-span-2 md:col-span-3 flex items-center gap-3 min-w-0">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-semibold text-white flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
                >
                  {initials(p.name)}
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-ink truncate">{p.name}</div>
                </div>
              </div>
              <div className="hidden md:block col-span-2">
                <span
                  className={`inline-block text-[11px] font-medium px-2.5 py-1 rounded-full ${CATEGORY_COLORS[p.category] || 'bg-gray-100 text-gray-800'}`}
                >
                  {CATEGORY_LABELS[p.category] || p.category}
                </span>
              </div>
              <div className="hidden md:block col-span-2 text-[12px] text-ink-soft min-w-0">
                <div className="truncate">{p.contact_name || '—'}</div>
              </div>
              <div className="hidden md:block col-span-3 text-[12px] text-ink-soft min-w-0">
                <div className="truncate">{p.email || '—'}</div>
                <div className="truncate">{p.phone || ''}</div>
              </div>
              <div className="hidden md:block col-span-1 text-center">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${p.active ? 'bg-success' : 'bg-danger/60'}`}
                  title={p.active ? 'Activo' : 'Inactivo'}
                />
              </div>
              <div className="hidden md:block col-span-1 text-right text-[12px] text-ink-soft-60">
                {fmtDate(p.created_at)}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail drawer */}
      {selected && (
        <ProviderDrawer
          provider={selected}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            load();
          }}
        />
      )}

      {/* New provider modal */}
      {showNew && (
        <ProviderForm
          onClose={() => setShowNew(false)}
          onSaved={() => {
            setShowNew(false);
            load();
          }}
        />
      )}
      </>
      )}
    </div>
  );
}

// ── Cuentas a pagar (F4.2, FR-A10) ────────────────────────────

interface ProviderInvoiceRow {
  id: string;
  provider_id: string | null;
  provider_name: string | null;
  concept: string | null;
  amount: number | string;
  issue_date: string | null;
  due_date: string | null;
  status: 'pendiente' | 'pagado' | 'vencido';
  proof_url: string | null;
  paid_at: string | null;
  notes: string | null;
}

function ProviderInvoicesTab({ providers }: { providers: ProviderRow[] }) {
  const [invoices, setInvoices] = useState<ProviderInvoiceRow[]>([]);
  const [resumen, setResumen] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ provider_id: '', concept: '', amount: '', due_date: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/provider-invoices').then((r) => r.json());
      if (res.success) { setInvoices(res.data); setResumen(res.resumen); }
    } catch { /* keep empty */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.amount) return;
    setSaving(true);
    try {
      await fetch('/api/provider-invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_id: form.provider_id || null,
          concept: form.concept || null,
          amount: Number(form.amount),
          due_date: form.due_date || null,
        }),
      });
      setForm({ provider_id: '', concept: '', amount: '', due_date: '' });
      setShowNew(false);
      load();
    } catch { /* ignore */ }
    setSaving(false);
  };

  const markPaid = async (id: string) => {
    await fetch(`/api/provider-invoices/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pagado' }),
    });
    load();
  };

  const uploadProof = async (id: string, file: File) => {
    // Sin storage de archivos configurado: se usa un data-URL (igual que la
    // firma de contrato/nómina) para no depender de infraestructura extra.
    const reader = new FileReader();
    reader.onload = async () => {
      await fetch(`/api/provider-invoices/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proof_url: String(reader.result) }),
      });
      load();
    };
    reader.readAsDataURL(file);
  };

  if (loading) return <div className="p-8 text-center"><Spinner /></div>;

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-3 bg-white rounded-xl px-5 py-4 border border-cream-dark min-w-[160px]">
          <div>
            <span className="block text-[20px] font-bold text-ink tabular-nums">{money(resumen?.debe_total || 0)}</span>
            <span className="block text-[11px] text-ink-soft-60 uppercase tracking-wider font-medium">Debe total</span>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white rounded-xl px-5 py-4 border border-danger/30 min-w-[160px]">
          <div>
            <span className="block text-[20px] font-bold text-danger tabular-nums">{money(resumen?.vencido_total || 0)}</span>
            <span className="block text-[11px] text-ink-soft-60 uppercase tracking-wider font-medium">Vencido ({resumen?.vencidas || 0})</span>
          </div>
        </div>
        <button
          onClick={() => setShowNew((v) => !v)}
          className="ml-auto text-sm font-medium text-white px-4 py-2.5 rounded-xl shadow-sm hover:shadow transition-all self-start"
          style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
        >
          {showNew ? 'Cancelar' : '+ Nueva factura'}
        </button>
      </div>

      {/* Alta de factura */}
      {showNew && (
        <div className="bg-white rounded-xl border border-cream-dark p-4 flex flex-wrap gap-2">
          <select
            value={form.provider_id}
            onChange={(e) => setForm((f) => ({ ...f, provider_id: e.target.value }))}
            className="text-sm border border-cream-dark rounded-lg px-3 py-2 bg-white"
          >
            <option value="">Proveedor…</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <input
            value={form.concept}
            onChange={(e) => setForm((f) => ({ ...f, concept: e.target.value }))}
            placeholder="Concepto"
            className="flex-1 min-w-[160px] text-sm border border-cream-dark rounded-lg px-3 py-2"
          />
          <input
            type="number" min={0} step={0.01}
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            placeholder="Importe €"
            className="w-28 text-sm border border-cream-dark rounded-lg px-3 py-2"
          />
          <input
            type="date"
            value={form.due_date}
            onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
            className="text-sm border border-cream-dark rounded-lg px-3 py-2"
          />
          <button
            onClick={create}
            disabled={saving || !form.amount}
            className="px-4 py-2 rounded-lg bg-ink text-white text-sm font-medium hover:bg-ink-light disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Añadir'}
          </button>
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-cream-dark overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cream-dark bg-cream text-[11px] uppercase tracking-wider text-ink-soft-60">
                <th className="text-left px-4 py-3 font-medium">Proveedor</th>
                <th className="text-left px-4 py-3 font-medium">Concepto</th>
                <th className="text-right px-4 py-3 font-medium">Importe</th>
                <th className="text-left px-4 py-3 font-medium">Vencimiento</th>
                <th className="text-center px-4 py-3 font-medium">Estado</th>
                <th className="text-center px-4 py-3 font-medium">Justificante</th>
                <th className="text-center px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-ink-soft-60 text-sm">Sin facturas registradas</td></tr>
              ) : invoices.map((inv) => (
                <tr key={inv.id} className={`border-b border-cream-dark last:border-0 ${inv.status === 'vencido' ? 'bg-danger/5' : ''}`}>
                  <td className="px-4 py-2.5 text-ink">{inv.provider_name || '—'}</td>
                  <td className="px-4 py-2.5 text-ink-soft-60">{inv.concept || '—'}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-ink">{money(inv.amount)}</td>
                  <td className={`px-4 py-2.5 ${inv.status === 'vencido' ? 'text-danger font-medium' : 'text-ink-soft-60'}`}>
                    {fmtDate(inv.due_date)}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      inv.status === 'pagado' ? 'bg-success/10 text-success'
                        : inv.status === 'vencido' ? 'bg-danger/10 text-danger'
                        : 'bg-warning/10 text-warning'
                    }`}>
                      {inv.status === 'pagado' ? 'Pagado' : inv.status === 'vencido' ? 'Vencido' : 'Pendiente'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {inv.proof_url ? (
                      <a href={inv.proof_url} target="_blank" rel="noreferrer" className="text-xs text-gold hover:underline">Ver</a>
                    ) : (
                      <label className="text-xs text-ink-soft-60 hover:text-ink cursor-pointer underline">
                        Subir
                        <input type="file" accept="image/*,.pdf" className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadProof(inv.id, f); }} />
                      </label>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {inv.status !== 'pagado' && (
                      <button onClick={() => markPaid(inv.id)} className="text-xs text-success hover:underline font-medium">
                        Marcar pagado
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Detail drawer ─────────────────────────────────────────────

function ProviderDrawer({
  provider,
  onClose,
  onSaved,
}: {
  provider: ProviderRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(provider.name);
  const [category, setCategory] = useState(provider.category);
  const [contactName, setContactName] = useState(provider.contact_name || '');
  const [phone, setPhone] = useState(provider.phone || '');
  const [email, setEmail] = useState(provider.email || '');
  const [notes, setNotes] = useState(provider.notes || '');
  const [active, setActive] = useState(provider.active);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/providers/${provider.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          category,
          contact_name: contactName || null,
          phone: phone || null,
          email: email || null,
          notes: notes || null,
          active,
        }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm('¿Eliminar este proveedor? Esta acción no se puede deshacer.')) return;
    setDeleting(true);
    try {
      await fetch(`/api/providers/${provider.id}`, { method: 'DELETE' });
      onSaved();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <motion.div
        initial={{ x: 420 }}
        animate={{ x: 0 }}
        className="relative w-full max-w-md bg-cream h-full overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-cream-dark px-5 py-4 flex items-center gap-3 z-10">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
          >
            {initials(provider.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-ink truncate">{provider.name}</div>
            <div className="text-[12px] text-ink-soft-60">
              {CATEGORY_LABELS[provider.category] || provider.category}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-ink-soft-60 hover:bg-cream">
            ✕
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Stat label="Estado" value={active ? 'Activo' : 'Inactivo'} />
            <Stat label="Creado" value={fmtDate(provider.created_at)} />
          </div>

          {/* Form fields */}
          <div className="space-y-3">
            <Field label="Nombre *">
              <input value={name} onChange={(e) => setName(e.target.value)} className="crm-inp" />
            </Field>
            <Field label="Categoría">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="crm-inp"
              >
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Persona de contacto">
              <input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="crm-inp"
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Teléfono">
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="crm-inp"
                />
              </Field>
              <Field label="Email">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="crm-inp"
                />
              </Field>
            </div>
            <Field label="Notas">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="crm-inp resize-none"
                placeholder="Dirección, observaciones, condiciones…"
              />
            </Field>
            <label className="flex items-center gap-3 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="sr-only"
                />
                <div
                  className={`w-10 h-6 rounded-full transition-colors ${active ? 'bg-success' : 'bg-cream-dark'}`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform mt-1 ml-1 ${
                      active ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </div>
              </div>
              <span className="text-sm text-ink-soft">Proveedor activo</span>
            </label>
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-2">
            <button
              onClick={save}
              disabled={saving || !name.trim()}
              className="w-full text-sm font-medium text-white px-4 py-3 rounded-xl shadow-sm disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
            >
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
            <button
              onClick={remove}
              disabled={deleting}
              className="w-full text-sm font-medium text-danger px-4 py-3 rounded-xl border border-danger/30 hover:bg-danger/10 transition-colors disabled:opacity-50"
            >
              {deleting ? 'Eliminando…' : 'Eliminar proveedor'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── New provider modal ────────────────────────────────────────

function ProviderForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    name: '',
    category: 'otro',
    contact_name: '',
    phone: '',
    email: '',
    notes: '',
    active: true,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const setCheck = (k: string) => (e: any) => setF({ ...f, [k]: e.target.checked });

  const save = async () => {
    if (!f.name.trim()) {
      setErr('El nombre es obligatorio');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      const res = await fetch('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f),
      });
      const data = await res.json();
      if (!data.success) {
        setErr(data.error || 'Error');
        return;
      }
      onSaved();
    } catch {
      setErr('Error de red');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-heading text-xl text-ink">
          Nuevo proveedor
        </h3>

        <Field label="Nombre *">
          <input value={f.name} onChange={set('name')} className="crm-inp" autoFocus />
        </Field>
        <Field label="Categoría">
          <select value={f.category} onChange={set('category')} className="crm-inp">
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Persona de contacto">
          <input value={f.contact_name} onChange={set('contact_name')} className="crm-inp" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Teléfono">
            <input value={f.phone} onChange={set('phone')} className="crm-inp" />
          </Field>
          <Field label="Email">
            <input value={f.email} onChange={set('email')} className="crm-inp" />
          </Field>
        </div>
        <Field label="Notas">
          <textarea
            value={f.notes}
            onChange={set('notes')}
            rows={3}
            className="crm-inp resize-none"
          />
        </Field>
        <label className="flex items-center gap-3 cursor-pointer">
          <div className="relative">
            <input
              type="checkbox"
              checked={f.active}
              onChange={setCheck('active')}
              className="sr-only"
            />
            <div
              className={`w-10 h-6 rounded-full transition-colors ${f.active ? 'bg-success' : 'bg-cream-dark'}`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform mt-1 ml-1 ${
                  f.active ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </div>
          </div>
          <span className="text-sm text-ink-soft">Proveedor activo</span>
        </label>

        {err && <p className="text-sm text-danger">{err}</p>}

        <div className="flex gap-2 justify-end pt-1">
          <button
            onClick={onClose}
            className="text-sm px-4 py-2.5 rounded-xl text-ink-soft hover:bg-cream"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="text-sm font-medium text-white px-4 py-2.5 rounded-xl shadow-sm disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
          >
            {saving ? 'Guardando…' : 'Crear proveedor'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-cream-dark rounded-xl px-4 py-3">
      <div className="text-[11px] text-ink-soft-60">{label}</div>
      <div className="text-lg font-semibold text-ink tabular-nums">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[12px] font-medium text-ink-soft mb-1">{label}</span>
      {children}
    </label>
  );
}
