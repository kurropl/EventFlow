'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import Icon from '../shared/Icon';
import { StatStrip, DataCard, DataList, PageHeader } from '@/components/ui';

interface CatalogItem {
  id: string;
  name: string;
  category: string;
  pvp: number;
  cost: number;
  image_url: string | null;
  active: boolean;
  estimated?: boolean;
  provider_name?: string;
  allergens?: string[];
  description?: string | null;
}

// Los 14 alérgenos de declaración obligatoria en la UE (Reglamento 1169/2011)
const ALLERGENS = [
  'gluten', 'crustáceos', 'huevos', 'pescado', 'cacahuetes', 'soja',
  'lácteos', 'frutos de cáscara', 'apio', 'mostaza', 'sésamo',
  'sulfitos', 'altramuces', 'moluscos',
] as const;

const CATEGORIES = [
  'aperitivo-frio', 'aperitivo-caliente', 'compartir-mesa',
  'carne', 'pescado', 'arroz', 'sorbete', 'postre', 'bebida', 'complemento',
];

const CATEGORY_LABELS: Record<string, string> = {
  'aperitivo-frio': 'Aperitivos fríos',
  'aperitivo-caliente': 'Aperitivos calientes',
  'compartir-mesa': 'A compartir en mesa',
  'carne': 'Carnes',
  'pescado': 'Pescados',
  'arroz': 'Arroces',
  'sorbete': 'Sorbetes',
  'postre': 'Postres',
  'bebida': 'Bebidas',
  'complemento': 'Complementos / Estaciones',
};

// Precios base por categoría (PVP y coste) — usados como estimación
// determinista cuando un artículo aún no tiene precio definido.
const PRICING: Record<string, { pvp: number; cost: number }> = {
  'aperitivo-frio': { pvp: 3.5, cost: 1.2 },
  'aperitivo-caliente': { pvp: 4.5, cost: 1.8 },
  'compartir-mesa': { pvp: 8.0, cost: 3.0 },
  'carne': { pvp: 12.0, cost: 4.5 },
  'pescado': { pvp: 11.0, cost: 4.0 },
  'arroz': { pvp: 10.0, cost: 3.8 },
  'sorbete': { pvp: 3.0, cost: 0.8 },
  'postre': { pvp: 4.0, cost: 1.2 },
  'bebida': { pvp: 2.5, cost: 0.9 },
  'complemento': { pvp: 15.0, cost: 6.0 },
};

const PREMIUM_KEYWORDS = ['foie', 'trufa', 'vieja', 'carabinero', 'anguila', 'erizo', 'caviar', 'ostra', 'vieira', 'solomillo', 'mariscada'];

// Hash determinista para una variación estable por nombre (±15%)
function nameVariance(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return 0.85 + (h % 31) / 100; // 0.85 – 1.15
}

function estimatePrices(name: string, category: string): { pvp: number; cost: number } {
  const base = PRICING[category] || { pvp: 5, cost: 2 };
  const multiplier = PREMIUM_KEYWORDS.some((k) => name.toLowerCase().includes(k)) ? 1.4 : 1.0;
  const v = nameVariance(name);
  const pvp = Math.max(1.5, Math.round(base.pvp * multiplier * v * 100) / 100);
  const cost = Math.max(0.5, Math.round(base.cost * multiplier * v * 0.8 * 100) / 100);
  return { pvp, cost };
}

function money(v: number) {
  return Number(v).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export default function CatalogCRUD() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ name: string; category: string; pvp: string; cost: string; active: boolean; allergens: string[]; description: string }>({ name: '', category: '', pvp: '', cost: '', active: true, allergens: [], description: '' });
  const [newItem, setNewItem] = useState({ name: '', category: CATEGORIES[0], pvp: '', cost: '' });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const PAGE_SIZE = 500;

  const loadCatalog = useCallback(async (pageNum = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ all: 'true', page: String(pageNum), limit: String(PAGE_SIZE) });
      const res = await fetch(`/api/catalog?${params}`);
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        const flat: CatalogItem[] = [];
        for (const [, list] of Object.entries(data.data as Record<string, any[]>)) {
          for (const it of list) {
            const hasPrice = Number(it.pvp) > 0;
            const est = hasPrice ? null : estimatePrices(it.name, it.category);
            flat.push({
              id: it.id,
              name: it.name,
              category: it.category,
              pvp: hasPrice ? Number(it.pvp) : est!.pvp,
              cost: Number(it.cost) > 0 ? Number(it.cost) : est!.cost,
              image_url: it.image_url ?? null,
              active: it.active,
              estimated: !hasPrice,
            });
          }
        }
        setItems(flat);
        if (data.pagination) setTotalPages(data.pagination.totalPages || 1);
      }
    } catch {
      /* keep whatever we have */
    } finally {
      setLoading(false);
    }
  }, [PAGE_SIZE]);

  useEffect(() => { loadCatalog(page); }, [loadCatalog, page]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchCategory = filterCategory === 'all' || item.category === filterCategory;
      const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [items, filterCategory, search]);

  const getMargin = (pvp: number, cost: number) => (pvp === 0 ? 0 : Math.round(((pvp - cost) / pvp) * 100));

  const handleAddItem = async () => {
    if (!newItem.name.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newItem.name.trim(),
          category: newItem.category,
          pvp: parseFloat(newItem.pvp) || 0,
          cost: parseFloat(newItem.cost) || 0,
          ingredientes_base: [],
          image_url: '',
          active: true,
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setNewItem({ name: '', category: CATEGORIES[0], pvp: '', cost: '' });
        await loadCatalog();
      }
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  };

  const handleEditItem = async () => {
    if (!editingId || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/catalog', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        // Bug real (Sprint 6): faltaba el id, así que ningún guardado de
        // edición llegaba a aplicarse nunca (400 "Missing id" silencioso).
        body: JSON.stringify({ ...editData, id: editingId }),
      });
      if (res.ok) {
        setEditingId(null);
        await loadCatalog();
      }
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('¿Desactivar este artículo?')) return;
    try {
      const res = await fetch(`/api/catalog?id=${id}`, { method: 'DELETE' });
      if (res.ok) await loadCatalog();
    } catch {
      /* ignore */
    }
  };

  const startEdit = (item: CatalogItem) => {
    setEditingId(item.id);
    setEditData({
      name: item.name, category: item.category, pvp: String(item.pvp), cost: String(item.cost), active: item.active,
      allergens: Array.isArray(item.allergens) ? item.allergens : [],
      description: item.description || '',
    });
  };
  const toggleAllergen = (a: string) => {
    setEditData((d) => ({
      ...d,
      allergens: d.allergens.includes(a) ? d.allergens.filter((x) => x !== a) : [...d.allergens, a],
    }));
  };
  const toggleActive = async (item: CatalogItem) => {
    try {
      const res = await fetch('/api/catalog', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, active: !item.active }),
      });
      if (res.ok) await loadCatalog();
    } catch { /* ignore */ }
  };


  const totalItems = items.length;
  const activeItems = items.filter((i) => i.active).length;
  const avgMargin = items.length ? items.reduce((s, i) => s + getMargin(i.pvp, i.cost), 0) / items.length : 0;
  const hasEstimated = items.some((i) => i.estimated);

  const activeCategories = useMemo(() =>
    CATEGORIES
      .map((cat) => ({
        label: CATEGORY_LABELS[cat] || cat,
        count: items.filter((i) => i.category === cat && i.active).length,
      }))
      .filter((c) => c.count > 0),
    [items],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Catálogo de artículos"
        subtitle="Gestión completa del catálogo"
        actions={
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm hover:shadow transition-all"
            style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
          >
            + Nuevo artículo
          </button>
        }
        stats={
          <StatStrip items={[
            { label: 'Total', value: totalItems, accent: true },
            { label: 'Margen medio', value: `${Number(avgMargin || 0).toFixed(0)}%` },
            { label: 'Activos', value: activeItems },
          ]} />
        }
      />

      {hasEstimated && (
        <p className="text-[12px] text-[#9CA3AF] -mt-3">
          Los precios marcados con <span className="text-[#A88A3A]">~</span> son estimaciones por categoría; edita el artículo para fijar su PVP real.
        </p>
      )}

      {/* Category stat strip */}
      <StatStrip
        items={activeCategories.map((c) => ({ label: c.label, value: String(c.count) }))}
      />

      {/* New Item Form */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-white rounded-2xl border border-[#ECECF1] p-4 space-y-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
        >
          <h3 className="text-[#1A1A1A] font-semibold text-sm">Nuevo artículo</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              type="text" placeholder="Nombre del plato" value={newItem.name}
              onChange={(e) => setNewItem((n) => ({ ...n, name: e.target.value }))}
              className="px-3 py-2 rounded-lg bg-[#FAFAFC] border border-[#E5E5EC] text-[#1A1A1A] text-sm placeholder:text-[#A8A8B0] focus:border-[#C9A84C] focus:outline-none"
            />
            <select value={newItem.category} onChange={(e) => setNewItem((n) => ({ ...n, category: e.target.value }))}
              className="px-3 py-2 rounded-lg bg-[#FAFAFC] border border-[#E5E5EC] text-[#1A1A1A] text-sm focus:border-[#C9A84C] focus:outline-none">
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
              ))}
            </select>
            <input type="number" placeholder="PVP (€)" step="0.01" value={newItem.pvp}
              onChange={(e) => setNewItem((n) => ({ ...n, pvp: e.target.value }))}
              className="px-3 py-2 rounded-lg bg-[#FAFAFC] border border-[#E5E5EC] text-[#1A1A1A] text-sm placeholder:text-[#A8A8B0] focus:border-[#C9A84C] focus:outline-none" />
            <input type="number" placeholder="Coste (€)" step="0.01" value={newItem.cost}
              onChange={(e) => setNewItem((n) => ({ ...n, cost: e.target.value }))}
              className="px-3 py-2 rounded-lg bg-[#FAFAFC] border border-[#E5E5EC] text-[#1A1A1A] text-sm placeholder:text-[#A8A8B0] focus:border-[#C9A84C] focus:outline-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddItem} disabled={saving} className="text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60" style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-[#6B7280] text-sm px-3 hover:text-[#1A1A1A]">
              Cancelar
            </button>
          </div>
        </motion.div>
      )}

      {/* Edit Item Form */}
      {editingId && (
        <div className="bg-white rounded-2xl border-2 border-[#C9A84C] p-4 space-y-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <h3 className="text-[#1A1A1A] font-semibold text-sm">Editar artículo</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input type="text" placeholder="Nombre del plato" value={editData.name}
              onChange={(e) => setEditData((d) => ({ ...d, name: e.target.value }))}
              className="px-3 py-2 rounded-lg bg-[#FAFAFC] border border-[#E5E5EC] text-[#1A1A1A] text-sm placeholder:text-[#A8A8B0] focus:border-[#C9A84C] focus:outline-none" />
            <select value={editData.category} onChange={(e) => setEditData((d) => ({ ...d, category: e.target.value }))}
              className="px-3 py-2 rounded-lg bg-[#FAFAFC] border border-[#E5E5EC] text-[#1A1A1A] text-sm focus:border-[#C9A84C] focus:outline-none">
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
              ))}
            </select>
            <input type="number" placeholder="PVP (€)" step="0.01" value={editData.pvp}
              onChange={(e) => setEditData((d) => ({ ...d, pvp: e.target.value }))}
              className="px-3 py-2 rounded-lg bg-[#FAFAFC] border border-[#E5E5EC] text-[#1A1A1A] text-sm placeholder:text-[#A8A8B0] focus:border-[#C9A84C] focus:outline-none" />
            <input type="number" placeholder="Coste (€)" step="0.01" value={editData.cost}
              onChange={(e) => setEditData((d) => ({ ...d, cost: e.target.value }))}
              className="px-3 py-2 rounded-lg bg-[#FAFAFC] border border-[#E5E5EC] text-[#1A1A1A] text-sm placeholder:text-[#A8A8B0] focus:border-[#C9A84C] focus:outline-none" />
          </div>
          <div>
            <textarea placeholder="Descripción del plato (opcional)" value={editData.description} rows={2}
              onChange={(e) => setEditData((d) => ({ ...d, description: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg bg-[#FAFAFC] border border-[#E5E5EC] text-[#1A1A1A] text-sm placeholder:text-[#A8A8B0] focus:border-[#C9A84C] focus:outline-none resize-none" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-[#6B7280] mb-1.5 uppercase tracking-wide">
              Alérgenos (memo de camareros / APPCC)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ALLERGENS.map((a) => {
                const active = editData.allergens.includes(a);
                return (
                  <button key={a} type="button" onClick={() => toggleAllergen(a)}
                    className={`text-xs px-2.5 py-1 rounded-full border capitalize transition-colors ${
                      active ? 'bg-[#C9A84C] text-white border-[#C9A84C]' : 'bg-white text-[#6B7280] border-[#E5E5EC] hover:border-[#C9A84C]'
                    }`}>
                    {a}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleEditItem} disabled={saving} className="text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60" style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
            <button onClick={() => setEditingId(null)} className="text-[#6B7280] text-sm px-3 hover:text-[#1A1A1A]">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Data List */}
      <DataList
        loading={loading}
        count={filteredItems.length}
        emptyTitle="No se encontraron artículos"
        emptyDescription="Prueba con otros filtros o añade un nuevo artículo."
        filters={
          <>
            <input
              type="text"
              placeholder="Buscar artículo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-[#E5E5EC] text-[#1A1A1A] text-sm placeholder:text-[#A8A8B0] focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20 focus:outline-none transition-all"
            />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-2.5 rounded-xl bg-white border border-[#E5E5EC] text-[#1A1A1A] text-sm focus:border-[#C9A84C] focus:outline-none"
            >
              <option value="all">Todas las categorías</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
              ))}
            </select>
          </>
        }
      >
        {filteredItems.map((item) => (
          <DataCard
            key={item.id}
            avatar={{
              initials: item.name.charAt(0).toUpperCase(),
              color: 'linear-gradient(135deg, #C9A84C, #A88A3A)',
            }}
            title={item.name}
            subtitle={CATEGORY_LABELS[item.category] || item.category}
            meta={[
              { label: 'PVP', value: `${item.estimated ? '~' : ''}${money(item.pvp)}` },
              { label: 'Coste', value: money(item.cost) },
              { label: 'Margen', value: `${getMargin(item.pvp, item.cost)}%` },
            ]}
            actions={
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); startEdit(item); }}
                  className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#FBF6E9] hover:text-[#C9A84C] transition-colors"
                  title="Editar"
                >
                  <Icon name="edit" className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleActive(item); }}
                  className={`text-[10px] font-medium px-2.5 py-1 rounded-full transition-colors cursor-pointer ${item.active ? 'bg-[#EFFAF2] text-[#16A34A] hover:bg-[#D1FAE5]' : 'bg-[#FEF3F3] text-[#DC2626] hover:bg-[#FEE2E2]'}`}
                  title={item.active ? 'Desactivar' : 'Activar'}
                >
                  {item.active ? '● Activo' : '○ Inactivo'}
                </button>
              </>
            }
            onClick={() => startEdit(item)}
          />
        ))}
      </DataList>

      {/* Pagination */}
      {filteredItems.length > 0 && (
        <div className="flex items-center justify-between text-xs text-[#9CA3AF]">
          <span>Mostrando {filteredItems.length} artículos</span>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 rounded-lg border border-[#E5E7EB] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#F8F3E6] transition-colors"
              >
                Anterior
              </button>
              <span className="text-[#6B7280] font-medium">Página {page} de {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 rounded-lg border border-[#E5E7EB] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#F8F3E6] transition-colors"
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
