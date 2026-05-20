'use client';
/**
 * EventFlow — Catalog CRUD (B2B)
 * 
 * Admin interface to manage catalog items.
 * Shows PVP, cost, margin (B2B only).
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

interface CatalogItem {
  id: string;
  name: string;
  category: string;
  pvp: number;
  cost: number;
  image_url: string | null;
  active: boolean;
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

// Mock data
const MOCK_ITEMS: CatalogItem[] = [
  { id: '1', name: 'Gorditas del sur', category: 'aperitivo-frio', pvp: 3.50, cost: 1.20, image_url: null, active: true },
  { id: '2', name: 'Jamón ibérico 75% bellota', category: 'aperitivo-frio', pvp: 8.00, cost: 3.50, image_url: null, active: true },
  { id: '3', name: 'Choco frito', category: 'aperitivo-caliente', pvp: 5.00, cost: 1.80, image_url: null, active: true },
  { id: '4', name: 'Carrillera a baja temperatura', category: 'carne', pvp: 12.00, cost: 4.50, image_url: null, active: true },
  { id: '5', name: 'Merluza gratinada', category: 'pescado', pvp: 11.00, cost: 4.00, image_url: null, active: true },
  { id: '6', name: 'Arroz meloso de mariscos', category: 'arroz', pvp: 10.00, cost: 3.80, image_url: null, active: true },
  { id: '7', name: 'Sorbete de limón', category: 'sorbete', pvp: 3.00, cost: 0.80, image_url: null, active: true },
  { id: '8', name: 'Tarta de celebración', category: 'postre', pvp: 4.00, cost: 1.20, image_url: null, active: true },
  { id: '9', name: 'Cava brindis', category: 'bebida', pvp: 2.50, cost: 0.90, image_url: null, active: true },
  { id: '10', name: 'Estación de mariscos', category: 'complemento', pvp: 15.00, cost: 6.00, image_url: null, active: true },
];

export default function CatalogCRUD() {
  const [items, setItems] = useState<CatalogItem[]>(MOCK_ITEMS);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  const filteredItems = items.filter((item) => {
    const matchCategory = filterCategory === 'all' || item.category === filterCategory;
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch;
  });

  const getCategoryMargin = (pvp: number, cost: number) => {
    if (pvp === 0) return 0;
    return Math.round(((pvp - cost) / pvp) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-cream text-xl font-serif mb-1">Catálogo de Artículos</h2>
          <p className="text-cream/40 text-sm">{items.length} artículos · {new Set(items.map(i => i.category)).size} categorías</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-gold text-ink px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-400 transition-colors"
        >
          + Nuevo Artículo
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Buscar artículo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2.5 rounded-lg bg-ink-900/60 border border-gold/10 text-cream text-sm focus:border-gold focus:outline-none"
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-4 py-2.5 rounded-lg bg-ink-900/60 border border-gold/10 text-cream text-sm focus:border-gold focus:outline-none"
        >
          <option value="all">Todas las categorías</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
          ))}
        </select>
      </div>

      {/* Form (inline) */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-ink-900/40 rounded-xl border border-gold/20 p-4 space-y-3"
        >
          <h3 className="text-cream font-medium text-sm">Nuevo Artículo</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="Nombre del plato"
              className="px-3 py-2 rounded-lg bg-ink-900/60 border border-gold/10 text-cream text-sm focus:border-gold focus:outline-none"
            />
            <select className="px-3 py-2 rounded-lg bg-ink-900/60 border border-gold/10 text-cream text-sm focus:border-gold focus:outline-none">
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
              ))}
            </select>
            <input
              type="number"
              placeholder="PVP (€)"
              step="0.01"
              className="px-3 py-2 rounded-lg bg-ink-900/60 border border-gold/10 text-cream text-sm focus:border-gold focus:outline-none"
            />
            <input
              type="number"
              placeholder="Coste (€)"
              step="0.01"
              className="px-3 py-2 rounded-lg bg-ink-900/60 border border-gold/10 text-cream text-sm focus:border-gold focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button className="bg-gold text-ink px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-400">
              Guardar
            </button>
            <button onClick={() => setShowForm(false)} className="text-cream/40 text-sm hover:text-cream/70">
              Cancelar
            </button>
          </div>
        </motion.div>
      )}

      {/* Table */}
      <div className="bg-ink-900/40 rounded-xl border border-gold/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gold/10">
                <th className="text-left px-4 py-3 text-cream/40 font-medium text-xs uppercase tracking-wider">Artículo</th>
                <th className="text-left px-4 py-3 text-cream/40 font-medium text-xs uppercase tracking-wider">Categoría</th>
                <th className="text-right px-4 py-3 text-cream/40 font-medium text-xs uppercase tracking-wider">PVP</th>
                <th className="text-right px-4 py-3 text-cream/40 font-medium text-xs uppercase tracking-wider">Coste</th>
                <th className="text-right px-4 py-3 text-cream/40 font-medium text-xs uppercase tracking-wider">Margen</th>
                <th className="text-center px-4 py-3 text-cream/40 font-medium text-xs uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item, i) => (
                <motion.tr
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="border-b border-gold/5 hover:bg-cream/3 transition-colors"
                >
                  <td className="px-4 py-3 text-cream">{item.name}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-cream/5 text-cream/50 px-2 py-0.5 rounded-full">
                      {CATEGORY_LABELS[item.category] || item.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-cream">{item.pvp.toFixed(2)}€</td>
                  <td className="px-4 py-3 text-right text-cream/50">{item.cost.toFixed(2)}€</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full
                      ${getCategoryMargin(item.pvp, item.cost) >= 50 ? 'bg-green-500/10 text-green-400' :
                        getCategoryMargin(item.pvp, item.cost) >= 30 ? 'bg-amber-500/10 text-amber-400' :
                        'bg-red-500/10 text-red-400'}`}>
                      {getCategoryMargin(item.pvp, item.cost)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${item.active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                      {item.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredItems.length === 0 && (
          <div className="text-center py-12 text-cream/30">
            No se encontraron artículos
          </div>
        )}
      </div>
    </div>
  );
}
