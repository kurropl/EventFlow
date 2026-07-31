'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';

// ============================================================
// Portal Guests — Gestión de invitados (WP-26)
// ============================================================

interface Guest {
  id: string;
  name: string;
  group_name: string | null;
  rsvp: 'pendiente' | 'confirmado' | 'rechazado';
  menu_type: 'adulto' | 'nino' | 'bebe';
  dietary: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface GuestStats {
  total: number;
  confirmed: number;
  pending: number;
  declined: number;
}

interface DietaryStat {
  dietary: string;
  count: number;
}

interface ImportError {
  line: number;
  field: string;
  value: string;
  error: string;
}

interface ImportResult {
  success: boolean;
  total_rows: number;
  imported: number;
  errors: ImportError[];
  error_report: string;
}

export default function PortalGuestsPage() {
  const params = useParams();
  const token = params.token as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [guests, setGuests] = useState<Guest[]>([]);
  const [stats, setStats] = useState<GuestStats>({ total: 0, confirmed: 0, pending: 0, declined: 0 });
  const [dietaryStats, setDietaryStats] = useState<DietaryStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    group_name: '',
    rsvp: 'pendiente' as Guest['rsvp'],
    menu_type: 'adulto' as Guest['menu_type'],
    dietary: [] as string[],
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // CSV Import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Filter state
  const [filterRsvp, setFilterRsvp] = useState<string>('all');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // ============================================================
  // Data loading
  // ============================================================

  const loadGuests = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/portal/${token}/guests`);
      const data = await response.json();

      if (!data.success) {
        setError(data.error);
        return;
      }

      setGuests(data.data || []);
      setStats(data.stats || { total: 0, confirmed: 0, pending: 0, declined: 0 });
      setDietaryStats(data.dietary_summary || []);
    } catch (err) {
      setError('Error al cargar invitados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGuests();
  }, [token]);

  // ============================================================
  // Form handlers
  // ============================================================

  const resetForm = () => {
    setFormData({
      name: '',
      group_name: '',
      rsvp: 'pendiente',
      menu_type: 'adulto',
      dietary: [],
      notes: '',
    });
    setEditingGuest(null);
    setFormError(null);
  };

  const openCreateForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (guest: Guest) => {
    setFormData({
      name: guest.name,
      group_name: guest.group_name || '',
      rsvp: guest.rsvp,
      menu_type: guest.menu_type,
      dietary: guest.dietary || [],
      notes: guest.notes || '',
    });
    setEditingGuest(guest);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    try {
      const payload = {
        ...(editingGuest ? { id: editingGuest.id } : {}),
        name: formData.name.trim(),
        group_name: formData.group_name.trim() || null,
        rsvp: formData.rsvp,
        menu_type: formData.menu_type,
        dietary: formData.dietary,
        notes: formData.notes.trim() || null,
      };

      const url = `/api/portal/${token}/guests`;
      const method = editingGuest ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!data.success) {
        setFormError(data.error);
        return;
      }

      closeForm();
      await loadGuests();
    } catch (err) {
      setFormError('Error al guardar el invitado');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (guestId: string, guestName: string) => {
    if (!confirm(`¿Eliminar a "${guestName}"?`)) return;

    try {
      const response = await fetch(`/api/portal/${token}/guests?ids=${guestId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        alert(data.error);
        return;
      }

      await loadGuests();
    } catch (err) {
      alert('Error al eliminar el invitado');
    }
  };

  const handleDeleteSelected = async () => {
    const selected = guests.filter((g) => selectedIds.includes(g.id));
    if (selected.length === 0) return;
    if (!confirm(`¿Eliminar ${selected.length} invitados seleccionados?`)) return;

    try {
      const ids = selected.map((g) => g.id).join(',');
      const response = await fetch(`/api/portal/${token}/guests?ids=${ids}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        alert(data.error);
        return;
      }

      setSelectedIds([]);
      await loadGuests();
    } catch (err) {
      alert('Error al eliminar los invitados');
    }
  };

  // ============================================================
  // CSV Import handlers
  // ============================================================

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    try {
      const formDataObj = new FormData();
      formDataObj.append('file', file);

      const response = await fetch(`/api/portal/${token}/guests/import`, {
        method: 'POST',
        body: formDataObj,
      });

      const result: ImportResult = await response.json();
      setImportResult(result);

      if (result.imported > 0) {
        await loadGuests();
      }
    } catch (err) {
      setImportResult({
        success: false,
        total_rows: 0,
        imported: 0,
        errors: [{ line: 0, field: 'file', value: '', error: 'Error al procesar el archivo' }],
        error_report: 'Error al procesar el archivo CSV',
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // ============================================================
  // Selection
  // ============================================================

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredGuests.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredGuests.map((g) => g.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // ============================================================
  // Filtering
  // ============================================================

  const filteredGuests = guests.filter((guest) => {
    if (filterRsvp !== 'all' && guest.rsvp !== filterRsvp) return false;
    if (filterGroup !== 'all' && guest.group_name !== filterGroup) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !guest.name.toLowerCase().includes(query) &&
        !(guest.group_name || '').toLowerCase().includes(query)
      ) {
        return false;
      }
    }
    return true;
  });

  const uniqueGroups = [...new Set(guests.map((g) => g.group_name).filter(Boolean))] as string[];

  // ============================================================
  // Dietary helpers
  // ============================================================

  const dietaryLabels: Record<string, string> = {
    vegetariano: '🥗 Vegetariano',
    vegano: '🌱 Vegano',
    celiaco: '🌾 Sin gluten',
    sin_gluten: '🌾 Sin gluten',
    sin_lactosa: '🥛 Sin lactosa',
    alergico: '⚠️ Alérgico',
    kosher: '✡️ Kosher',
    halal: '☪️ Halal',
    diabetico: '🩺 Diabético',
  };

  const getDietaryLabel = (dietary: string) => {
    return dietaryLabels[dietary] || dietary.replace(/_/g, ' ');
  };

  const rsvpLabels: Record<string, { label: string; color: string }> = {
    pendiente: { label: '⏳ Pendiente', color: 'bg-amber-100 text-amber-700' },
    confirmado: { label: '✓ Confirmado', color: 'bg-green-100 text-green-700' },
    rechazado: { label: '✗ Rechazado', color: 'bg-red-100 text-red-700' },
  };

  const menuTypeLabels: Record<string, string> = {
    adulto: '🍽️ Adulto',
    nino: '👶 Niño',
    bebe: '🍼 Bebé',
  };

  // ============================================================
  // Render
  // ============================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-700">{error}</p>
        <button
          onClick={loadGuests}
          className="mt-4 text-sm text-red-600 underline hover:text-red-800"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-[#1A1A1A]">
            👥 Gestión de invitados
          </h2>
          <div className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv"
              onChange={handleFileImport}
              className="hidden"
            />
            <button
              onClick={() => setShowImportModal(true)}
              className="px-4 py-2 text-sm font-medium text-[#C9A84C] border border-[#C9A84C] rounded-lg hover:bg-[#C9A84C] hover:text-white transition-colors"
            >
              📥 Importar CSV
            </button>
            <button
              onClick={openCreateForm}
              className="px-4 py-2 text-sm font-medium text-white bg-[#C9A84C] rounded-lg hover:bg-[#B8973D] transition-colors"
            >
              + Agregar invitado
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-[#1A1A1A]">{stats.total}</div>
            <div className="text-sm text-[#6B7280]">Total</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{stats.confirmed}</div>
            <div className="text-sm text-[#6B7280]">Confirmados</div>
          </div>
          <div className="text-center p-3 bg-amber-50 rounded-lg">
            <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
            <div className="text-sm text-[#6B7280]">Pendientes</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{stats.declined}</div>
            <div className="text-sm text-[#6B7280]">Rechazados</div>
          </div>
        </div>
      </div>

      {/* Dietary Summary */}
      {dietaryStats.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-3">
            🥗 Dietas y alergias consolidadas
          </h3>
          <div className="flex flex-wrap gap-2">
            {dietaryStats.map((d) => (
              <span
                key={d.dietary}
                className="inline-flex items-center gap-1 px-3 py-1 bg-amber-50 text-amber-800 rounded-full text-sm"
              >
                {getDietaryLabel(d.dietary)}
                <span className="font-medium">×{d.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Buscar por nombre o grupo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
            />
          </div>

          {/* RSVP filter */}
          <select
            value={filterRsvp}
            onChange={(e) => setFilterRsvp(e.target.value)}
            className="px-4 py-2 border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
          >
            <option value="all">Todos los estados</option>
            <option value="pendiente">Pendientes</option>
            <option value="confirmado">Confirmados</option>
            <option value="rechazado">Rechazados</option>
          </select>

          {/* Group filter */}
          {uniqueGroups.length > 0 && (
            <select
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
              className="px-4 py-2 border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
            >
              <option value="all">Todos los grupos</option>
              {uniqueGroups.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          )}

          {/* Bulk actions */}
          {selectedIds.length > 0 && (
            <button
              onClick={handleDeleteSelected}
              className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
            >
              🗑️ Eliminar ({selectedIds.length})
            </button>
          )}
        </div>
      </div>

      {/* Guests Table */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
        {filteredGuests.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-[#6B7280] mb-4">
              {guests.length === 0
                ? 'No hay invitados aún. Agrega tu primer invitado o importa un CSV.'
                : 'No se encontraron invitados con los filtros seleccionados.'}
            </p>
            {guests.length === 0 && (
              <button
                onClick={openCreateForm}
                className="px-4 py-2 text-sm font-medium text-white bg-[#C9A84C] rounded-lg hover:bg-[#B8973D] transition-colors"
              >
                + Agregar primer invitado
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-[#E5E7EB]">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === filteredGuests.length && filteredGuests.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[#6B7280]">
                    Nombre
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[#6B7280]">
                    Grupo
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[#6B7280]">
                    RSVP
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[#6B7280]">
                    Menú
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[#6B7280]">
                    Dietas
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-[#6B7280]">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {filteredGuests.map((guest) => (
                  <tr
                    key={guest.id}
                    className={`hover:bg-gray-50 ${
                      selectedIds.includes(guest.id) ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(guest.id)}
                        onChange={() => toggleSelect(guest.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#1A1A1A]">{guest.name}</div>
                      {guest.notes && (
                        <div className="text-xs text-[#6B7280] mt-1 truncate max-w-[200px]">
                          📝 {guest.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#6B7280]">
                      {guest.group_name || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          rsvpLabels[guest.rsvp]?.color || ''
                        }`}
                      >
                        {rsvpLabels[guest.rsvp]?.label || guest.rsvp}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#6B7280]">
                      {menuTypeLabels[guest.menu_type] || guest.menu_type}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(guest.dietary || []).map((d) => (
                          <span
                            key={d}
                            className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded"
                          >
                            {getDietaryLabel(d)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEditForm(guest)}
                        className="text-[#C9A84C] hover:text-[#B8973D] mr-2"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(guest.id, guest.name)}
                        className="text-red-500 hover:text-red-600"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-[#E5E7EB]">
              <h3 className="text-lg font-semibold text-[#1A1A1A]">
                {editingGuest ? 'Editar invitado' : 'Nuevo invitado'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {formError}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-[#1A1A1A] mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                  placeholder="Nombre completo"
                />
              </div>

              {/* Group */}
              <div>
                <label className="block text-sm font-medium text-[#1A1A1A] mb-1">
                  Grupo
                </label>
                <input
                  type="text"
                  value={formData.group_name}
                  onChange={(e) => setFormData({ ...formData, group_name: e.target.value })}
                  className="w-full px-4 py-2 border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                  placeholder="Familia novia, amigos, etc."
                />
              </div>

              {/* RSVP */}
              <div>
                <label className="block text-sm font-medium text-[#1A1A1A] mb-1">
                  Estado RSVP
                </label>
                <select
                  value={formData.rsvp}
                  onChange={(e) =>
                    setFormData({ ...formData, rsvp: e.target.value as Guest['rsvp'] })
                  }
                  className="w-full px-4 py-2 border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                >
                  <option value="pendiente">⏳ Pendiente</option>
                  <option value="confirmado">✓ Confirmado</option>
                  <option value="rechazado">✗ Rechazado</option>
                </select>
              </div>

              {/* Menu Type */}
              <div>
                <label className="block text-sm font-medium text-[#1A1A1A] mb-1">
                  Tipo de menú
                </label>
                <select
                  value={formData.menu_type}
                  onChange={(e) =>
                    setFormData({ ...formData, menu_type: e.target.value as Guest['menu_type'] })
                  }
                  className="w-full px-4 py-2 border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                >
                  <option value="adulto">🍽️ Adulto</option>
                  <option value="nino">👶 Niño</option>
                  <option value="bebe">🍼 Bebé</option>
                </select>
              </div>

              {/* Dietary */}
              <div>
                <label className="block text-sm font-medium text-[#1A1A1A] mb-1">
                  Dietas / Alergias
                </label>
                <div className="flex flex-wrap gap-2">
                  {['vegetariano', 'vegano', 'celiaco', 'sin_lactosa', 'alergico', 'kosher', 'halal'].map(
                    (d) => (
                      <label
                        key={d}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm cursor-pointer transition-colors ${
                          formData.dietary.includes(d)
                            ? 'bg-[#C9A84C] text-white'
                            : 'bg-gray-100 text-[#6B7280] hover:bg-gray-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={formData.dietary.includes(d)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, dietary: [...formData.dietary, d] });
                            } else {
                              setFormData({
                                ...formData,
                                dietary: formData.dietary.filter((x) => x !== d),
                              });
                            }
                          }}
                          className="sr-only"
                        />
                        {getDietaryLabel(d)}
                      </label>
                    )
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-[#1A1A1A] mb-1">
                  Notas
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                  rows={3}
                  placeholder="Notas adicionales..."
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex-1 px-4 py-2 text-sm font-medium text-[#6B7280] border border-[#E5E7EB] rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#C9A84C] rounded-lg hover:bg-[#B8973D] transition-colors disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : editingGuest ? 'Guardar cambios' : 'Crear invitado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full">
            <div className="p-6 border-b border-[#E5E7EB]">
              <h3 className="text-lg font-semibold text-[#1A1A1A]">
                📥 Importar invitados desde CSV
              </h3>
            </div>

            <div className="p-6">
              {/* Instructions */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-[#1A1A1A] mb-2">Formato del CSV:</h4>
                <ul className="text-sm text-[#6B7280] space-y-1">
                  <li>• Columnas: nombre, grupo, RSVP, tipo menú, dietas, notas</li>
                  <li>• El archivo puede tener o no cabecera</li>
                  <li>• Máximo 50 filas por importación</li>
                  <li>• RSVP: p/Pendiente, c/Confirmado, r/Rechazado</li>
                  <li>• Dietas: separadas por coma (ej: vegetariano, celiaco)</li>
                </ul>
                <pre className="mt-3 text-xs text-[#6B7280] bg-white p-2 rounded border border-[#E5E7EB]">
{`nombre,grupo,rsvp,tipo_menu,dietas,notas
Juan García,Familia,c,adulto,,,
Ana López,Amigos,p,adulto,"vegetariano",Llega con taxi
Pedro Ruiz,Familia,,nino,,Niño de 8 años`}
                </pre>
              </div>

              {/* Import result */}
              {importResult && (
                <div
                  className={`mb-6 p-4 rounded-lg ${
                    importResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                  }`}
                >
                  {importResult.success ? (
                    <div>
                      <p className="font-medium text-green-800">
                        ✓ {importResult.imported} invitados importados correctamente
                      </p>
                      {importResult.errors.length > 0 && (
                        <p className="mt-2 text-sm text-amber-700">
                          ⚠️ {importResult.errors.length} filas con errores (omitidas)
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="font-medium text-red-800">
                        ✗ Error en la importación
                      </p>
                      {importResult.error_report && (
                        <pre className="mt-2 text-xs text-red-700 whitespace-pre-wrap max-h-40 overflow-y-auto">
                          {importResult.error_report}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* File input */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-[#6B7280] border border-[#E5E7EB] rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cerrar
                </button>
                <label
                  className={`flex-1 px-4 py-2 text-sm font-medium text-center text-white bg-[#C9A84C] rounded-lg hover:bg-[#B8973D] transition-colors cursor-pointer ${
                    importing ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
                  {importing ? 'Importando...' : 'Seleccionar archivo CSV'}
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileImport}
                    className="hidden"
                    disabled={importing}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
