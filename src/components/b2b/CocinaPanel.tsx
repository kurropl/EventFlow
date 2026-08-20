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
  loading: () => <div className="h-48 bg-cream-dark rounded-xl animate-pulse" />,
});

const CocinaAlerts = dynamic(() => import('@/components/b2b/CocinaAlerts'), {
  loading: () => <div className="h-32 bg-cream-dark rounded-xl animate-pulse" />,
});

const FichaTecnicaEditor = dynamic(() => import('@/components/b2b/FichaTecnicaEditor'), { ssr: false });

const HACCPPanel = dynamic(() => import('@/components/b2b/HACCPPanel'), {
  loading: () => <div className="h-32 bg-cream-dark rounded-xl animate-pulse" />,
});

// WP-09: Retorno de consumibles
import ConsumableReturnsPanel from '@/components/b2b/ConsumableReturnsPanel';
import TransportPanel from '@/components/b2b/TransportPanel';

// WP-19: Hoja de Servicio
import ServiceSheetView from '@/components/b2b/ServiceSheetView';
import { formatDate } from '@/lib/format';

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
  venue_type?: string;
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
      <DialogContent className="sm:max-w-md bg-white border border-gold/20 text-ink">
        <DialogHeader>
          <DialogTitle className="text-gold">{title}</DialogTitle>
          <DialogDescription className="text-ink-soft-60">
            {message}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={onCancel}
            className="text-ink-soft hover:text-ink hover:bg-cream-dark"
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
  // undefined = editor cerrado; null = nueva ficha; string = editar esa receta
  const [editorTarget, setEditorTarget] = useState<string | null | undefined>(undefined);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

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

  const handleImportFicha = async (file: File) => {
    setImporting(true);
    setImportError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/cocina/recipes/import-ficha', { method: 'POST', body: fd });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al importar la ficha técnica');
      await fetchRecipes();
      setEditorTarget(data.data.recipeId);
    } catch (e: any) {
      setImportError(e?.message || 'Error al importar la ficha técnica');
    }
    setImporting(false);
  };

  const newRecipeButton = (
    <div className="flex justify-end items-center gap-2 mb-3">
      {importError && (
        <span className="text-xs text-red-600 mr-2">{importError}</span>
      )}
      <label className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-cream-dark bg-white text-ink-soft text-sm font-medium cursor-pointer hover:bg-cream transition-colors">
        <Icon name="download" className="w-3.5 h-3.5" />
        {importing ? 'Importando…' : 'Importar Excel'}
        <input
          type="file" accept=".xlsx,.xls" className="hidden" disabled={importing}
          onChange={(e) => { if (e.target.files?.[0]) handleImportFicha(e.target.files[0]); e.target.value = ''; }}
        />
      </label>
      <Button size="sm" onClick={() => setEditorTarget(null)}>
        <Icon name="plus" className="w-3.5 h-3.5 mr-1.5" />
        Nueva receta
      </Button>
    </div>
  );

  const editorDialog = editorTarget !== undefined && (
    <FichaTecnicaEditor
      recipeId={editorTarget}
      onClose={() => setEditorTarget(undefined)}
      onSaved={() => { setEditorTarget(undefined); fetchRecipes(); }}
    />
  );

  if (loading) {
    return (
      <div className="animate-pulse space-y-3 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-cream-dark rounded" />
        ))}
      </div>
    );
  }

  if (!recipes.length) {
    return (
      <>
        {newRecipeButton}
        <EmptyState
          icon={<Icon name="food" className="w-6 h-6" />}
          title="Sin recetas"
          description="No hay recetas registradas aún."
        />
        {editorDialog}
      </>
    );
  }

  return (
    <div className="overflow-x-auto">
      {newRecipeButton}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gold/20 text-ink-soft uppercase text-xs tracking-wider">
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
              className="border-b border-gold/10 hover:bg-white transition-colors"
            >
              <td className="py-3 px-3 text-ink font-medium">
                {recipe.name}
              </td>
              <td className="py-3 px-3 text-ink-light">{recipe.category}</td>
              <td className="py-3 px-3 text-center text-ink-light">
                v{recipe.version}
              </td>
              <td className="py-3 px-3 text-center">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    recipe.published
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-cream-dark text-ink-soft'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      recipe.published ? 'bg-emerald-500' : 'bg-ink-soft-60'
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
                    onClick={() => setEditorTarget(recipe.id)}
                    className="text-ink-soft hover:text-ink hover:bg-cream-dark h-8 px-2 text-xs"
                    title="Ver / editar ficha técnica"
                  >
                    <Icon name="edit" className="w-3.5 h-3.5 mr-1" />
                    Ficha técnica
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePublish(recipe)}
                    className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 h-8 px-2 text-xs"
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
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 px-2 text-xs"
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
      {editorDialog}
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
          <div key={i} className="h-10 bg-cream-dark rounded" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-ink-soft">
          {items.length} equipos registrados
        </h3>
        <Button
          size="sm"
          onClick={() => setShowNew(!showNew)}
          className="bg-gold hover:bg-gold-dark text-ink font-medium text-xs h-8"
        >
          <Icon name="plus" className="w-3.5 h-3.5 mr-1" />
          Nuevo equipo
        </Button>
      </div>

      {showNew && (
        <div className="mb-4 p-3 rounded-lg border border-gold/20 bg-white space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Input
              placeholder="Nombre"
              value={newForm.name}
              onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
              className="bg-white border-gold/30 text-ink placeholder:text-ink-soft-60 h-9 text-sm"
            />
            <Input
              placeholder="Categoría"
              value={newForm.category}
              onChange={(e) => setNewForm({ ...newForm, category: e.target.value })}
              className="bg-white border-gold/30 text-ink placeholder:text-ink-soft-60 h-9 text-sm"
            />
            <Input
              type="number"
              placeholder="Stock"
              value={newForm.stock}
              onChange={(e) => setNewForm({ ...newForm, stock: Number(e.target.value) })}
              className="bg-white border-gold/30 text-ink placeholder:text-ink-soft-60 h-9 text-sm"
            />
            <Input
              type="number"
              placeholder="Stock mínimo"
              value={newForm.min_stock}
              onChange={(e) => setNewForm({ ...newForm, min_stock: Number(e.target.value) })}
              className="bg-white border-gold/30 text-ink placeholder:text-ink-soft-60 h-9 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setShowNew(false); setNewForm({ name: '', category: '', stock: 0, min_stock: 0 }); }}
              className="text-ink-soft hover:text-ink h-8 text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={saveNew}
              disabled={saving || !newForm.name}
              className="bg-gold hover:bg-gold-dark text-ink h-8 text-xs font-medium"
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
      )}

      {!items.length ? (
        <EmptyState
          icon={<Icon name="package" className="w-6 h-6" />}
          title="Sin equipos"
          description="No hay equipamiento registrado. Añade el primero."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gold/20 text-ink-soft uppercase text-xs tracking-wider">
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
                  className="border-b border-gold/10 hover:bg-white transition-colors"
                >
                  {editId === eq.id ? (
                    <>
                      <td className="py-2 px-3">
                        <Input
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="bg-white border-gold/30 text-ink h-8 text-sm"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <Input
                          value={editForm.category}
                          onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                          className="bg-white border-gold/30 text-ink h-8 text-sm"
                        />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Input
                          type="number"
                          value={editForm.stock}
                          onChange={(e) => setEditForm({ ...editForm, stock: Number(e.target.value) })}
                          className="bg-white border-gold/30 text-ink h-8 text-sm w-20 mx-auto text-center"
                        />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Input
                          type="number"
                          value={editForm.min_stock}
                          onChange={(e) => setEditForm({ ...editForm, min_stock: Number(e.target.value) })}
                          className="bg-white border-gold/30 text-ink h-8 text-sm w-20 mx-auto text-center"
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            onClick={saveEdit}
                            disabled={saving}
                            className="bg-gold hover:bg-gold-dark text-ink h-7 text-xs px-2"
                          >
                            {saving ? '…' : 'OK'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={cancelEdit}
                            className="text-ink-soft hover:text-ink h-7 text-xs px-2"
                          >
                            X
                          </Button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-3 px-3 text-ink font-medium">
                        {eq.name}
                      </td>
                      <td className="py-3 px-3 text-ink-light">{eq.category}</td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`font-mono text-sm ${
                            eq.stock <= eq.min_stock
                              ? 'text-danger'
                              : eq.stock <= eq.min_stock * 2
                              ? 'text-warning'
                              : 'text-success'
                          }`}
                        >
                          {eq.stock}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center text-ink-soft font-mono">
                        {eq.min_stock}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEdit(eq)}
                            className="text-ink-soft hover:text-ink hover:bg-cream-dark h-7 px-2 text-xs"
                            title="Editar"
                          >
                            <Icon name="edit" className="w-3 h-3 mr-1" />
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(eq)}
                            className="text-danger hover:text-danger hover:bg-danger/10 h-7 px-2 text-xs"
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
          <div key={i} className="h-10 bg-cream-dark rounded" />
        ))}
      </div>
    );
  }

  if (!mappings.length) {
    return (
      <EmptyState
        icon={<Icon name="layout" className="w-6 h-6" />}
        title="Sin mapeo de pases"
        description="No hay categorías con asignación de pase."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gold/20 text-ink-soft uppercase text-xs tracking-wider">
            <th className="text-left py-3 px-3 font-medium">Categoría</th>
            <th className="text-left py-3 px-3 font-medium">Pase asignado</th>
            <th className="text-right py-3 px-3 font-medium">Acción</th>
          </tr>
        </thead>
        <tbody>
          {mappings.map((m) => (
            <tr
              key={m.id}
              className="border-b border-gold/10 hover:bg-white transition-colors"
            >
              <td className="py-3 px-3 text-ink font-medium">
                {m.category}
              </td>
              <td className="py-3 px-3">
                <Select
                  value={m.pass_id}
                  onValueChange={(val) => handlePassChange(m, val)}
                  disabled={editingId === m.id && saving}
                >
                  <SelectTrigger
                    className={`w-44 bg-white border-gold/30 text-ink h-9 text-sm ${
                      editingId === m.id ? 'opacity-70' : ''
                    }`}
                  >
                    <SelectValue placeholder="Seleccionar pase" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-cream-dark text-ink">
                    {passOptions.map((p) => (
                      <SelectItem
                        key={p.id}
                        value={p.id}
                        className="hover:bg-cream focus:bg-cream focus:text-ink cursor-pointer"
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
                  <span className="text-xs text-ink-soft-60">
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
const [sheetTab, setSheetTab] = useState<'produccion' | 'carga' | 'logistica' | 'hoja_servicio' | 'alertas' | 'ocr'>('produccion');
  const [sheetData, setSheetData] = useState<HojaRow[]>([]);
  const [rawSheet, setRawSheet] = useState<any>(null);
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

  // Get selected event details for venue_type
  const selectedEvent = events.find(e => e.id === selectedEventId);

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
      // F2.1: agrupado real por pase (antes perecederoPasses/noPerecederoPasses
      // quedaban siempre vacíos) — se necesita saber qué cargar en cada pase.
      const groups = [...(sheet.perecederoPasses || []), ...(sheet.noPerecederoPasses || [])];
      if (groups.length) {
        return groups.flatMap((g: any) =>
          (g.items || []).map((it: any) => ({
            pase: g.pass?.passName,
            producto: it.productName,
            cantidad: it.quantity,
            unidad: it.unit,
            perecedero: it.perishable ? 'Sí' : 'No',
          }))
        );
      }
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
        setRawSheet(data.data?.sheet || null);
      } else {
        setSheetError(data.error || 'Error al cargar');
        setSheetData([]);
        setRawSheet(null);
      }
    } catch {
      setSheetError('Error de conexión');
      setSheetData([]);
      setRawSheet(null);
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
    { id: 'hoja_servicio', label: 'Hoja Servicio' },
    { id: 'alertas', label: 'Alertas' },
    { id: 'ocr', label: 'OCR Scanner' },
  ];

  return (
    <div>
      {/* Event Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-ink-soft-60 mb-1.5">
          Seleccionar evento
        </label>
        {loadingEvents ? (
          <div className="h-10 w-full max-w-md bg-cream-dark rounded animate-pulse" />
        ) : (
          <Select value={selectedEventId} onValueChange={handleEventChange}>
            <SelectTrigger className="w-full max-w-md bg-white border-gold/30 text-ink h-10">
              <SelectValue placeholder="Elige un evento…" />
            </SelectTrigger>
            <SelectContent className="bg-white border-gold/30 text-ink max-h-72">
              {events.map((ev) => (
                <SelectItem
                  key={ev.id}
                  value={ev.id}
                  className="hover:bg-cream-dark focus:bg-cream-dark focus:text-ink cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <span>{ev.client_name}</span>
                    <span className="text-ink-soft-60 text-xs">
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
          icon={<Icon name="clipboardList" className="w-6 h-6" />}
          title="Selecciona un evento"
          description="Elige un evento para visualizar sus hojas operativas."
        />
      ) : (
        <>
          {/* Sub-tabs: Producción / Carga / Logística */}
          <div className="no-print flex items-center justify-between gap-3 mb-4">
            <div className="flex gap-1 p-1 rounded-lg bg-cream-dark border border-gold/20 w-fit">
              {SHEET_TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSheetTab(t.id)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                    sheetTab === t.id
                      ? 'bg-gold text-black shadow-sm'
                      : 'text-ink-soft hover:text-ink hover:bg-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {/* F2.3: imprimir/PDF de las hojas de cocina (producción/carga/logística) */}
            {['produccion', 'carga', 'logistica'].includes(sheetTab) && sheetData.length > 0 && (
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Icon name="printer" className="w-4 h-4" />
                Imprimir / PDF
              </button>
            )}
          </div>

          {/* Título solo visible al imprimir */}
          {['produccion', 'carga', 'logistica'].includes(sheetTab) && sheetData.length > 0 && (
            <div className="hidden print:block mb-4 border-b-2 border-ink pb-2">
              <h1 className="text-lg font-bold">
                Hoja de {SHEET_TABS.find((t) => t.id === sheetTab)?.label} — {rawSheet?.eventName || ''}
              </h1>
              <p className="text-xs text-ink-soft-60">
                {(rawSheet?.eventDate || '').toString().slice(0, 10)} · {new Date().toLocaleString('es-ES')}
              </p>
            </div>
          )}

          {/* Sheet Content */}
          {sheetTab === 'hoja_servicio' ? (
            <div className="space-y-4">
              {selectedEventId && (
                <ServiceSheetView
                  eventId={selectedEventId}
                  onBack={() => setSheetTab('produccion')}
                />
              )}
            </div>
          ) : sheetTab === 'alertas' ? (
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
                <div key={i} className="h-8 bg-cream-dark rounded" />
              ))}
            </div>
          ) : sheetError ? (
            <div className="p-6 text-center">
              <p className="text-danger text-sm">{sheetError}</p>
            </div>
          ) : !sheetData.length ? (
            <EmptyState
              icon={<Icon name="clipboardList" className="w-6 h-6" />}
              title="Sin datos"
              description={`No hay datos de ${sheetTab} para este evento.`}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gold/20 text-ink-soft uppercase text-xs tracking-wider">
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
                      className="border-b border-gold/10 hover:bg-white transition-colors"
                    >
                      {Object.values(row).map((val, ci) => (
                        <td
                          key={ci}
                          className="py-2.5 px-3 text-ink whitespace-nowrap"
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
          {/* F2.2: producto seco/perecedero/desechables — el backend ya los
              calculaba (generateLogisticsSheet) pero la UI solo mostraba el
              equipamiento; el resto del pedido de furgoneta no se veía. */}
          {sheetTab === 'logistica' && rawSheet && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <LogisticsGoodsTable title="Producto seco" items={rawSheet.dryGoods} />
              <LogisticsGoodsTable title="Producto perecedero" items={rawSheet.perishableGoods} />
              <LogisticsGoodsTable title="Desechables" items={rawSheet.disposables} />
            </div>
          )}
          {sheetTab === 'logistica' && <EquipmentCheckoutPanel eventId={selectedEventId} />}
          {/* WP-16: Plan de Transporte (solo para eventos externos) */}
          {sheetTab === 'logistica' && selectedEventId && (
            <TransportPanel
              eventId={selectedEventId}
              venueType={selectedEvent?.venue_type || null}
              eventDate={selectedEvent?.event_date || null}
              clientName={selectedEvent?.client_name || null}
            />
          )}
          {/* WP-20: Vajilla y Packs en hoja de carga */}
          {sheetTab === 'carga' && rawSheet && rawSheet.vajilla && rawSheet.vajilla.length > 0 && (
            <div className="mt-6">
              <VajillaSection items={rawSheet.vajilla} pax={rawSheet.guestCount} />
            </div>
          )}
          {sheetTab === 'carga' && rawSheet && rawSheet.packs && rawSheet.packs.length > 0 && (
            <div className="mt-6">
              <PacksSection items={rawSheet.packs} />
            </div>
          )}
          {/* WP-09: Retorno de consumibles */}
          {sheetTab === 'logistica' && selectedEventId && (
            <div className="mt-6">
              <ConsumableReturnsPanel eventId={selectedEventId} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LogisticsGoodsTable({ title, items }: { title: string; items?: { productName: string; quantity: number; unit: string; category?: string }[] }) {
  const rows = items || [];
  return (
    <div className="rounded-xl border border-gold/20 bg-white overflow-hidden">
      <div className="px-3 py-2 bg-cream-dark border-b border-gold/20 text-xs font-semibold text-ink uppercase tracking-wider">
        {title} <span className="text-ink-soft-60 normal-case font-normal">({rows.length})</span>
      </div>
      {rows.length === 0 ? (
        <p className="p-3 text-xs text-ink-soft-60">Sin items</p>
      ) : (
        <table className="w-full text-xs">
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-gold/10 last:border-0">
                <td className="py-1.5 px-3 text-ink">{r.productName}</td>
                <td className="py-1.5 px-3 text-right text-ink-soft-60 whitespace-nowrap">
                  {r.quantity} {r.unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  WP-20: Sección de Vajilla                                         */
/* ------------------------------------------------------------------ */

function VajillaSection({ items, pax }: { items: { productName: string; quantity: number; unit: string; category: string; passName: string }[]; pax: number }) {
  // Agrupar por categoría
  const grouped = new Map<string, { productName: string; quantity: number; unit: string; passName: string }[]>();
  for (const item of items) {
    const cat = item.category.replace('vajilla_', '');
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(item);
  }

  return (
    <div className="rounded-xl border border-gold/20 bg-white overflow-hidden">
      <div className="px-3 py-2 bg-cream-dark border-b border-gold/20 text-xs font-semibold text-ink uppercase tracking-wider flex items-center justify-between">
        <span>🍽️ Vajilla <span className="text-ink-soft-60 normal-case font-normal">({items.length} ítems)</span></span>
        <span className="text-gold font-bold">{pax} pax</span>
      </div>
      <div className="p-3">
        {Array.from(grouped.entries()).map(([category, catItems]) => (
          <div key={category} className="mb-3 last:mb-0">
            <h4 className="text-xs font-semibold text-ink-soft mb-1 capitalize">{category}</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {catItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded bg-cream border border-cream-dark">
                  <span className="text-xs text-ink truncate">{item.productName}</span>
                  <span className="text-xs font-mono font-medium text-gold ml-2">{item.quantity}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  WP-20: Sección de Packs                                          */
/* ------------------------------------------------------------------ */

function PacksSection({ items }: { items: { productName: string; quantity: number; unit: string; category: string; notes: string | null }[] }) {
  // Agrupar por tipo de pack
  const grouped = new Map<string, { productName: string; quantity: number; unit: string; notes: string | null }[]>();
  for (const item of items) {
    // Extraer tipo de pack del category: pack_camareros_uniforme -> camareros
    const packType = item.category.split('_')[1] || 'general';
    if (!grouped.has(packType)) grouped.set(packType, []);
    grouped.get(packType)!.push(item);
  }

  const packLabels: Record<string, string> = {
    camareros: '👥 Pack Camareros',
    alergenos: '⚠️ Pack Alérgenos',
    supervivencia: '🆘 Pack Supervivencia',
  };

  return (
    <div className="rounded-xl border border-gold/20 bg-white overflow-hidden">
      <div className="px-3 py-2 bg-cream-dark border-b border-gold/20 text-xs font-semibold text-ink uppercase tracking-wider">
        📦 Packs Operativos <span className="text-ink-soft-60 normal-case font-normal">({items.length} ítems)</span>
      </div>
      <div className="p-3 space-y-3">
        {Array.from(grouped.entries()).map(([packType, packItems]) => (
          <div key={packType} className="rounded-lg border border-cream-dark bg-cream p-3">
            <h4 className="text-xs font-semibold text-ink mb-2">
              {packLabels[packType] || packType}
            </h4>
            <div className="space-y-1">
              {packItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-ink truncate flex-1">{item.productName}</span>
                  <span className="font-mono font-medium text-gold ml-2">×{item.quantity}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Reserva de equipamiento (checkout) — G12, Sprint 4/5               */
/*  La reserva se crea automáticamente al generar la hoja de logística */
/*  (eventos externos); aquí solo se gestiona su ciclo de vida:        */
/*  marcar enviado y marcar devuelto con notas de rotura/merma.        */
/* ------------------------------------------------------------------ */

interface EquipmentCheckoutRow {
  id: string;
  equipment_id: string;
  equipment_name: string;
  unit: string;
  quantity_sent: number;
  quantity_returned: number | null;
  condition_notes: string | null;
  checked_out_at: string | null;
  returned_at: string | null;
}

function EquipmentCheckoutPanel({ eventId }: { eventId: string }) {
  const [rows, setRows] = useState<EquipmentCheckoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [returnForm, setReturnForm] = useState<{ id: string; qty: string; notes: string } | null>(null);

  const fetchRows = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/cocina/equipment/checkout/${eventId}`);
      const data = await res.json();
      setRows(data.success ? data.data || [] : []);
    } catch {
      setRows([]);
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const markSent = async (equipmentId: string) => {
    setBusyId(equipmentId);
    try {
      await fetch(`/api/cocina/equipment/checkout/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sent', equipment_id: equipmentId }),
      });
      fetchRows();
    } catch {}
    setBusyId(null);
  };

  const submitReturn = async () => {
    if (!returnForm) return;
    setBusyId(returnForm.id);
    try {
      await fetch(`/api/cocina/equipment/checkout/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'return',
          equipment_id: returnForm.id,
          quantity_returned: Number(returnForm.qty) || 0,
          condition_notes: returnForm.notes || null,
        }),
      });
      setReturnForm(null);
      fetchRows();
    } catch {}
    setBusyId(null);
  };

  if (!eventId || loading) return null;
  if (rows.length === 0) return null;

  return (
    <div className="mt-6 pt-4 border-t border-cream-dark">
      <h3 className="text-sm font-semibold text-ink mb-3">Reserva de equipamiento (venue externo)</h3>
      <div className="space-y-2">
        {rows.map((r) => {
          const sent = !!r.checked_out_at;
          const returned = !!r.returned_at;
          return (
            <div key={r.id} className="p-3 rounded-lg bg-cream border border-cream-dark">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ink">{r.equipment_name}</p>
                  <p className="text-xs text-ink-soft-60">
                    {r.quantity_sent} {r.unit} enviados
                    {returned && ` · ${r.quantity_returned} ${r.unit} devueltos`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!sent && (
                    <button
                      onClick={() => markSent(r.equipment_id)}
                      disabled={busyId === r.equipment_id}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gold text-ink hover:bg-gold-dark disabled:opacity-50 transition-colors"
                    >
                      Marcar enviado
                    </button>
                  )}
                  {sent && !returned && (
                    <button
                      onClick={() => setReturnForm({ id: r.equipment_id, qty: String(r.quantity_sent), notes: '' })}
                      disabled={busyId === r.equipment_id}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg border border-cream-dark hover:border-gold disabled:opacity-50 transition-colors"
                    >
                      Marcar devuelto
                    </button>
                  )}
                  {sent && (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-success/10 text-success">
                      Enviado
                    </span>
                  )}
                  {returned && (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-ink/10 text-ink">
                      Devuelto
                    </span>
                  )}
                </div>
              </div>
              {r.condition_notes && (
                <p className="text-xs text-warning mt-2">⚠ {r.condition_notes}</p>
              )}
              {returnForm?.id === r.equipment_id && (
                <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-white border border-cream-dark">
                  <input
                    type="number"
                    min="0"
                    value={returnForm.qty}
                    onChange={(e) => setReturnForm({ ...returnForm, qty: e.target.value })}
                    className="w-20 text-sm border border-cream-dark rounded-lg px-2 py-1.5"
                  />
                  <input
                    type="text"
                    placeholder="Notas de rotura/merma (opcional)"
                    value={returnForm.notes}
                    onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
                    className="flex-1 text-sm border border-cream-dark rounded-lg px-3 py-1.5"
                  />
                  <button
                    onClick={submitReturn}
                    disabled={busyId === r.equipment_id}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gold text-ink hover:bg-gold-dark disabled:opacity-50 transition-colors"
                  >
                    Confirmar
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Guía del evento (venue-aware) — punto de entrada del módulo        */
/* ------------------------------------------------------------------ */

const ESTADO_META: Record<string, { label: string; cls: string; dot: string }> = {
  listo:      { label: 'Listo',      cls: 'text-success border-success/30 bg-success/10', dot: 'bg-success' },
  pendiente:  { label: 'Pendiente',  cls: 'text-warning border-warning/30 bg-warning/10', dot: 'bg-warning' },
  bloqueado:  { label: 'Bloqueado',  cls: 'text-ink-soft border-cream-dark bg-cream',     dot: 'bg-ink-soft-60' },
  no_aplica:  { label: 'No aplica',  cls: 'text-ink-soft-60 border-cream-dark bg-transparent', dot: 'bg-cream-dark' },
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
          className="bg-white border border-cream-dark rounded-lg px-3 py-2 text-sm text-ink min-w-[260px]"
        >
          <option value="">Selecciona un evento…</option>
          {events.map(ev => (
            <option key={ev.id} value={ev.id}>
              {ev.client_name} · {ev.event_date ? formatDate(ev.event_date) : 's/f'} · {ev.status}
            </option>
          ))}
        </select>
        {guia && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-ink-soft-60">Ubicación:</span>
            {(['benitez', 'externo'] as const).map(v => (
              <button key={v} disabled={savingVenue} onClick={() => setVenue(v)}
                className={`px-3 py-1.5 rounded-md border transition-all ${
                  guia.venue.tipo === v ? 'bg-gold text-ink border-gold font-medium' : 'text-ink-soft border-cream-dark hover:border-gold/50'
                }`}>
                {v === 'benitez' ? 'En el local (Benítez)' : 'Ubicación externa'}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && <p className="text-sm text-ink-soft-60">Cargando guía…</p>}
      {!loading && !selectedEventId && (
        <p className="text-sm text-ink-soft-60">Elige un evento para ver su guía de cocina completa, antes y después del evento.</p>
      )}

      {guia && !loading && (
        <>
          {/* Cabecera: venue + progreso */}
          <div className="rounded-xl border border-cream-dark bg-cream p-4 mb-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-ink">{guia.evento.nombre}</p>
                <p className="text-xs text-ink-soft mt-0.5">
                  {guia.evento.pax} pax · {guia.evento.serviceType === 'coctel' ? 'cóctel' : 'menú'} ·{' '}
                  <span className="text-gold">{guia.venue.etiqueta}</span>
                  {guia.venue.ubicacion ? ` · ${guia.venue.ubicacion}` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gold">{guia.progreso.pct}%</p>
                <p className="text-[11px] text-ink-soft-60">{guia.progreso.completadas}/{guia.progreso.aplicables} fases</p>
              </div>
            </div>
            <div className="mt-3 flex items-start gap-2 text-xs text-ink-soft bg-white rounded-lg px-3 py-2 border border-cream-dark">
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
                <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-soft-60 mb-2">{MOMENTO_LABEL[m]}</h3>
                <div className="space-y-2">
                  {fases.map((f: any) => {
                    const meta = ESTADO_META[f.estado] || ESTADO_META.bloqueado;
                    return (
                      <div key={f.key}
                        className={`rounded-lg border p-3 ${f.aplica ? 'border-cream-dark bg-cream' : 'border-cream-dark bg-transparent opacity-60'}`}>
                        <div className="flex items-start gap-3">
                          <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${meta.dot}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-ink">{f.titulo}</p>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${meta.cls}`}>{meta.label}</span>
                            </div>
                            <p className="text-xs text-ink-soft mt-0.5">{f.resumen}</p>
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
  const [repositionCount, setRepositionCount] = useState(0);

  useEffect(() => {
    fetch('/api/stock/supplier-orders?status=pending')
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.data)) {
          const autoCount = d.data.filter((o: any) => o.origin === 'auto_reposicion' && !o.event_id).length;
          setRepositionCount(autoCount);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-cream text-ink">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gold flex items-center gap-2 font-serif">
              <Icon name="food" className="w-5 h-5 text-gold" />
              Cocina
            </h1>
            {repositionCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-xs font-semibold">
                <Icon name="warning" className="w-3.5 h-3.5" />
                {repositionCount} {repositionCount === 1 ? 'reposición pendiente' : 'reposiciones pendientes'}
              </span>
            )}
          </div>
          <p className="text-sm text-ink-soft-60 mt-1">
            Gestión de recetas, equipamiento, pases y hojas operativas
          </p>
        </div>

        {/* Main Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-lg bg-cream-dark border border-gold/20 w-fit">
          {MAIN_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-gold text-ink shadow-sm'
                  : 'text-ink-soft hover:text-ink hover:bg-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="rounded-xl border border-cream-dark bg-white p-4 sm:p-6">
          {activeTab === 'guia' && <GuiaTab />}
          {activeTab === 'recetas' && <RecetasTab />}
          {activeTab === 'equipamiento' && <EquipamientoTab />}
          {activeTab === 'pases' && <PasesTab />}
          {activeTab === 'hojas' && <HojasOperativasTab />}
          {activeTab === 'appcc' && <HACCPPanel />}
        </div>
      </div>
    </div>
  );
}
