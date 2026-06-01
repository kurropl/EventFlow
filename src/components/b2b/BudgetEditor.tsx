'use client';
/**
 * EventFlow — BudgetEditor
 * Panel lateral para editar presupuestos desde el pipeline Kanban.
 * Permite ajustar platos, cantidades, añadir/eliminar items
 * y enviar el presupuesto al cliente.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CATEGORY_LABELS: Record<string, string> = {
  'aperitivo-frio': 'Aperitivos Fríos',
  'aperitivo-caliente': 'Aperitivos Calientes',
  'compartir-mesa': 'Para Compartir',
  'carne': 'Carne',
  'pescado': 'Pescado',
  'arroz': 'Arroz',
  'sorbete': 'Sorbete',
  'postre': 'Postre',
  'bebida': 'Bebida',
  'complemento': 'Complementos',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  boda: 'Boda', 'cumpleaños': 'Cumpleaños', corporativo: 'Corporativo',
  bautizo: 'Bautizo', 'comunión': 'Comunión', otro: 'Otro',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador', sent: 'Enviado', accepted: 'Aceptado',
  in_progress: 'En curso', completed: 'Completado', paid: 'Pagado', cancelled: 'Cancelado',
};

const money = (n: number | string) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n) || 0);

interface SelectedItem {
  item_id: string;
  name: string;
  category: string;
  quantity: number;
  unit_price_pvp: number;
  unit_price_cost: number;
}

interface BudgetEvent {
  id: string;
  client_name: string;
  client_email: string;
  event_type: string;
  guest_count: number;
  kids_count: number;
  event_date: string;
  status: string;
  selected_items: SelectedItem[];
  bar_hours: number;
  notes: string | null;
  total_pvp: number | string;
  total_cost: number | string;
}

interface Props {
  event: BudgetEvent | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function BudgetEditor({ event, onClose, onSaved }: Props) {
  const [items, setItems] = useState<SelectedItem[]>([]);
  const [barHours, setBarHours] = useState(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [catalog, setCatalog] = useState<Record<string, any[]>>({});
  const [addCat, setAddCat] = useState<string>('');
  const [addItemName, setAddItemName] = useState<string>('');
  const [addQty, setAddQty] = useState(1);
  const [msg, setMsg] = useState('');

  // Load catalog on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/catalog');
        const data = await res.json();
        if (data.success) setCatalog(data.data || {});
      } catch { /* ignore */ }
    })();
  }, []);

  // Init from event
  useEffect(() => {
    if (event) {
      setItems(event.selected_items || []);
      setBarHours(event.bar_hours || 0);
      setNotes(event.notes || '');
    }
  }, [event?.id]);

  // Calculate totals
  const calcTotals = () => {
    let pvp = 0;
    let cost = 0;
    // Flatten catalog
    const allItems: any[] = [];
    for (const key of Object.keys(catalog)) {
      if (Array.isArray(catalog[key])) {
        for (const ci of catalog[key]) allItems.push(ci);
      }
    }
    const nameLookup = new Map<string, any>();
    for (const ci of allItems) {
      nameLookup.set(ci.name.toLowerCase().trim(), ci);
    }
    for (const item of items) {
      const key = (item.name || '').toLowerCase().trim();
      const catItem = nameLookup.get(key);
      if (catItem && catItem.pvp) {
        const qty = Number(item.quantity) || 1;
        pvp += Number(catItem.pvp) * qty;
        cost += (Number(catItem.cost) || 0) * qty;
      }
    }
    return { pvp, cost };
  };

  const totals = calcTotals();

  const addItem = () => {
    if (!addCat || !addItemName) return;
    setItems(prev => [
      ...prev,
      {
        item_id: addItemName,
        name: addItemName,
        category: addCat,
        quantity: addQty,
        unit_price_pvp: 0,
        unit_price_cost: 0,
      },
    ]);
    setAddItemName('');
    setAddQty(1);
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateQty = (idx: number, qty: number) => {
    if (qty < 1) qty = 1;
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, quantity: qty } : item));
  };

  const save = async (newStatus?: string) => {
    if (!event) return;
    setSaving(true);
    setMsg('');
    try {
      const body: any = {
        selected_items: items,
        bar_hours: barHours,
        notes: notes || null,
      };
      if (newStatus) body.status = newStatus;
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) {
        setMsg('Error: ' + (data.error || 'desconocido'));
        return;
      }
      setMsg(newStatus === 'sent' ? '✓ Presupuesto enviado al cliente' : '✓ Cambios guardados');
      onSaved();
      setTimeout(() => onClose(), 1200);
    } catch (e: any) {
      setMsg('Error de red: ' + (e.message || ''));
    } finally {
      setSaving(false);
    }
  };

  if (!event) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="absolute right-0 top-0 h-full w-full max-w-[520px] bg-white shadow-2xl overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-white border-b border-[#ECECF1] px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="font-serif text-lg text-[#1A1A1A]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                Editar presupuesto
              </h2>
              <p className="text-[12px] text-[#6B7280]">{event.client_name}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg text-[#9CA3AF] hover:bg-[#F5F5F8] hover:text-[#374151]">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M6 6l12 12M18 6l-12 12" />
              </svg>
            </button>
          </div>

          <div className="px-6 py-5 space-y-5">

            {/* Event info */}
            <div className="grid grid-cols-2 gap-3 text-[12px]">
              <div className="bg-[#FAFAFC] rounded-xl p-3">
                <span className="text-[#9CA3AF] block">Cliente</span>
                <span className="font-semibold text-[#1A1A1A]">{event.client_name}</span>
                <span className="text-[#6B7280] block truncate">{event.client_email}</span>
              </div>
              <div className="bg-[#FAFAFC] rounded-xl p-3">
                <span className="text-[#9CA3AF] block">Tipo</span>
                <span className="font-semibold text-[#1A1A1A]">{EVENT_TYPE_LABELS[event.event_type] || event.event_type}</span>
                <span className="text-[#6B7280] block">{STATUS_LABELS[event.status] || event.status}</span>
              </div>
              <div className="bg-[#FAFAFC] rounded-xl p-3">
                <span className="text-[#9CA3AF] block">Fecha</span>
                <span className="font-semibold text-[#1A1A1A]">{event.event_date?.slice(0, 10)}</span>
              </div>
              <div className="bg-[#FAFAFC] rounded-xl p-3">
                <span className="text-[#9CA3AF] block">Comensales</span>
                <span className="font-semibold text-[#1A1A1A]">{event.guest_count} adultos{event.kids_count > 0 ? ` + ${event.kids_count} niños` : ''}</span>
              </div>
            </div>

            {/* Selected items */}
            <div>
              <h3 className="text-[13px] font-semibold text-[#1A1A1A] mb-2">Platos seleccionados ({items.length})</h3>
              {items.length === 0 && (
                <p className="text-[12px] text-[#9CA3AF] py-4 text-center">Sin platos seleccionados. Añade desde el catálogo.</p>
              )}
              <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
                {items.map((item, idx) => {
                  const catItems = catalog[item.category] || [];
                  const catItem = catItems.find((c: any) => c.name === item.name);
                  const unitPvp = Number(catItem?.pvp || 0);
                  const subtotal = unitPvp * (Number(item.quantity) || 1);
                  const catLabel = CATEGORY_LABELS[item.category] || item.category;
                  return (
                    <div key={idx} className="flex items-center gap-2 bg-[#FAFAFC] rounded-xl px-3 py-2.5 text-[12px] group hover:bg-[#F3F3F7] transition-colors">
                      <button onClick={() => removeItem(idx)} className="text-[#C7C7CF] hover:text-[#DC2626] flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path d="M6 6l12 12M18 6l-12 12" />
                        </svg>
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-[#1A1A1A] truncate">{item.name}</div>
                        <div className="text-[10px] text-[#9CA3AF]">{catLabel}</div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={() => updateQty(idx, Number(item.quantity) - 1)} className="w-6 h-6 rounded-lg border border-[#E5E7EB] flex items-center justify-center text-[#6B7280] hover:bg-white text-[13px] font-medium">−</button>
                        <span className="w-8 text-center text-[13px] font-semibold tabular-nums">{item.quantity}</span>
                        <button onClick={() => updateQty(idx, Number(item.quantity) + 1)} className="w-6 h-6 rounded-lg border border-[#E5E7EB] flex items-center justify-center text-[#6B7280] hover:bg-white text-[13px] font-medium">+</button>
                      </div>
                      <span className="text-[12px] font-medium text-[#1A1A1A] w-[70px] text-right tabular-nums">
                        {unitPvp > 0 ? money(subtotal) : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Add item from catalog */}
            <div className="bg-[#FAFAFC] rounded-xl p-3.5">
              <h4 className="text-[12px] font-semibold text-[#1A1A1A] mb-2">Añadir plato del catálogo</h4>
              <div className="flex gap-2">
                <select value={addCat} onChange={(e) => { setAddCat(e.target.value); setAddItemName(''); }}
                  className="flex-1 text-[12px] border border-[#E5E7EB] rounded-lg px-2 py-1.5 bg-white">
                  <option value="">Categoría…</option>
                  {Object.keys(catalog).map((cat) => (
                    <option key={cat} value={cat}>{CATEGORY_LABELS[cat] || cat}</option>
                  ))}
                </select>
                <select value={addQty} onChange={(e) => setAddQty(Number(e.target.value))}
                  className="w-16 text-[12px] border border-[#E5E7EB] rounded-lg px-2 py-1.5 bg-white">
                  {[1, 2, 5, 10, 25, 50, 100, 150, 200].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              {addCat && (
                <select value={addItemName} onChange={(e) => setAddItemName(e.target.value)}
                  className="w-full mt-2 text-[12px] border border-[#E5E7EB] rounded-lg px-2 py-1.5 bg-white">
                  <option value="">Selecciona plato…</option>
                  {(catalog[addCat] || []).map((ci: any) => (
                    <option key={ci.id} value={ci.name}>
                      {ci.name} {ci.pvp > 0 ? `(${money(ci.pvp)}/ud)` : ''}
                    </option>
                  ))}
                </select>
              )}
              <button onClick={addItem} disabled={!addCat || !addItemName || saving}
                className="mt-2 w-full text-[12px] font-medium bg-[#1A1A2E] text-white py-1.5 rounded-lg hover:bg-[#2D2D4A] disabled:opacity-40 transition-colors">
                + Añadir plato
              </button>
            </div>

            {/* Bar hours */}
            <div className="flex items-center gap-3">
              <span className="text-[13px] font-medium text-[#1A1A1A]">Barra:</span>
              <div className="flex gap-1.5">
                {[0, 1, 2, 3].map((h) => (
                  <button key={h} onClick={() => setBarHours(h)}
                    className={`text-[12px] px-3 py-1.5 rounded-lg transition-colors ${barHours === h ? 'bg-[#1A1A2E] text-white' : 'border border-[#E5E7EB] hover:bg-[#F3F4F6]'}`}>
                    {h === 0 ? 'Sin' : `${h}h`}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-[13px] font-medium text-[#1A1A1A] mb-1">Notas</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                className="w-full text-[13px] border border-[#E5E7EB] rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-[#C9A84C]"
                rows={2} placeholder="Notas internas…" />
            </div>

            {/* Total */}
            <div className="bg-[#FBF6E9] rounded-xl p-4 border border-[#EFE3BE]">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[13px] text-[#6B7280]">Total PVP calculado</span>
                <span className="text-xl font-bold text-[#1A1A1A]">{money(totals.pvp)}</span>
              </div>
              <div className="flex justify-between items-center text-[12px]">
                <span className="text-[#9CA3AF]">Coste estimado</span>
                <span className="text-[#6B7280]">{money(totals.cost)}</span>
              </div>
              {totals.pvp - totals.cost > 0 && (
                <div className="flex justify-between items-center text-[12px] mt-0.5">
                  <span className="text-[#9CA3AF]">Margen</span>
                  <span className="text-[#16A34A] font-medium">
                    {money(totals.pvp - totals.cost)} ({Math.round(((totals.pvp - totals.cost) / totals.pvp) * 100)}%)
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}

            <div className="flex gap-2">
              <button onClick={onClose}
                className="flex-1 text-[13px] font-medium border border-[#E5E7EB] text-[#6B7280] py-2.5 rounded-xl hover:bg-[#F5F5F8] transition-colors">
                Cancelar
              </button>
              <button onClick={() => save()} disabled={saving}
                className="flex-1 text-[13px] font-medium bg-[#1A1A2E] text-white py-2.5 rounded-xl hover:bg-[#2D2D4A] disabled:opacity-50 transition-colors">
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
              {event.status === 'draft' && (
                <button onClick={() => save('sent')} disabled={saving || items.length === 0}
                  className="text-[13px] font-medium text-white py-2.5 rounded-xl px-5 disabled:opacity-50 transition-all"
                  style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>
                  {saving ? '…' : 'Enviar presupuesto →'}
                </button>
              )}
            </div>

            {msg && (
              <div className={`text-center text-[13px] font-medium py-2 rounded-xl ${msg.startsWith('✓') ? 'bg-[#EFFAF2] text-[#16A34A]' : 'bg-[#FEF3F3] text-[#DC2626]'}`}>
                {msg}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}