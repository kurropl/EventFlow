'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import Icon from '@/components/shared/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import dynamic from 'next/dynamic';

const OCRScanner = dynamic(() => import('@/components/b2b/OCRScanner'), {
  loading: () => <div className="h-48 bg-[#1e1e1e] rounded-xl animate-pulse" />,
});

const CocinaAlerts = dynamic(() => import('@/components/b2b/CocinaAlerts'), {
  loading: () => <div className="h-32 bg-[#1e1e1e] rounded-xl animate-pulse" />,
});

const HACCPPanel = dynamic(() => import('@/components/b2b/HACCPPanel'), {
  loading: () => <div className="h-32 bg-[#1e1e1e] rounded-xl animate-pulse" />,
});

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Recipe {
  id: string;
  name: string;
  category: string;
  version: number;
  published: boolean;
}

interface Equipment {
  id: string;
  name: string;
  category: string;
  stock: number;
  min_stock: number;
}

interface CategoryPass {
  id: string;
  category: string;
  pass_id: string;
  pass_name: string;
}

interface AppEvent {
  id: string;
  client_name: string;
  event_date: string;
  status: string;
}

interface HojaRow {
  [key: string]: any;
}

/* ------------------------------------------------------------------ */
/*  Confirm Dialog                                                    */
/* ------------------------------------------------------------------ */

function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  loading,
}: {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-md bg-[#0a0a0a] border border-[#1e1e1e] text-white">
        <DialogHeader>
          <DialogTitle className="text-gold">{title}</DialogTitle>
          <DialogDescription className="text-gray-400">
            {message}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={onCancel}
            className="text-gray-300 hover:text-white hover:bg-[#1e1e1e]"
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {loading ? 'Eliminando…' : 'Eliminar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Recetas Tab                                                       */
/* ------------------------------------------------------------------ */

function RecetasTab() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Recipe | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchRecipes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cocina/recipes');
      const data = await res.json();
      if (data.success) setRecipes(data.data || []);
    } catch {
      /* silent */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  const handlePublish = async (recipe: Recipe) => {
    try {
      await fetch(`/api/cocina/recipes/${recipe.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: !recipe.published }),
      });
      fetchRecipes();
    } catch {
      /* silent */
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch(`/api/cocina/recipes/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      setRecipes((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    } catch {
      /* silent */
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-3 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-[#1e1e1e] rounded" />
        ))}
      </div>
    );
  }

  if (!recipes.length) {
    return (
      <EmptyState
        icon="food"
        title="Sin recetas"
        description="No hay recetas registradas aún."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#1e1e1e] text-gray-400 uppercase text-xs tracking-wider">
            <th className="text-left py-3 px-3 font-medium">Nombre</th>
            <th className="text-left py-3 px-3 font-medium">Categoría</th>
            <th className="text-center py-3 px-3 font-medium">Versión</th>
            <th className="text-center py-3 px-3 font-medium">Publicada</th>
            <th className="text-right py-3 px-3 font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {recipes.map((recipe) => (
            <tr
              key={recipe.id}
              className="border-b border-[#141414] hover:bg-[#141414] transition-colors"
            >
              <td className="py-3 px-3 text-white font-medium">
                {recipe.name}
              </td>
              <td className="py-3 px-3 text-gray-300">{recipe.category}</td>
              <td className="py-3 px-3 text-center text-gray-300">
                v{recipe.version}
              </td>
              <td className="py-3 px-3 text-center">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    recipe.published
                      ? 'bg-green-900/40 text-green-400'
                      : 'bg-gray-800 text-gray-400'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      recipe.published ? 'bg-green-400' : 'bg-gray-500'
                    }`}
                  />
                  {recipe.published ? 'Sí' : 'No'}
                </span>
              </td>
              <td className="py-3 px-3 text-right">
                <div className="flex items-center justify-end gap-1.5 flex-wrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-300 hover:text-white hover:bg-[#1e1e1e] h-8 px-2 text-xs"
                    title="Editar"
                  >
                    <Icon name="edit" className="w-3.5 h-3.5 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-300 hover:text-white hover:bg-[#1e1e1e] h-8 px-2 text-xs"
                    title="Ver detalle"
                  >
                    <Icon name="search" className="w-3.5 h-3.5 mr-1" />
                    Detalle
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePublish(recipe)}
                    className="text-green-400 hover:text-green-300 hover:bg-green-900/20 h-8 px-2 text-xs"
                    title={
                      recipe.published
                        ? 'Retirar del catálogo'
                        : 'Publicar en catálogo'
                    }
                  >
                    <Icon name="check" className="w-3.5 h-3.5 mr-1" />
                    {recipe.published ? 'Retirar' : 'Publicar'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteTarget(recipe)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-900/20 h-8 px-2 text-xs"
                    title="Eliminar"
                  >
                    <Icon name="trash" className="w-3.5 h-3.5 mr-1" />
                    Eliminar
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar receta"
        message={`¿Estás seguro de eliminar la receta "${deleteTarget?.name}"? Esta acción no se puede deshacer.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Equipamiento Tab (CRUD inline)                                    */
/* ------------------------------------------------------------------ */

function EquipamientoTab() {
  const [items, setItems] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', category: '', stock: 0, min_stock: 0 });
  const [newForm, setNewForm] = useState({ name: '', category: '', stock: 0, min_stock: 0 });
  const [showNew, setShowNew] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Equipment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cocina/equipment');
      const data = await res.json();
      if (data.success) setItems(data.data || []);
    } catch {
      /* silent */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const startEdit = (eq: Equipment) => {
    setEditId(eq.id);
    setEditForm({ name: eq.name, category: eq.category, stock: eq.stock, min_stock: eq.min_stock });
  };

  const cancelEdit = () => {
    setEditId(null);
  };

  const saveEdit = async () => {
    if (!editId) return;
    setSaving(true);
    try {
      await fetch(`/api/cocina/equipment/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      fetchItems();
    } catch {
      /* silent */
    }
    setSaving(false);
    setEditId(null);
  };

  const saveNew = async () => {
    if (!newForm.name) return;
    setSaving(true);
    try {
      const res = await fetch('/api/cocina/equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newForm),
      });
      const data = await res.json();
      if (data.success) {
        setShowNew(false);
        setNewForm({ name: '', category: '', stock: 0, min_stock: 0 });
        fetchItems();
      }
    } catch {
      /* silent */
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch(`/api/cocina/equipment/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
    } catch {
      /* silent */
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-3 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-[#1e1e1e] rounded" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-300">
          {items.length} equipos registrados
        </h3>
        <Button
          size="sm"
          onClick={() => setShowNew(!showNew)}
          className="bg-gold hover:bg-gold-dark text-black font-medium text-xs h-8"
        >
          <Icon name="plus" className="w-3.5 h-3.5 mr-1" />
          Nuevo equipo
        </Button>
      </div>

      {showNew && (
        <div className="mb-4 p-3 rounded-lg border border-[#1e1e1e] bg-[#0f0f0f] space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Input
              placeholder="Nombre"
              value={newForm.name}
              onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
              className="bg-[#1a1a1a] border-[#2a2a2a] text-white placeholder:text-gray-500 h-9 text-sm"
            />
            <Input
              placeholder="Categoría"
              value={newForm.category}
              onChange={(e) => setNewForm({ ...newForm, category: e.target.value })}
              className="bg-[#1a1a1a] border-[#2a2a2a] text-white placeholder:text-gray-500 h-9 text-sm"
            />
            <Input
              type="number"
              placeholder="Stock"
              value={newForm.stock}
              onChange={(e) => setNewForm({ ...newForm, stock: Number(e.target.value) })}
              className="bg-[#1a1a1a] border-[#2a2a2a] text-white placeholder:text-gray-500 h-9 text-sm"
            />
            <Input
              type="number"
              placeholder="Stock mínimo"
              value={newForm.min_stock}
              onChange={(e) => setNewForm({ ...newForm, min_stock: Number(e.target.value) })}
              className="bg-[#1a1a1a] border-[#2a2a2a] text-white placeholder:text-gray-500 h-9 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setShowNew(false); setNewForm({ name: '', category: '', stock: 0, min_stock: 0 }); }}
              className="text-gray-400 hover:text-white h-8 text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={saveNew}
              disabled={saving || !newForm.name}
              className="bg-gold hover:bg-gold-dark text-black h-8 text-xs font-medium"
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
      )}

      {!items.length ? (
        <EmptyState
          icon="package"
          title="Sin equipos"
          description="No hay equipamiento registrado. Añade el primero."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e1e1e] text-gray-400 uppercase text-xs tracking-wider">
                <th className="text-left py-3 px-3 font-medium">Nombre</th>
                <th className="text-left py-3 px-3 font-medium">Categoría</th>
                <th className="text-center py-3 px-3 font-medium">Stock</th>
                <th className="text-center py-3 px-3 font-medium">Stock Mín.</th>
                <th className="text-right py-3 px-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((eq) => (
                <tr
                  key={eq.id}
                  className="border-b border-[#141414] hover:bg-[#141414] transition-colors"
                >
                  {editId === eq.id ? (
                    <>
                      <td className="py-2 px-3">
                        <Input
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="bg-[#1a1a1a] border-[#2a2a2a] text-white h-8 text-sm"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <Input
                          value={editForm.category}
                          onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                          className="bg-[#1a1a1a] border-[#2a2a2a] text-white h-8 text-sm"
                        />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Input
                          type="number"
                          value={editForm.stock}
                          onChange={(e) => setEditForm({ ...editForm, stock: Number(e.target.value) })}
                          className="bg-[#1a1a1a] border-[#2a2a2a] text-white h-8 text-sm w-20 mx-auto text-center"
                        />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Input
                          type="number"
                          value={editForm.min_stock}
                          onChange={(e) => setEditForm({ ...editForm, min_stock: Number(e.target.value) })}
                          className="bg-[#1a1a1a] border-[#2a2a2a] text-white h-8 text-sm w-20 mx-auto text-center"
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            onClick={saveEdit}
                            disabled={saving}
                            className="bg-gold hover:bg-gold-dark text-black h-7 text-xs px-2"
                          >
                            {saving ? '…' : 'OK'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={cancelEdit}
                            className="text-gray-400 hover:text-white h-7 text-xs px-2"
                          >
                            X
                          </Button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-3 px-3 text-white font-medium">
                        {eq.name}
                      </td>
                      <td className="py-3 px-3 text-gray-300">{eq.category}</td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`font-mono text-sm ${
                            eq.stock <= eq.min_stock
                              ? 'text-red-400'
                              : eq.stock <= eq.min_stock * 2
                              ? 'text-yellow-400'
                              : 'text-green-400'
                          }`}
                        >
                          {eq.stock}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center text-gray-400 font-mono">
                        {eq.min_stock}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEdit(eq)}
                            className="text-gray-300 hover:text-white hover:bg-[#1e1e1e] h-7 px-2 text-xs"
                            title="Editar"
                          >
                            <Icon name="edit" className="w-3 h-3 mr-1" />
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(eq)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-900/20 h-7 px-2 text-xs"
                            title="Eliminar"
                          >
                            <Icon name="trash" className="w-3 h-3 mr-1" />
                            Eliminar
                          </Button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar equipo"
        message={`¿Estás seguro de eliminar "${deleteTarget?.name}"? Esta acción no se puede deshacer.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pases Tab                                                         */
/* ------------------------------------------------------------------ */

interface ServicePass {
  id: string;
  name: string;
}

function PasesTab() {
  const [mappings, setMappings] = useState<CategoryPass[]>([]);
  const [passOptions, setPassOptions] = useState<ServicePass[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchMappings = useCallback(async () => {
    setLoading(true);
    try {
      const [mapRes, passRes] = await Promise.all([
        fetch('/api/cocina/passes'),
        fetch('/api/cocina/service-passes'),
      ]);
      const mapData = await mapRes.json();
      if (mapData.success) setMappings(mapData.data || []);
      const passData = await passRes.json();
      if (passData.success) setPassOptions(passData.data || []);
    } catch {
      /* silent */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMappings();
  }, [fetchMappings]);

  const handlePassChange = async (mapping: CategoryPass, newPassId: string) => {
    setEditingId(mapping.id);
    setSaving(true);
    try {
      const res = await fetch(`/api/cocina/passes/${mapping.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pass_id: newPassId }),
      });
      const data = await res.json();
      if (data.success) {
        setMappings((prev) =>
          prev.map((m) =>
            m.id === mapping.id ? { ...m, pass_id: newPassId, pass_name: passOptions.find(p => p.id === newPassId)?.name || newPassId } : m
          )
        );
      }
    } catch {
      /* silent */
    }
    setSaving(false);
    setEditingId(null);
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-3 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-[#1e1e1e] rounded" />
        ))}
      </div>
    );
  }

  if (!mappings.length) {
    return (
      <EmptyState
        icon="layout"
        title="Sin mapeo de pases"
        description="No hay categorías con asignación de pase."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#1e1e1e] text-gray-400 uppercase text-xs tracking-wider">
            <th className="text-left py-3 px-3 font-medium">Categoría</th>
            <th className="text-left py-3 px-3 font-medium">Pase asignado</th>
            <th className="text-right py-3 px-3 font-medium">Acción</th>
          </tr>
        </thead>
        <tbody>
          {mappings.map((m) => (
            <tr
              key={m.id}
              className="border-b border-[#141414] hover:bg-[#141414] transition-colors"
            >
              <td className="py-3 px-3 text-white font-medium">
                {m.category}
              </td>
              <td className="py-3 px-3">
                <Select
                  value={m.pass_id}
                  onValueChange={(val) => handlePassChange(m, val)}
                  disabled={editingId === m.id && saving}
                >
                  <SelectTrigger
                    className={`w-44 bg-[#1a1a1a] border-[#2a2a2a] text-white h-9 text-sm ${
                      editingId === m.id ? 'opacity-70' : ''
                    }`}
                  >
                    <SelectValue placeholder="Seleccionar pase" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
                    {passOptions.map((p) => (
                      <SelectItem
                        key={p.id}
                        value={p.id}
                        className="hover:bg-[#2a2a2a] focus:bg-[#2a2a2a] focus:text-white cursor-pointer"
                      >
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </td>
              <td className="py-3 px-3 text-right">
                {editingId === m.id && saving ? (
                  <span className="text-xs text-gold">Guardando…</span>
                ) : (
                  <span className="text-xs text-gray-500">
                    {m.pass_name}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hojas Operativas Tab                                              */
/* ------------------------------------------------------------------ */

function HojasOperativasTab() {
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [loadingEvents, setLoadingEvents] = useState(true);
const [sheetTab, setSheetTab] = useState<'produccion' | 'carga' | 'logistica' | 'alertas' | 'ocr'>('produccion');
  const [sheetData, setSheetData] = useState<HojaRow[]>([]);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [sheetError, setSheetError] = useState('');

  useEffect(() => {
    fetch('/api/events?limit=100')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setEvents(d.data || []);
        setLoadingEvents(false);
      })
      .catch(() => setLoadingEvents(false));
  }, []);

  const SHEET_ROUTE: Record<string, string> = {
    produccion: 'production',
    carga: 'loading',
    logistica: 'logistics',
  };

  function flattenSheet(tab: string, sheet: any): HojaRow[] {
    if (!sheet) return [];
    if (tab === 'produccion') {
      return (sheet.passes || []).flatMap((p: any) =>
        (p.totalIngredients || []).map((ing: any) => ({
          pase: p.pass?.passName,
          ingrediente: ing.ingredientName,
          cantidad: ing.totalQty,
          unidad: ing.unit,
        }))
      );
    }
    if (tab === 'carga') {
      if (!sheet.applies) return [{ aviso: sheet.reason || 'No aplica' }];
      return [...(sheet.perecedero || []), ...(sheet.noPerecedero || [])].map((it: any) => ({
        producto: it.productName,
        cantidad: it.quantity,
        unidad: it.unit,
        perecedero: it.perishable ? 'Sí' : 'No',
      }));
    }
    if (tab === 'logistica') {
      return (sheet.equipment || []).map((eq: any) => ({
        equipo: eq.name,
        categoria: eq.category,
        necesario: eq.needed,
        disponible: eq.available,
        falta: eq.short,
        unidad: eq.unit,
      }));
    }
    return [];
  }

  const fetchSheet = useCallback(async (eventId: string, tab: string) => {
    if (!eventId) return;
    setLoadingSheet(true);
    setSheetError('');
    try {
      const route = SHEET_ROUTE[tab] || tab;
      const res = await fetch(`/api/cocina/event/${eventId}/${route}`);
      const data = await res.json();
      if (data.success) {
        setSheetData(flattenSheet(tab, data.data?.sheet));
      } else {
        setSheetError(data.error || 'Error al cargar');
        setSheetData([]);
      }
    } catch {
      setSheetError('Error de conexión');
      setSheetData([]);
    }
    setLoadingSheet(false);
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      fetchSheet(selectedEventId, sheetTab);
    }
  }, [selectedEventId, sheetTab, fetchSheet]);

  const handleEventChange = (val: string) => {
    setSelectedEventId(val);
    setSheetData([]);
    setSheetError('');
  };

  const SHEET_TABS: { id: typeof sheetTab; label: string }[] = [
    { id: 'produccion', label: 'Producción' },
    { id: 'carga', label: 'Carga' },
    { id: 'logistica', label: 'Logística' },
    { id: 'alertas', label: 'Alertas' },
    { id: 'ocr', label: 'OCR Scanner' },
  ];

  return (
    <div>
      {/* Event Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-400 mb-1.5">
          Seleccionar evento
        </label>
        {loadingEvents ? (
          <div className="h-10 w-full max-w-md bg-[#1e1e1e] rounded animate-pulse" />
        ) : (
          <Select value={selectedEventId} onValueChange={handleEventChange}>
            <SelectTrigger className="w-full max-w-md bg-[#1a1a1a] border-[#2a2a2a] text-white h-10">
              <SelectValue placeholder="Elige un evento…" />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a] text-white max-h-72">
              {events.map((ev) => (
                <SelectItem
                  key={ev.id}
                  value={ev.id}
                  className="hover:bg-[#2a2a2a] focus:bg-[#2a2a2a] focus:text-white cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <span>{ev.client_name}</span>
                    <span className="text-gray-500 text-xs">
                      {ev.event_date?.slice(0, 10)}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!selectedEventId ? (
        <EmptyState
          icon="clipboardList"
          title="Selecciona un evento"
          description="Elige un evento para visualizar sus hojas operativas."
        />
      ) : (
        <>
          {/* Sub-tabs: Producción / Carga / Logística */}
          <div className="flex gap-1 mb-4 p-1 rounded-lg bg-[#111111] border border-[#1e1e1e] w-fit">
            {SHEET_TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setSheetTab(t.id)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  sheetTab === t.id
                    ? 'bg-gold text-black shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-[#1e1e1e]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Sheet Content */}
          {sheetTab === 'alertas' ? (
            <div className="space-y-4">
              <CocinaAlerts />
            </div>
          ) : sheetTab === 'ocr' ? (
            <div className="space-y-4">
              <OCRScanner eventId={selectedEventId || undefined} />
            </div>
          ) : loadingSheet ? (
            <div className="animate-pulse space-y-3 p-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-8 bg-[#1e1e1e] rounded" />
              ))}
            </div>
          ) : sheetError ? (
            <div className="p-6 text-center">
              <p className="text-red-400 text-sm">{sheetError}</p>
            </div>
          ) : !sheetData.length ? (
            <EmptyState
              icon="clipboardList"
              title="Sin datos"
              description={`No hay datos de ${sheetTab} para este evento.`}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e1e1e] text-gray-400 uppercase text-xs tracking-wider">
                    {Object.keys(sheetData[0]).map((key) => (
                      <th
                        key={key}
                        className="text-left py-3 px-3 font-medium whitespace-nowrap"
                      >
                        {key.replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sheetData.map((row, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-[#141414] hover:bg-[#141414] transition-colors"
                    >
                      {Object.values(row).map((val, ci) => (
                        <td
                          key={ci}
                          className="py-2.5 px-3 text-gray-200 whitespace-nowrap"
                        >
                          {val === null || val === undefined
                            ? '—'
                            : String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Guía del evento (venue-aware) — punto de entrada del módulo        */
/* ------------------------------------------------------------------ */

const ESTADO_META: Record<string, { label: string; cls: string; dot: string }> = {
  listo:      { label: 'Listo',      cls: 'text-emerald-300 border-emerald-700/50 bg-emerald-900/20', dot: 'bg-emerald-400' },
  pendiente:  { label: 'Pendiente',  cls: 'text-amber-300 border-amber-700/50 bg-amber-900/20',       dot: 'bg-amber-400' },
  bloqueado:  { label: 'Bloqueado',  cls: 'text-gray-400 border-gray-700/50 bg-gray-800/30',          dot: 'bg-gray-500' },
  no_aplica:  { label: 'No aplica',  cls: 'text-gray-500 border-gray-800 bg-transparent',             dot: 'bg-gray-700' },
};
const MOMENTO_LABEL: Record<string, string> = { pre: 'Antes del evento', dia: 'Día del evento', post: 'Después del evento' };

function GuiaTab() {
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [guia, setGuia] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [savingVenue, setSavingVenue] = useState(false);

  useEffect(() => {
    fetch('/api/events?limit=100').then(r => r.json())
      .then(d => { if (d.success) setEvents(d.data || []); }).catch(() => {});
  }, []);

  const loadGuia = useCallback(async (eventId: string) => {
    if (!eventId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/cocina/guia/${eventId}`);
      const d = await r.json();
      setGuia(d.success ? d.data : null);
    } catch { setGuia(null); } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (selectedEventId) loadGuia(selectedEventId); }, [selectedEventId, loadGuia]);

  const setVenue = async (venue_type: string) => {
    if (!selectedEventId) return;
    setSavingVenue(true);
    try {
      await fetch(`/api/events/${selectedEventId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ venue_type }),
      });
      await loadGuia(selectedEventId);
    } finally { setSavingVenue(false); }
  };

  const momentos: Array<'pre' | 'dia' | 'post'> = ['pre', 'dia', 'post'];

  return (
    <div>
      {/* Selector de evento */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <select
          value={selectedEventId}
          onChange={(e) => setSelectedEventId(e.target.value)}
          className="bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white min-w-[260px]"
        >
          <option value="">Selecciona un evento…</option>
          {events.map(ev => (
            <option key={ev.id} value={ev.id}>
              {ev.client_name} · {ev.event_date ? new Date(ev.event_date).toLocaleDateString('es-ES') : 's/f'} · {ev.status}
            </option>
          ))}
        </select>
        {guia && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500">Ubicación:</span>
            {(['benitez', 'externo'] as const).map(v => (
              <button key={v} disabled={savingVenue} onClick={() => setVenue(v)}
                className={`px-3 py-1.5 rounded-md border transition-all ${
                  guia.venue.tipo === v ? 'bg-gold text-black border-gold font-medium' : 'text-gray-300 border-[#2a2a2a] hover:border-gold/50'
                }`}>
                {v === 'benitez' ? 'En el local (Benítez)' : 'Ubicación externa'}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && <p className="text-sm text-gray-500">Cargando guía…</p>}
      {!loading && !selectedEventId && (
        <p className="text-sm text-gray-500">Elige un evento para ver su guía de cocina completa, antes y después del evento.</p>
      )}

      {guia && !loading && (
        <>
          {/* Cabecera: venue + progreso */}
          <div className="rounded-xl border border-[#1e1e1e] bg-[#0a0a0a] p-4 mb-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-white">{guia.evento.nombre}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {guia.evento.pax} pax · {guia.evento.serviceType === 'coctel' ? 'cóctel' : 'menú'} ·{' '}
                  <span className="text-gold">{guia.venue.etiqueta}</span>
                  {guia.venue.ubicacion ? ` · ${guia.venue.ubicacion}` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gold">{guia.progreso.pct}%</p>
                <p className="text-[11px] text-gray-500">{guia.progreso.completadas}/{guia.progreso.aplicables} fases</p>
              </div>
            </div>
            <div className="mt-3 flex items-start gap-2 text-xs text-gray-400 bg-[#111] rounded-lg px-3 py-2 border border-[#1e1e1e]">
              <Icon name="info" className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
              <span>{guia.venue.nota}</span>
            </div>
          </div>

          {/* Fases agrupadas por momento */}
          {momentos.map(m => {
            const fases = guia.fases.filter((f: any) => f.momento === m);
            if (fases.length === 0) return null;
            return (
              <div key={m} className="mb-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">{MOMENTO_LABEL[m]}</h3>
                <div className="space-y-2">
                  {fases.map((f: any) => {
                    const meta = ESTADO_META[f.estado] || ESTADO_META.bloqueado;
                    return (
                      <div key={f.key}
                        className={`rounded-lg border p-3 ${f.aplica ? 'border-[#1e1e1e] bg-[#0f0f0f]' : 'border-[#161616] bg-transparent opacity-60'}`}>
                        <div className="flex items-start gap-3">
                          <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${meta.dot}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-white">{f.titulo}</p>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${meta.cls}`}>{meta.label}</span>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">{f.resumen}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Panel                                                        */
/* ------------------------------------------------------------------ */

const MAIN_TABS = [
  { id: 'guia', label: 'Guía del evento' },
  { id: 'recetas', label: 'Recetas' },
  { id: 'equipamiento', label: 'Equipamiento' },
  { id: 'pases', label: 'Pases' },
  { id: 'hojas', label: 'Hojas operativas' },
  { id: 'appcc', label: 'APPCC' },
];

export default function CocinaPanel() {
  const [activeTab, setActiveTab] = useState('guia');

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gold flex items-center gap-2">
            <Icon name="food" className="w-5 h-5 text-gold" />
            Cocina
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestión de recetas, equipamiento, pases y hojas operativas
          </p>
        </div>

        {/* Main Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-lg bg-[#111111] border border-[#1e1e1e] w-fit">
          {MAIN_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-gold text-black shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-[#1e1e1e]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="rounded-xl border border-[#1e1e1e] bg-[#0f0f0f] p-4 sm:p-6">
          {activeTab === 'guia' && <GuiaTab />}
          {activeTab === 'recetas' && <RecetasTab />}
          {activeTab === 'equipamiento' && <EquipamientoTab />}
          {activeTab === 'pases' && <PasesTab />}
          {activeTab === 'hojas' && <HojasOperativasTab />}
          {activeTab === 'appcc' && (
            <div className="bg-white text-stone-800 rounded-lg p-4">
              <HACCPPanel />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
