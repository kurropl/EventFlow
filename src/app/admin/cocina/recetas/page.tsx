'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Icon from '@/components/shared/Icon';
import { cn } from '@/lib/utils';
import { KpiCard, SectionCard, EventSelector, CheckRow, CompactInput, Badge, Empty, ProgressBar } from '@/components/shared/CocinaUI';

interface Recipe {
  id: string; name: string; category: string; description: string | null;
  cost_per_serving: number; published: boolean; active: boolean;
  ingredient_count: number; servings: number; created_at: string;
}
interface RecipeIngredient { ingredient_name: string; quantity: number; unit: string; cost: number; unit_price?: number; per_guest: boolean; }
interface IngredientRow { key: string; cantidad: number; medida: string; ingrediente: string; precio: number; }

type ViewMode = 'list' | 'create' | 'detail';
const EMPTY_ING = (): IngredientRow => ({ key: Math.random().toString(36).slice(2), cantidad: 0, medida: 'g', ingrediente: '', precio: 0 });
const MEDIDAS = ['g', 'kg', 'ml', 'l', 'ud', 'doc'];
const CATEGORIAS = ['aperitivo-frio', 'aperitivo-caliente', 'compartir-mesa', 'carne', 'pescado', 'arroz', 'sorbete', 'postre', 'bebida', 'complemento'];
const ALLERGEN_LIST = ['GLUTEN','LACTOSA','HUEVOS','PESCADO','MARISCOS','FRUTOS_SECOS','CACAHUETES','SOJA','APIO','MOSTAZA','SESAMO','SULFITOS','MOLUSCOS','ALTRAMUCES'];

export default function RecetasPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('list'); const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null); const [search, setSearch] = useState(''); const [categoryFilter, setCategoryFilter] = useState('');
  const [publishLoading, setPublishLoading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null); const [importStatus, setImportStatus] = useState<string | null>(null);
  const [formName, setFormName] = useState(''); const [formCategory, setFormCategory] = useState('aperitivo-caliente');
  const [formDesc, setFormDesc] = useState(''); const [ingredients, setIngredients] = useState<IngredientRow[]>([EMPTY_ING()]);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<{name:string;instructions:string;allergens:string[];merma_pct:number;category:string}>({name:'',instructions:'',allergens:[],merma_pct:0.2,category:''});
  const [editIngredients, setEditIngredients] = useState<IngredientRow[]>([]);

  const toggleAllergen = (a: string) => setEditForm(f => ({...f, allergens: f.allergens.includes(a) ? f.allergens.filter(x => x !== a) : [...f.allergens, a]}));
  const categorias = [...new Set(recipes.map(r => r.category))].sort();

  const startEditing = () => {
    setEditForm({ name: detail?.name || '', instructions: detail?.instructions || '', allergens: detail?.allergens ? (Array.isArray(detail.allergens) ? [...detail.allergens] : []) : [], merma_pct: Number(detail?.merma_pct || 0.2), category: detail?.category || '' });
    setEditIngredients((detail?.ingredients || []).map((ing: any) => ({ key: Math.random().toString(36).slice(2), cantidad: Number(ing.quantity || 0), medida: ing.unit || 'g', ingrediente: ing.ingredient_name || '', precio: Number(ing.unit_price || ing.cost || 0) })));
    setIsEditing(true);
  };

  const handleEditSave = async () => {
    if (!detail?.id) return; setSaving(true);
    try {
      const res = await fetch('/api/cocina/recetas/' + detail.id, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name, instructions: editForm.instructions, category: editForm.category, merma_pct: editForm.merma_pct,
          allergens: editForm.allergens,
          ingredients: editIngredients.filter(i => i.ingrediente.trim() && i.cantidad > 0).map(i => ({ ingrediente: i.ingrediente, cantidad: i.cantidad, medida: i.medida, precio: i.precio })),
        }),
      });
      const json = await res.json();
      if (json.success) { setIsEditing(false); setEditIngredients([]); await loadDetail(detail.id); await loadRecipes(); }
      else alert(json.error || 'Error');
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };

  const loadRecipes = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const p = new URLSearchParams(); if (search) p.set('search', search); if (categoryFilter) p.set('category', categoryFilter);
      const res = await fetch(`/api/cocina/recetas?${p}`); const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Error');
      setRecipes(json.data || []);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, [search, categoryFilter]);

  const loadDetail = async (id: string) => {
    setSelectedId(id); setDetail(null);
    try { const res = await fetch(`/api/cocina/recetas/${id}`, { credentials: 'include' }); const json = await res.json(); if (!json.success) throw new Error(json.error || 'Error'); setDetail(json.data); setView('detail'); setIsEditing(false); }
    catch (e: any) { alert(e.message); }
  };

  const handlePublish = async (id: string) => {
    setPublishLoading(id);
    try { const res = await fetch(`/api/cocina/recetas/${id}/publish`, { method: 'POST' }); const json = await res.json(); if (!json.success) throw new Error(json.error || 'Error'); await loadRecipes(); if (selectedId === id) loadDetail(id); }
    catch (e: any) { alert(e.message); } finally { setPublishLoading(null); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta receta?')) return;
    try { const res = await fetch(`/api/cocina/recetas/${id}`, { method: 'DELETE' }); const json = await res.json(); if (!json.success) throw new Error(json.error || 'Error'); if (selectedId === id) { setView('list'); setDetail(null); } await loadRecipes(); }
    catch (e: any) { alert(e.message); }
  };

  const addIng = () => setIngredients(p => [...p, EMPTY_ING()]);
  const removeIng = (k: string) => setIngredients(p => p.filter(i => i.key !== k));
  const updateIng = (k: string, f: keyof IngredientRow, v: any) => setIngredients(p => p.map(i => i.key === k ? { ...i, [f]: v } : i));
  const resetForm = () => { setFormName(''); setFormCategory('aperitivo-caliente'); setFormDesc(''); setIngredients([EMPTY_ING()]); setImportStatus(null); setView('list'); };

  const handleSave = async () => {
    if (!formName.trim()) { alert('El nombre es obligatorio'); return; }
    const valid = ingredients.filter(i => i.ingrediente.trim() && i.cantidad > 0);
    if (valid.length === 0) { alert('Añade al menos un ingrediente'); return; }
    setSaving(true);
    try { const res = await fetch('/api/cocina/recetas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: formName.trim(), category: formCategory, description: formDesc, ingredients: valid.map(i => ({ ingrediente: i.ingrediente, cantidad: i.cantidad, medida: i.medida, precio: i.precio })) }) }); const json = await res.json(); if (!json.success) throw new Error(json.error || 'Error'); alert(`Receta "${formName}" creada.`); resetForm(); await loadRecipes(); }
    catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return; setImportStatus('Importando...');
    try { const fd = new FormData(); fd.append('file', file); const res = await fetch('/api/recipes/import', { method: 'POST', body: fd }); const json = await res.json(); setImportStatus(json.success ? '✅ Importado' : `❌ ${json.error}`); if (json.success) { resetForm(); await loadRecipes(); } }
    catch (e: any) { setImportStatus(`❌ Error: ${e.message}`); }
  };

  useEffect(() => { loadRecipes(); }, [search, categoryFilter]);

  if (error) return <Empty icon="warning" title="Error" sub={error} action={<button onClick={loadRecipes} className="px-3 py-1.5 rounded-lg bg-ink text-white text-[11px] font-medium">Reintentar</button>} />;

  /* ─── CREATE VIEW ─── */
  if (view === 'create') return (
    <div className="space-y-3 max-w-4xl">
      <div className="bg-white rounded-lg border border-divider/50 p-3 flex items-center justify-between">
        <div><h2 className="text-sm font-medium text-ink">Nueva Receta</h2><p className="text-[10px] text-ink-soft">Define la ficha técnica</p></div>
        <div className="flex gap-2">
          <button onClick={resetForm} className="px-3 py-1.5 rounded-lg border border-divider text-[11px] text-ink-soft hover:bg-cream">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 rounded-lg bg-ink text-white text-[11px] font-medium hover:bg-ink-light disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </div>
      <SectionCard title="Datos generales" icon="bookOpen">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="sm:col-span-2"><CompactInput value={formName} onChange={setFormName} placeholder="Nombre del plato" /></div>
          <select value={formCategory} onChange={e => setFormCategory(e.target.value)} className="px-2 py-1 rounded border border-divider text-[11px] focus:outline-none focus:ring-2 focus:ring-gold/20">{CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}</select>
        </div>
      </SectionCard>
      <SectionCard title="Ingredientes" icon="layers" actions={
        <div className="flex gap-1.5">
          <button onClick={() => fileInputRef.current?.click()} className="px-2 py-1 rounded border border-divider text-[10px] text-ink-soft hover:bg-cream"><Icon name="download" className="w-3 h-3" /></button>
          <button onClick={addIng} className="px-2 py-1 rounded-lg bg-ink text-white text-[10px] font-medium"><Icon name="plus" className="w-3 h-3" /></button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileImport} />
        </div>
      }>
        {importStatus && <div className="p-2 rounded bg-cream text-[10px] text-ink">{importStatus}</div>}
        <div className="overflow-x-auto rounded border border-divider">
          <table className="w-full text-[10px]">
            <thead><tr className="bg-cream text-ink-soft"><th className="px-2 py-1.5 text-left w-16">Cant.</th><th className="px-2 py-1.5 text-left w-12">Ud.</th><th className="px-2 py-1.5 text-left">Ingrediente</th><th className="px-2 py-1.5 text-right w-20">Precio/ud</th><th className="px-2 py-1.5 text-right w-20">Total</th><th className="w-6"></th></tr></thead>
            <tbody className="divide-y divide-divider">{ingredients.map((ing, idx) => (
              <tr key={ing.key} className="hover:bg-cream/30">
                <td className="px-1 py-1"><input type="number" step="0.01" min="0" value={ing.cantidad || ''} onChange={e => updateIng(ing.key, 'cantidad', Number(e.target.value))} className="w-full px-1.5 py-1 rounded border border-divider text-[10px] text-right focus:outline-none focus:ring-2 focus:ring-gold/20" /></td>
                <td className="px-1 py-1"><select value={ing.medida} onChange={e => updateIng(ing.key, 'medida', e.target.value)} className="w-full px-1 py-1 rounded border border-divider text-[10px] focus:outline-none focus:ring-2 focus:ring-gold/20">{MEDIDAS.map(m => <option key={m} value={m}>{m}</option>)}</select></td>
                <td className="px-1 py-1"><input type="text" value={ing.ingrediente} onChange={e => updateIng(ing.key, 'ingrediente', e.target.value)} placeholder="Nombre..." className="w-full px-1.5 py-1 rounded border border-divider text-[10px] focus:outline-none focus:ring-2 focus:ring-gold/20" /></td>
                <td className="px-1 py-1"><input type="number" step="0.001" min="0" value={ing.precio || ''} onChange={e => updateIng(ing.key, 'precio', Number(e.target.value))} className="w-full px-1.5 py-1 rounded border border-divider text-[10px] text-right focus:outline-none focus:ring-2 focus:ring-gold/20" /></td>
                <td className="px-1 py-1 text-right text-[10px] text-ink-soft font-medium">{(ing.cantidad * ing.precio).toFixed(2)}€</td>
                <td className="px-1 py-1"><button onClick={() => removeIng(ing.key)} className="p-0.5 rounded hover:bg-danger/10 text-ink-soft hover:text-danger"><Icon name="x" className="w-3 h-3" /></button></td>
              </tr>
            ))}</tbody>
            <tfoot><tr className="bg-cream/50"><td colSpan={4} className="px-2 py-1.5 text-right text-[10px] text-ink-soft">Coste total:</td><td className="px-2 py-1.5 text-right text-[10px] text-ink font-bold">{ingredients.reduce((s, i) => s + i.cantidad * i.precio, 0).toFixed(2)}€</td><td></td></tr></tfoot>
          </table>
        </div>
      </SectionCard>
    </div>
  );

  /* ─── DETAIL VIEW ─── */
  if (view === 'detail' && !detail) return <div className="flex justify-center py-20"><div className="w-5 h-5 border-2 border-gold/30 border-t-gold rounded-full animate-spin" /></div>;
  if (view === 'detail' && detail) {
    const ingres = detail.ingredients || []; const totalRawCost = ingres.reduce((s: number, i: RecipeIngredient) => s + Number(i.cost || 0), 0);
    const merma = Number(detail.merma_pct || 0.2); const totalConMerma = totalRawCost * (1 + merma); const pvp = totalConMerma * 3; const beneficio = pvp - totalConMerma;
    return (
      <div className="space-y-3 max-w-5xl">
        <div className="bg-white rounded-lg border border-divider/50 p-3 flex items-start justify-between">
          <div>
            <button onClick={() => setView('list')} className="text-[11px] text-ink-soft hover:text-ink flex items-center gap-1 mb-1"><Icon name="arrowLeft" className="w-3 h-3" /> Volver</button>
            <div className="flex items-center gap-2">
              {isEditing ? <CompactInput value={editForm.name} onChange={v => setEditForm(f=>({...f,name:v}))} /> : <h2 className="text-sm font-medium text-ink">{detail.name}</h2>}
              <Badge label={detail.published ? 'Publicado' : 'Borrador'} variant={detail.published ? 'ok' : 'warn'} />
            </div>
          </div>
          <div className="flex gap-1.5">
            {isEditing ? (
              <><button onClick={() => { setIsEditing(false); loadDetail(detail.id); }} className="px-2.5 py-1.5 rounded-lg border border-divider text-[11px] text-ink-soft hover:bg-cream">Cancelar</button><button onClick={handleEditSave} disabled={saving} className="px-2.5 py-1.5 rounded-lg bg-ink text-white text-[11px] font-medium hover:bg-ink-light disabled:opacity-50">{saving ? '...' : 'Guardar'}</button></>
            ) : (
              <><button onClick={startEditing} className="px-2.5 py-1.5 rounded-lg border border-divider text-[11px] text-ink-soft hover:bg-cream flex items-center gap-1"><Icon name="edit" className="w-3 h-3" /> Editar</button><button onClick={() => handlePublish(detail.id)} disabled={publishLoading === detail.id} className="px-2.5 py-1.5 rounded-lg border border-divider text-[11px] text-ink-soft hover:bg-cream"><Icon name="send" className="w-3 h-3" /></button></>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <SectionCard title="Elaboración" icon="fileText" className="sm:col-span-2">
            {isEditing ? <textarea value={editForm.instructions} onChange={e => setEditForm(f=>({...f,instructions:e.target.value}))} className="w-full px-2 py-1.5 rounded border border-divider text-[11px] min-h-[60px] focus:outline-none focus:ring-2 focus:ring-gold/20" /> :
              <p className="text-[11px] text-ink whitespace-pre-line">{detail.instructions || <span className="italic text-ink-soft">Sin instrucciones</span>}</p>}
          </SectionCard>
          <SectionCard title="Alérgenos" icon="shield">
            {isEditing ? ALLERGEN_LIST.map(a => (
              <button key={a} onClick={() => toggleAllergen(a)} className={cn('px-2 py-0.5 rounded text-[9px] font-medium border mr-1 mb-1', editForm.allergens.includes(a) ? 'bg-gold/20 text-gold-dark border-gold/40' : 'bg-white text-ink-soft border-divider')}>{a}</button>
            )) : (
              <div className="flex flex-wrap gap-1">{detail.allergens && (Array.isArray(detail.allergens) ? detail.allergens : JSON.parse(detail.allergens || '[]')).map((a: string, i: number) => <span key={i} className="px-2 py-0.5 rounded-full bg-gold/10 text-gold-dark text-[9px] font-medium border border-gold/20">{a}</span>)}
                {(!detail.allergens || (Array.isArray(detail.allergens) ? detail.allergens : []).length === 0) && <p className="text-[11px] text-ink-soft italic">Sin alérgenos</p>}
              </div>
            )}
          </SectionCard>
        </div>

        <SectionCard title="Ingredientes" icon="layers" badge={`${ingres.length} items`}
          actions={isEditing ? <button onClick={() => setEditIngredients(p => [...p, { key: Math.random().toString(36).slice(2), cantidad: 0, medida: 'g', ingrediente: '', precio: 0 }])} className="px-2 py-1 rounded-lg bg-ink text-white text-[9px] font-medium"><Icon name="plus" className="w-3 h-3" /></button> : undefined}>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead><tr className="bg-cream text-ink-soft"><th className="px-2 py-1.5 text-left">Cant.</th><th className="px-2 py-1.5 text-left">Ud.</th><th className="px-2 py-1.5 text-left">Ingrediente</th><th className="px-2 py-1.5 text-right">Precio Ud.</th><th className="px-2 py-1.5 text-right">Total</th>{isEditing && <th className="w-6"></th>}</tr></thead>
              <tbody className="divide-y divide-divider">{(isEditing ? editIngredients : ingres).map((ing: any, i: number) => (
                <tr key={i} className="hover:bg-cream/30">
                  {isEditing ? <>
                    <td className="px-1 py-1"><CompactInput type="number" value={ing.cantidad} onChange={v => setEditIngredients(p => p.map((x,j) => j===i ? {...x, cantidad: v} : x))} /></td>
                    <td className="px-1 py-1"><select value={ing.medida} onChange={e => setEditIngredients(p => p.map((x,j) => j===i ? {...x, medida: e.target.value} : x))} className="w-full px-1 py-1 rounded border border-divider text-[10px]">{MEDIDAS.map(m => <option key={m} value={m}>{m}</option>)}</select></td>
                    <td className="px-1 py-1"><CompactInput value={ing.ingrediente} onChange={v => setEditIngredients(p => p.map((x,j) => j===i ? {...x, ingrediente: v} : x))} /></td>
                    <td className="px-1 py-1"><CompactInput type="number" value={ing.precio} onChange={v => setEditIngredients(p => p.map((x,j) => j===i ? {...x, precio: v} : x))} /></td>
                    <td className="px-1 py-1 text-right font-medium">{(ing.cantidad * ing.precio).toFixed(2)}€</td>
                    <td className="px-1 py-1"><button onClick={() => setEditIngredients(p => p.filter((_,j) => j !== i))} className="p-0.5 rounded hover:bg-danger/10 text-ink-soft hover:text-danger"><Icon name="x" className="w-3 h-3" /></button></td>
                  </> : <>
                    <td className="px-2 py-1.5 font-medium">{Number(ing.quantity).toFixed(4)}</td>
                    <td className="px-2 py-1.5 text-ink-soft">{ing.unit}</td>
                    <td className="px-2 py-1.5">{ing.ingredient_name}</td>
                    <td className="px-2 py-1.5 text-right">{Number(ing.unit_price || 0).toFixed(2)}€</td>
                    <td className="px-2 py-1.5 text-right font-medium">{Number(ing.cost || 0).toFixed(4)}€</td>
                  </>}
                </tr>
              ))}</tbody>
            </table>
          </div>
        </SectionCard>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SectionCard title="Costes" icon="calculator">
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between"><span className="text-ink-soft">Materia prima:</span><span className="font-medium">{totalRawCost.toFixed(4)}€</span></div>
              <div className="flex justify-between"><span className="text-ink-soft">Merma ({(merma*100).toFixed(0)}%):</span><span className="text-ink-soft">{(totalRawCost * merma).toFixed(4)}€</span></div>
              <div className="border-t border-divider pt-1 mt-1"><div className="flex justify-between font-medium"><span>Coste con merma:</span><span>{totalConMerma.toFixed(4)}€</span></div></div>
            </div>
          </SectionCard>
          <SectionCard title="Precios" icon="receipt">
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between"><span className="text-ink-soft">Coste unitario:</span><span>{totalConMerma.toFixed(4)}€</span></div>
              <div className="flex justify-between"><span className="text-ink-soft">PVP sugerido (3×):</span><span className="text-success font-medium">{pvp.toFixed(2)}€</span></div>
              <div className="border-t border-divider pt-1 mt-1"><div className="flex justify-between"><span className="text-ink-soft">Beneficio:</span><span className="text-success font-medium">{beneficio.toFixed(2)}€</span></div></div>
            </div>
          </SectionCard>
        </div>
      </div>
    );
  }

  /* ─── LIST VIEW ─── */
  return (
    <div className="space-y-3">
      <div className="bg-white rounded-lg border border-divider/50 p-3 flex items-center justify-between">
        <div><h2 className="text-sm font-medium text-ink">Recetas</h2><p className="text-[10px] text-ink-soft">{recipes.length} fichas técnicas</p></div>
        <div className="flex gap-2">
          <button onClick={() => fileInputRef.current?.click()} className="px-2.5 py-1.5 rounded-lg border border-divider text-[11px] text-ink-soft hover:bg-cream flex items-center gap-1"><Icon name="download" className="w-3.5 h-3.5" /> Importar</button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileImport} />
          <button onClick={() => setView('create')} className="px-2.5 py-1.5 rounded-lg bg-ink text-white text-[11px] font-medium hover:bg-ink-light flex items-center gap-1"><Icon name="plus" className="w-3.5 h-3.5" /> Nueva</button>
        </div>
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-xs"><Icon name="search" className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-ink-soft" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="w-full pl-7 pr-2 py-1.5 rounded-lg border border-divider bg-white text-[11px] focus:outline-none focus:ring-2 focus:ring-gold/20" /></div>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="px-2 py-1.5 rounded-lg border border-divider bg-white text-[11px] focus:outline-none focus:ring-2 focus:ring-gold/20"><option value="">Todas</option>{categorias.map(c => <option key={c} value={c}>{c}</option>)}</select>
        {importStatus && <span className="text-[11px] text-ink-soft self-center">{importStatus}</span>}
      </div>
      {loading ? <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-24 rounded-lg bg-white border border-divider animate-pulse" />)}</div>
      : recipes.length === 0 ? <Empty icon="bookOpen" title="No hay recetas" sub="Crea tu primera receta o importa desde Excel" action={<button onClick={() => setView('create')} className="px-3 py-1.5 rounded-lg bg-ink text-white text-[11px] font-medium">Crear</button>} />
      : <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {recipes.map(r => (
          <div key={r.id} onClick={() => loadDetail(r.id)} className="bg-white rounded-lg border border-divider/50 p-3 hover:shadow-sm transition-shadow cursor-pointer">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0 flex-1"><p className="text-[11px] font-medium text-ink truncate">{r.name}</p><span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-cream text-[9px] text-ink-soft capitalize">{r.category}</span></div>
              <Badge label={r.published ? 'Publicado' : 'Borrador'} variant={r.published ? 'ok' : 'warn'} />
            </div>
            <div className="flex items-center gap-2 text-[9px] text-ink-soft mb-2">
              <span className="flex items-center gap-0.5"><Icon name="layers" className="w-2.5 h-2.5" />{r.ingredient_count} ing.</span>
              <span className="flex items-center gap-0.5"><Icon name="calculator" className="w-2.5 h-2.5" />{Number(r.cost_per_serving).toFixed(2)}€</span>
            </div>
            <div className="flex gap-1.5 pt-2 border-t border-divider" onClick={e => e.stopPropagation()}>
              <button onClick={() => handlePublish(r.id)} disabled={publishLoading === r.id || r.published} className="px-2 py-0.5 rounded text-[9px] font-medium text-ink-soft hover:bg-cream disabled:opacity-40"><Icon name="send" className="w-2.5 h-2.5 inline mr-0.5" />Publicar</button>
              <button onClick={() => handleDelete(r.id)} className="px-2 py-0.5 rounded text-[9px] font-medium text-danger/70 hover:bg-danger/5 ml-auto"><Icon name="trash" className="w-2.5 h-2.5" /></button>
            </div>
          </div>
        ))}
      </div>}
    </div>
  );
}