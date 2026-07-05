'use client';
/**
 * EventFlow — Ficha técnica de receta
 *
 * Réplica de PLANTILLA_FICHA_TECNICA_AUTOMATIZADA.xlsx: ingredientes+coste a
 * un lado, elaboración+alérgenos+foto+autor al otro, con la cascada de
 * coste→precio debajo. Sustituye a los botones "Editar"/"Detalle" que antes
 * no tenían ningún manejador — y a la vez sustituye el modelo de merma
 * por-ingrediente por un único % de receta (decisión del cliente).
 */
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Icon from '@/components/shared/Icon';
import { CATALOG_CATEGORIES } from '@/lib/recipeImport';

const CATEGORY_LABELS: Record<string, string> = {
  'aperitivo-frio': 'Aperitivo frío',
  'aperitivo-caliente': 'Aperitivo caliente',
  'compartir-mesa': 'Para compartir',
  carne: 'Carne',
  pescado: 'Pescado',
  arroz: 'Arroz',
  sorbete: 'Sorbete',
  postre: 'Postre',
  bebida: 'Bebida',
  complemento: 'Complemento',
};

interface Linea {
  id: string;
  ingredient_name: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  notes: string | null;
}

interface Totales {
  pesoTotal: number;
  raciones: number | null;
  costeMateriaPrima: number;
  costeTotal: number;
  costeUnitario: number | null;
  precioMinimo: number | null;
  beneficioUnitario: number | null;
  beneficioTotal: number | null;
}

const money = (n: number | null) => (n == null ? '—' : `${n.toFixed(2)} €`);
const num = (n: number | null, decimals = 0) => (n == null ? '—' : n.toFixed(decimals));

const inputClass = 'w-full px-3 py-2 rounded-lg border border-cream-dark bg-cream text-sm focus:ring-2 focus:ring-gold focus:border-gold transition-all';
const labelClass = 'block text-xs font-medium text-ink-soft mb-1';

export default function FichaTecnicaEditor({
  recipeId,
  onClose,
  onSaved,
}: {
  recipeId: string | null; // null = nueva receta
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(!!recipeId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [currentId, setCurrentId] = useState<string | null>(recipeId);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('complemento');
  const [author, setAuthor] = useState('');
  const [allergens, setAllergens] = useState('');
  const [instructions, setInstructions] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [mermaPct, setMermaPct] = useState(20);
  const [pesoRacion, setPesoRacion] = useState<number | ''>('');
  const [pvp, setPvp] = useState<number | ''>('');

  const [lineas, setLineas] = useState<Linea[]>([]);
  const [totales, setTotales] = useState<Totales | null>(null);
  const [minPriceMultiplier, setMinPriceMultiplier] = useState(3);

  const [newIngName, setNewIngName] = useState('');
  const [newIngQty, setNewIngQty] = useState('');
  const [newIngUnit, setNewIngUnit] = useState('g');

  const applyFicha = (data: any) => {
    const r = data.recipe;
    setName(r.name || '');
    setCategory(r.category || 'complemento');
    setAuthor(r.author || '');
    setAllergens(r.allergens || '');
    setInstructions(r.instructions || '');
    setPhotoUrl(r.photo_url || '');
    setMermaPct(r.merma_pct != null ? Number(r.merma_pct) : 20);
    setPesoRacion(r.peso_racion != null ? Number(r.peso_racion) : '');
    setPvp(data.catalogItem?.pvp != null && Number(data.catalogItem.pvp) > 0 ? Number(data.catalogItem.pvp) : '');
    setLineas((data.lineas || []).map((l: any) => ({
      id: l.id,
      ingredient_name: l.ingredient_name,
      quantity: Number(l.quantity),
      unit: l.unit,
      unit_cost: Number(l.unit_cost),
      notes: l.notes,
    })));
    setTotales(data.totales || null);
    setMinPriceMultiplier(Number(data.minPriceMultiplier) || 3);
  };

  // `load` acepta un id explícito (en vez de leer `currentId` del closure) para
  // poder recargar justo después de crear la receta sin esperar a que el
  // estado se propague — antes, un useEffect ligado a `[load]` (que cambiaba
  // de identidad cada vez que `currentId` cambiaba) disparaba una recarga
  // automática en paralelo con la recarga explícita tras cada mutación; las
  // dos peticiones GET podían resolver en cualquier orden y la más reciente
  // (recién creada, sin líneas todavía) a veces pisaba a la correcta.
  const load = useCallback(async (idOverride?: string) => {
    const id = idOverride ?? currentId;
    if (!id) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cocina/recipes/${id}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al cargar la receta');
      applyFicha(data.data);
    } catch (e: any) {
      setError(e?.message || 'Error al cargar la receta');
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (recipeId) load(recipeId); else setLoading(false);
    // Solo al abrir el editor para una receta dada — no en cada cambio interno de currentId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeId]);

  // ── Crear receta (si aún no existe) ──
  const ensureCreated = async (): Promise<string | null> => {
    if (currentId) return currentId;
    if (!name.trim()) { setError('El nombre es obligatorio'); return null; }
    try {
      const res = await fetch('/api/cocina/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), category, merma_pct: mermaPct }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al crear la receta');
      setCurrentId(data.data.id);
      return data.data.id;
    } catch (e: any) {
      setError(e?.message || 'Error al crear la receta');
      return null;
    }
  };

  // ── Guardar metadatos + coste/precio (ficha completa) ──
  const handleSaveMetadata = async () => {
    setSaving(true);
    setError(null);
    try {
      const id = await ensureCreated();
      if (!id) { setSaving(false); return; }
      const res = await fetch(`/api/cocina/recipes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          category,
          author: author || null,
          allergens: allergens || null,
          instructions: instructions || null,
          photo_url: photoUrl || null,
          merma_pct: mermaPct,
          peso_racion: pesoRacion === '' ? null : Number(pesoRacion),
          pvp: pvp === '' ? undefined : Number(pvp),
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al guardar');
      setTotales(data.data.totales);
      onSaved();
    } catch (e: any) {
      setError(e?.message || 'Error al guardar');
    }
    setSaving(false);
  };

  // ── Líneas de ingrediente ──
  const handleAddIngredient = async () => {
    if (!newIngName.trim() || !newIngQty) return;
    setError(null);
    const id = await ensureCreated();
    if (!id) return;
    try {
      const res = await fetch(`/api/cocina/recipes/${id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredient_name: newIngName.trim(),
          quantity: Number(newIngQty),
          unit: newIngUnit,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al añadir el ingrediente');
      setNewIngName(''); setNewIngQty(''); setNewIngUnit('g');
      // Pasar `id` explícito: si la receta se acaba de crear en esta misma
      // llamada, `currentId` (estado) todavía no se ha propagado a este cierre.
      await load(id);
    } catch (e: any) {
      setError(e?.message || 'Error al añadir el ingrediente');
    }
  };

  const handleRemoveIngredient = async (itemId: string) => {
    if (!currentId) return;
    setError(null);
    try {
      const res = await fetch(`/api/cocina/recipes/${currentId}/items/${itemId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al quitar la línea');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Error al quitar la línea');
    }
  };

  const handleUpdateIngredientQty = async (itemId: string, quantity: number) => {
    if (!currentId || quantity <= 0) return;
    try {
      const res = await fetch(`/api/cocina/recipes/${currentId}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al actualizar la línea');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Error al actualizar la línea');
    }
  };

  const handlePhotoUpload = async (file: File) => {
    setUploadingPhoto(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload/recipe-photo', { method: 'POST', body: fd });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al subir la foto');
      setPhotoUrl(data.data.url);
    } catch (e: any) {
      setError(e?.message || 'Error al subir la foto');
    }
    setUploadingPhoto(false);
  };

  // Vista previa en vivo de la cascada de coste, mientras se editan
  // merma/peso-ración/PVP sin haber guardado aún (evita esperar al servidor
  // para ver el efecto, igual que recalcularía el propio Excel al teclear).
  const previewTotales: Totales | null = totales ? (() => {
    const costeTotal = totales.costeMateriaPrima * (1 + (Number(mermaPct) || 0) / 100);
    const pr = pesoRacion === '' ? null : Number(pesoRacion);
    const raciones = pr && pr > 0 ? Math.round((totales.pesoTotal / pr) * 100) / 100 : null;
    const costeUnitario = raciones && raciones > 0 ? Math.round((costeTotal / raciones) * 100) / 100 : null;
    const precioMinimo = costeUnitario != null ? Math.round(costeUnitario * minPriceMultiplier * 100) / 100 : null;
    const pvpNum = pvp === '' ? null : Number(pvp);
    const beneficioUnitario = pvpNum != null && costeUnitario != null ? Math.round((pvpNum - costeUnitario) * 100) / 100 : null;
    const beneficioTotal = pvpNum != null && raciones != null ? Math.round((pvpNum * raciones - costeTotal) * 100) / 100 : null;
    return {
      pesoTotal: totales.pesoTotal,
      raciones,
      costeMateriaPrima: totales.costeMateriaPrima,
      costeTotal: Math.round(costeTotal * 100) / 100,
      costeUnitario,
      precioMinimo,
      beneficioUnitario,
      beneficioTotal,
    };
  })() : null;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{currentId ? 'Ficha técnica' : 'Nueva ficha técnica'}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-sm text-ink-soft">Cargando…</div>
        ) : (
          <div className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center justify-between">
                <span>{error}</span>
                <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-3">✕</button>
              </div>
            )}

            {/* Cabecera: nombre / categoría / autor */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className={labelClass}>Receta</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Nombre del plato" />
              </div>
              <div>
                <label className={labelClass}>Autor</label>
                <input value={author} onChange={(e) => setAuthor(e.target.value)} className={inputClass} placeholder="Quién la elaboró" />
              </div>
              <div>
                <label className={labelClass}>Categoría</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
                  {CATALOG_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Columna izquierda: ingredientes + coste */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-ink mb-2">Ingredientes</h3>
                  <div className="overflow-x-auto rounded-lg border border-cream-dark">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-cream text-ink-soft text-xs uppercase tracking-wide">
                          <th className="text-left py-2 px-2">Cantidad</th>
                          <th className="text-left py-2 px-2">Medida</th>
                          <th className="text-left py-2 px-2">Ingrediente</th>
                          <th className="text-right py-2 px-2">P. unitario</th>
                          <th className="text-right py-2 px-2">P. total</th>
                          <th className="py-2 px-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineas.map((l) => (
                          <tr key={l.id} className="border-t border-cream-dark">
                            <td className="py-1.5 px-2">
                              <input
                                type="number" min={0.001} step="any" defaultValue={l.quantity}
                                onBlur={(e) => {
                                  const v = parseFloat(e.target.value);
                                  if (v && v !== l.quantity) handleUpdateIngredientQty(l.id, v);
                                }}
                                className="w-20 px-1.5 py-1 rounded border border-cream-dark bg-white text-sm"
                              />
                            </td>
                            <td className="py-1.5 px-2 text-ink-soft">{l.unit}</td>
                            <td className="py-1.5 px-2 text-ink">{l.ingredient_name}</td>
                            <td className="py-1.5 px-2 text-right text-ink-soft">{money(l.unit_cost)}</td>
                            <td className="py-1.5 px-2 text-right font-medium text-ink">{money(l.quantity * l.unit_cost)}</td>
                            <td className="py-1.5 px-2 text-right">
                              <button onClick={() => handleRemoveIngredient(l.id)} className="text-red-400 hover:text-red-600">
                                <Icon name="trash" className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {lineas.length === 0 && (
                          <tr><td colSpan={6} className="py-4 px-2 text-center text-ink-soft-60 text-xs">Sin ingredientes todavía</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <input value={newIngName} onChange={(e) => setNewIngName(e.target.value)} placeholder="Ingrediente" className={`${inputClass} flex-1`} />
                    <input value={newIngQty} onChange={(e) => setNewIngQty(e.target.value)} type="number" step="any" min={0} placeholder="Cant." className={`${inputClass} w-20`} />
                    <select value={newIngUnit} onChange={(e) => setNewIngUnit(e.target.value)} className={`${inputClass} w-20`}>
                      <option value="g">g</option>
                      <option value="kg">kg</option>
                      <option value="ml">ml</option>
                      <option value="l">l</option>
                      <option value="ud">ud</option>
                      <option value="doc">doc</option>
                    </select>
                    <Button size="sm" onClick={handleAddIngredient}>
                      <Icon name="plus" className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Peso total (calculado)</label>
                    <div className={`${inputClass} bg-cream-dark/40 text-ink-soft`}>{num(previewTotales?.pesoTotal ?? 0, 0)} g</div>
                  </div>
                  <div>
                    <label className={labelClass}>Peso objetivo por ración</label>
                    <input
                      type="number" min={1} step="any" value={pesoRacion}
                      onChange={(e) => setPesoRacion(e.target.value === '' ? '' : Number(e.target.value))}
                      className={inputClass} placeholder="g por comensal"
                    />
                  </div>
                </div>
                <p className="text-xs text-ink-soft-60">
                  Raciones derivadas: <b>{num(previewTotales?.raciones ?? null, previewTotales?.raciones && previewTotales.raciones % 1 !== 0 ? 2 : 0)}</b>
                </p>
              </div>

              {/* Columna derecha: elaboración / alérgenos / foto */}
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Elaboración</label>
                  <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={6} className={inputClass} placeholder="Pasos de preparación…" />
                </div>
                <div>
                  <label className={labelClass}>Alérgenos</label>
                  <textarea value={allergens} onChange={(e) => setAllergens(e.target.value)} rows={2} className={inputClass} placeholder="Gluten, lácteos, frutos secos…" />
                </div>
                <div>
                  <label className={labelClass}>Foto</label>
                  {photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoUrl} alt={name} className="w-full h-32 object-cover rounded-lg mb-2 border border-cream-dark" />
                  )}
                  <input
                    type="file" accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])}
                    disabled={uploadingPhoto}
                    className="text-xs text-ink-soft"
                  />
                </div>
              </div>
            </div>

            {/* Cascada de coste y precio */}
            <div className="rounded-xl border border-cream-dark bg-cream p-4 space-y-2">
              <h3 className="text-sm font-semibold text-ink mb-1">Coste y precio</h3>
              <div className="grid md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                <div className="flex justify-between"><span className="text-ink-soft">Coste total materia prima</span><span className="font-medium text-ink tabular-nums">{money(previewTotales?.costeMateriaPrima ?? 0)}</span></div>
                <div className="flex justify-between items-center">
                  <span className="text-ink-soft">Merma y costes adicionales</span>
                  <input type="number" min={0} max={99} step="any" value={mermaPct} onChange={(e) => setMermaPct(Number(e.target.value) || 0)} className="w-20 px-2 py-1 rounded border border-cream-dark bg-white text-sm text-right tabular-nums" />
                </div>
                <div className="flex justify-between"><span className="text-ink-soft">Coste total</span><span className="font-semibold text-ink tabular-nums">{money(previewTotales?.costeTotal ?? 0)}</span></div>
                <div className="flex justify-between"><span className="text-ink-soft">Coste unitario (por ración)</span><span className="font-semibold text-ink tabular-nums">{money(previewTotales?.costeUnitario ?? null)}</span></div>
                <div className="flex justify-between"><span className="text-ink-soft">Precio mínimo de venta (×{minPriceMultiplier})</span><span className="font-medium text-ink tabular-nums">{money(previewTotales?.precioMinimo ?? null)}</span></div>
                <div className="flex justify-between items-center">
                  <span className="text-ink-soft">Precio venta al público final</span>
                  <input type="number" min={0} step="any" value={pvp} onChange={(e) => setPvp(e.target.value === '' ? '' : Number(e.target.value))} className="w-24 px-2 py-1 rounded border border-cream-dark bg-white text-sm text-right tabular-nums" placeholder="—" />
                </div>
                <div className="flex justify-between"><span className="text-ink-soft">Beneficio unitario</span><span className="font-medium text-ink tabular-nums">{money(previewTotales?.beneficioUnitario ?? null)}</span></div>
                <div className="flex justify-between"><span className="text-ink-soft">Beneficio total</span><span className="font-medium text-ink tabular-nums">{money(previewTotales?.beneficioTotal ?? null)}</span></div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={handleSaveMetadata} disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar ficha técnica'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
