'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';

interface CatalogItem {
  id: string;
  name: string;
  category: string;
  pvp: number;
  cost: number;
  image_url: string | null;
  active: boolean;
  estimated?: boolean;
}

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

export default function CatalogCRUD() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', category: CATEGORIES[0], pvp: '', cost: '' });

  const loadCatalog = useCallback(async () => {
    try {
      const res = await fetch('/api/catalog');
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
      }
    } catch {
      /* keep whatever we have */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);

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

  const totalItems = items.length;
  const activeItems = items.filter((i) => i.active).length;
  const avgMargin = items.length ? items.reduce((s, i) => s + getMargin(i.pvp, i.cost), 0) / items.length : 0;
  const hasEstimated = items.some((i) => i.estimated);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-[#1A1A1A] text-xl font-serif mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Catálogo de artículos</h2>
          <p className="text-[#6B7280] text-sm">
            <span className="text-[#A88A3A] font-semibold">{totalItems}</span> artículos · <span className="text-[#16A34A] font-medium">{avgMargin.toFixed(0)}%</span> margen medio · <span className="text-[#6B7280]">{activeItems}</span> activos
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm hover:shadow transition-all"
          style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
        >
          + Nuevo artículo
        </button>
      </div>

      {hasEstimated && (
        <p className="text-[12px] text-[#9CA3AF] -mt-3">
          Los precios marcados con <span className="text-[#A88A3A]">~</span> son estimaciones por categoría; edita el artículo para fijar su PVP real.
        </p>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
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
      </div>

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

      {/* Category chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 text-xs">
        {CATEGORIES.map((cat) => {
          const count = items.filter((i) => i.category === cat && i.active).length;
          const active = filterCategory === cat;
          return (
            <div key={cat} className={`px-3 py-2 rounded-xl border cursor-pointer transition-all ${active ? 'border-[#C9A84C] bg-[#FBF6E9]' : 'border-[#ECECF1] bg-white hover:border-[#E0D3A8]'}`}
              onClick={() => setFilterCategory((f) => (f === cat ? 'all' : cat))}>
              <div className="text-[#9CA3AF] truncate">{CATEGORY_LABELS[cat]}</div>
              <div className="text-[#1A1A1A] font-semibold text-sm">{count}</div>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#ECECF1] overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="max-h-[calc(100vh-360px)] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#FAFAFC] z-10">
              <tr className="border-b border-[#ECECF1]">
                <th className="text-left px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Artículo</th>
                <th className="text-left px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Categoría</th>
                <th className="text-right px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">PVP</th>
                <th className="text-right px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Coste</th>
                <th className="text-right px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Margen</th>
                <th className="text-center px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item, i) => (
                <motion.tr
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.005, 0.4) }}
                  className="border-b border-[#F2F2F5] hover:bg-[#FAFAFC] transition-colors"
                >
                  <td className="px-4 py-2.5 text-[#1A1A1A] text-[13px] max-w-[250px] truncate" title={item.name}>{item.name}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-[10px] bg-[#F5F5F8] text-[#6B7280] px-2 py-0.5 rounded-full">
                      {CATEGORY_LABELS[item.category] || item.category}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-[#1A1A1A] text-[13px] tabular-nums">{item.estimated && <span className="text-[#C9A84C]/70">~</span>}{item.pvp.toFixed(2)}€</td>
                  <td className="px-4 py-2.5 text-right text-[#6B7280] text-[13px] tabular-nums">{item.cost.toFixed(2)}€</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full
                      ${getMargin(item.pvp, item.cost) >= 50 ? 'bg-[#EFFAF2] text-[#16A34A]' :
                        getMargin(item.pvp, item.cost) >= 30 ? 'bg-[#FFF8EC] text-[#D9920B]' :
                        'bg-[#FEF3F3] text-[#DC2626]'}`}>
                      {getMargin(item.pvp, item.cost)}%
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${item.active ? 'bg-[#EFFAF2] text-[#16A34A]' : 'bg-[#FEF3F3] text-[#DC2626]'}`}>
                      {item.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading && (
          <div className="text-center py-12 text-[#9CA3AF]">Cargando catálogo…</div>
        )}
        {!loading && filteredItems.length === 0 && (
          <div className="text-center py-12 text-[#9CA3AF]">No se encontraron artículos</div>
        )}
        {filteredItems.length > 0 && (
          <div className="px-4 py-2 border-t border-[#F2F2F5] text-xs text-[#9CA3AF] text-right">
            Mostrando {filteredItems.length} de {items.length} artículos
          </div>
        )}
      </div>
    </div>
  );
}
