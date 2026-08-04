'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Pause, 
  Play,
  Copy,
  ChevronDown,
  ChevronUp,
  Save,
  X,
  Search,
  Filter
} from 'lucide-react';

// ============================================================
// Types
// ============================================================

interface Menu {
  id: string;
  name: string;
  version: number;
  status: 'borrador' | 'publicado' | 'pausado' | 'retirado';
  price_per_pax: number;
  description: string | null;
  parent_menu_id: string | null;
  cost_per_pax: number;
  margin_pct: number;
  created_at: string;
  updated_at: string;
  sections?: MenuSection[];
}

interface MenuSection {
  id: string;
  menu_id: string;
  name: string;
  position: number;
  dishes: MenuDish[];
}

interface MenuDish {
  id: string;
  section_id: string;
  dish_id: string;
  variant_tag: string | null;
  position: number;
  notes: string | null;
  dish_name?: string;
  dish_category?: string;
  dish_cost?: number;
  dish_pvp?: number;
}

interface CatalogItem {
  id: string;
  name: string;
  category: string;
  cost: number;
  pvp: number;
}

// ============================================================
// Status Helpers
// ============================================================

const STATUS_CONFIG = {
  borrador: { label: 'Borrador', color: 'bg-gray-100 text-gray-700', icon: Edit3 },
  publicado: { label: 'Publicado', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  pausado: { label: 'Pausado', color: 'bg-yellow-100 text-yellow-700', icon: Pause },
  retirado: { label: 'Retirado', color: 'bg-red-100 text-red-700', icon: XCircle },
};

const VALID_TRANSITIONS: Record<string, string[]> = {
  borrador: ['publicado', 'retirado'],
  publicado: ['pausado', 'retirado'],
  pausado: ['publicado', 'retirado'],
  retirado: [],
};

// ============================================================
// Main Component
// ============================================================

export default function MenusManager() {
  // State
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    price_per_pax: 0,
    description: '',
  });

  // Catalog for dish selection
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);

  // ============================================================
  // Data fetching
  // ============================================================

  const fetchMenus = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (searchFilter) params.set('search', searchFilter);
      
      const response = await fetch(`/api/menus?${params.toString()}`);
      const data = await response.json();
      
      if (data.success) {
        setMenus(data.data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Error al cargar menús');
    } finally {
      setLoading(false);
    }
  };

  const fetchMenuDetails = async (id: string) => {
    try {
      const response = await fetch(`/api/menus/${id}`);
      const data = await response.json();
      
      if (data.success) {
        // Update menu in list with details
        setMenus(prev => prev.map(m => 
          m.id === id ? { ...m, sections: data.data.sections } : m
        ));
      }
    } catch (err) {
      console.error('Error loading menu details:', err);
    }
  };

  const fetchCatalog = async () => {
    try {
      const response = await fetch('/api/catalog');
      const data = await response.json();
      if (data.success) {
        setCatalogItems(data.data);
      }
    } catch (err) {
      console.error('Error loading catalog:', err);
    }
  };

  useEffect(() => {
    fetchMenus();
    fetchCatalog();
  }, [statusFilter, searchFilter]);

  // ============================================================
  // CRUD Operations
  // ============================================================

  const handleCreate = async () => {
    try {
      const response = await fetch('/api/menus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setShowModal(false);
        setFormData({ name: '', price_per_pax: 0, description: '' });
        fetchMenus();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Error al crear menú');
    }
  };

  const handleUpdate = async () => {
    if (!editingMenu) return;
    
    try {
      const response = await fetch(`/api/menus/${editingMenu.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setShowModal(false);
        setEditingMenu(null);
        setFormData({ name: '', price_per_pax: 0, description: '' });
        fetchMenus();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Error al actualizar menú');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este menú?')) return;
    
    try {
      const response = await fetch(`/api/menus/${id}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.success) {
        fetchMenus();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Error al eliminar menú');
    }
  };

  const handleTransition = async (id: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/menus/${id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        fetchMenus();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Error al cambiar estado');
    }
  };

  // ============================================================
  // UI Helpers
  // ============================================================

  const openCreateModal = () => {
    setEditingMenu(null);
    setFormData({ name: '', price_per_pax: 0, description: '' });
    setShowModal(true);
  };

  const openEditModal = (menu: Menu) => {
    setEditingMenu(menu);
    setFormData({
      name: menu.name,
      price_per_pax: menu.price_per_pax,
      description: menu.description || '',
    });
    setShowModal(true);
  };

  const toggleExpand = async (id: string) => {
    if (expandedMenu === id) {
      setExpandedMenu(null);
    } else {
      setExpandedMenu(id);
      // Load details if not loaded
      const menu = menus.find(m => m.id === id);
      if (menu && !menu.sections) {
        await fetchMenuDetails(id);
      }
    }
  };

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Menús</h1>
          <p className="text-ink-soft text-sm">
            Gestiona los menús del catálogo con versionado y estados
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-gold text-white rounded-lg hover:bg-gold-dark transition-colors"
        >
          <Plus size={18} />
          Nuevo Menú
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input
            type="text"
            placeholder="Buscar menús..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-cream-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-cream-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50"
        >
          <option value="">Todos los estados</option>
          <option value="borrador">Borrador</option>
          <option value="publicado">Publicado</option>
          <option value="pausado">Pausado</option>
          <option value="retirado">Retirado</option>
        </select>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <button 
            onClick={() => setError(null)}
            className="ml-2 underline"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-8 text-ink-soft">
          Cargando menús...
        </div>
      )}

      {/* Menu List */}
      {!loading && menus.length === 0 && (
        <div className="text-center py-8 text-ink-soft">
          No se encontraron menús
        </div>
      )}

      {!loading && menus.map(menu => (
        <div
          key={menu.id}
          className="bg-white border border-cream-dark rounded-xl overflow-hidden"
        >
          {/* Menu Header */}
          <div 
            className="p-4 cursor-pointer hover:bg-cream/50 transition-colors"
            onClick={() => toggleExpand(menu.id)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-ink">{menu.name}</h3>
                  <span className="text-sm text-ink-soft">v{menu.version}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[menu.status].color}`}>
                    {STATUS_CONFIG[menu.status].label}
                  </span>
                </div>
                <p className="text-sm text-ink-soft mt-1">
                  {menu.description || 'Sin descripción'}
                </p>
                <div className="flex gap-4 mt-2 text-sm">
                  <span className="text-ink">
                    <strong>€{Number(menu.price_per_pax || 0).toFixed(2)}</strong>/pax
                  </span>
                  <span className="text-ink-soft">
                    Coste: €{Number(menu.cost_per_pax || 0).toFixed(2)}
                  </span>
                  <span className={Number(menu.margin_pct) >= 20 ? 'text-green-600' : 'text-red-600'}>
                    Margen: {Number(menu.margin_pct || 0).toFixed(1)}%
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Action buttons based on status */}
                {menu.status === 'borrador' && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditModal(menu); }}
                      className="p-2 text-ink-soft hover:text-gold hover:bg-cream rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(menu.id); }}
                      className="p-2 text-ink-soft hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
                
                {VALID_TRANSITIONS[menu.status]?.map(nextStatus => (
                  <button
                    key={nextStatus}
                    onClick={(e) => { e.stopPropagation(); handleTransition(menu.id, nextStatus); }}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      nextStatus === 'publicado' ? 'bg-green-500 text-white hover:bg-green-600' :
                      nextStatus === 'pausado' ? 'bg-yellow-500 text-white hover:bg-yellow-600' :
                      nextStatus === 'retirado' ? 'bg-red-500 text-white hover:bg-red-600' :
                      'bg-gray-500 text-white hover:bg-gray-600'
                    }`}
                  >
                    {nextStatus === 'publicado' && <><CheckCircle size={14} className="inline mr-1" />Publicar</>}
                    {nextStatus === 'pausado' && <><Pause size={14} className="inline mr-1" />Pausar</>}
                    {nextStatus === 'retirado' && <><XCircle size={14} className="inline mr-1" />Retirar</>}
                  </button>
                ))}
                
                {expandedMenu === menu.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
            </div>
          </div>

          {/* Expanded Details */}
          {expandedMenu === menu.id && menu.sections && (
            <div className="border-t border-cream-dark p-4 bg-cream/30">
              <h4 className="font-medium text-ink mb-3">Secciones del menú</h4>
              
              {menu.sections.length === 0 ? (
                <p className="text-sm text-ink-soft">No hay secciones definidas</p>
              ) : (
                <div className="space-y-3">
                  {menu.sections.map(section => (
                    <div key={section.id} className="bg-white rounded-lg p-3 border border-cream-dark">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-medium text-ink">{section.name}</h5>
                        <span className="text-sm text-ink-soft">#{section.position}</span>
                      </div>
                      
                      {section.dishes.length === 0 ? (
                        <p className="text-sm text-ink-soft">Sin platos</p>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {section.dishes.map(dish => (
                            <div key={dish.id} className="text-sm p-2 bg-cream/50 rounded">
                              <div className="font-medium">{dish.dish_name || 'Plato no encontrado'}</div>
                              {dish.variant_tag && (
                                <span className="text-xs px-1 py-0.5 bg-blue-100 text-blue-700 rounded">
                                  {dish.variant_tag}
                                </span>
                              )}
                              <div className="text-xs text-ink-soft mt-1">
                                Coste: €{(dish.dish_cost || 0).toFixed(2)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {menu.parent_menu_id && (
                <p className="text-sm text-ink-soft mt-3">
                  Versión anterior: {menu.parent_menu_id}
                </p>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-ink">
                {editingMenu ? 'Editar Menú' : 'Nuevo Menú'}
              </h2>
              <button
                onClick={() => { setShowModal(false); setEditingMenu(null); }}
                className="p-2 text-ink-soft hover:text-ink rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-cream-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50"
                  placeholder="Ej: Menú Especial"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-1">
                  Precio por pax (€) *
                </label>
                <input
                  type="number"
                  value={formData.price_per_pax}
                  onChange={(e) => setFormData(prev => ({ ...prev, price_per_pax: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-cream-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50"
                  min="0"
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-1">
                  Descripción
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-cream-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50"
                  rows={3}
                  placeholder="Descripción del menú..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowModal(false); setEditingMenu(null); }}
                className="flex-1 px-4 py-2 border border-cream-dark rounded-lg hover:bg-cream transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={editingMenu ? handleUpdate : handleCreate}
                disabled={!formData.name || formData.price_per_pax < 0}
                className="flex-1 px-4 py-2 bg-gold text-white rounded-lg hover:bg-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Save size={16} />
                {editingMenu ? 'Guardar Cambios' : 'Crear Menú'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
