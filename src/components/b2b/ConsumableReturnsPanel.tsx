'use client';
/**
 * EventFlow — WP-09: Panel de Retorno de Consumibles
 * 
 * Sección dentro de Logística que permite:
 * 1. Ver el resumen de consumo del evento
 * 2. Registrar retornos de ingredientes no consumidos
 * 3. Cerrar la vuelta y calcular mermas
 */

import { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/shared/Icon';
import { formatDate } from '@/lib/format';

// ── Types ──────────────────────────────────────────────────────

interface ConsumptionItem {
  ingredientId: string;
  ingredientName: string;
  consumed: number;
  returned: number;
  waste: number;
  unit: string;
}

interface ConsumptionSummary {
  eventId: string;
  totalConsumed: number;
  totalReturned: number;
  totalWaste: number;
  items: ConsumptionItem[];
}

interface ReturnRecord {
  id: string;
  ingredient_id: string;
  ingredient_name: string;
  quantity_returned: number;
  unit: string;
  notes: string | null;
  created_at: string;
}

interface IngredientOption {
  id: string;
  name: string;
  unit: string;
  quantity: number;
}

// ── Component ──────────────────────────────────────────────────

export default function ConsumableReturnsPanel({ eventId }: { eventId: string }) {
  const [summary, setSummary] = useState<ConsumptionSummary | null>(null);
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [ingredients, setIngredients] = useState<IngredientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [newReturn, setNewReturn] = useState({
    ingredient_id: '',
    quantity_returned: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── Data fetching ──────────────────────────────────────────────

  const fetchSummary = useCallback(async () => {
    if (!eventId) return;
    try {
      const res = await fetch(`/api/shopping/returns?action=summary&event_id=${eventId}`);
      const data = await res.json();
      if (data.success) setSummary(data.data);
    } catch { /* ignore */ }
  }, [eventId]);

  const fetchReturns = useCallback(async () => {
    if (!eventId) return;
    try {
      const res = await fetch(`/api/shopping/returns?event_id=${eventId}`);
      const data = await res.json();
      if (data.success) setReturns(data.data || []);
    } catch { /* ignore */ }
  }, [eventId]);

  const fetchIngredients = useCallback(async () => {
    try {
      const res = await fetch('/api/stock');
      const data = await res.json();
      if (data.success) setIngredients(data.data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchSummary(), fetchReturns(), fetchIngredients()]);
      setLoading(false);
    };
    loadAll();
  }, [fetchSummary, fetchReturns, fetchIngredients]);

  // ── Actions ───────────────────────────────────────────────────

  const handleReturn = async () => {
    if (!newReturn.ingredient_id || !newReturn.quantity_returned) return;
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/shopping/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          ingredient_id: newReturn.ingredient_id,
          quantity_returned: Number(newReturn.quantity_returned),
          notes: newReturn.notes || null,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setMessage({ type: 'success', text: data.message || 'Retorno registrado' });
        setNewReturn({ ingredient_id: '', quantity_returned: '', notes: '' });
        setShowReturnForm(false);
        await Promise.all([fetchSummary(), fetchReturns()]);
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al registrar retorno' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Error de conexión' });
    } finally {
      setSaving(false);
    }
  };

  const handleCloseReturn = async () => {
    if (!confirm('¿Cerrar la vuelta? Se calcularán las mermas por ingrediente.')) return;
    
    setClosing(true);
    setMessage(null);

    try {
      const res = await fetch('/api/shopping/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'close',
          event_id: eventId,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setMessage({ 
          type: 'success', 
          text: data.message || `Vuelta cerrada. Merma total: ${data.data?.totalWaste || 0}` 
        });
        await Promise.all([fetchSummary(), fetchReturns()]);
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al cerrar vuelta' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Error de conexión' });
    } finally {
      setClosing(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-4 text-center text-sm text-ink-soft-60">
        <Icon name="spinner" className="w-4 h-4 animate-spin inline mr-2" />
        Cargando datos de consumo...
      </div>
    );
  }

  if (!summary || summary.items.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-ink-soft-60 bg-cream-dark rounded-xl">
        <Icon name="package" className="w-6 h-6 mx-auto mb-2 opacity-50" />
        No hay datos de consumo para este evento.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
          <Icon name="package" className="w-4 h-4 text-gold" />
          Retorno de Consumibles
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => setShowReturnForm(!showReturnForm)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-cream-dark hover:border-gold transition-colors"
          >
            <Icon name="plus" className="w-3 h-3 inline mr-1" />
            Añadir retorno
          </button>
          <button
            onClick={handleCloseReturn}
            disabled={closing}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gold text-ink hover:bg-gold-dark disabled:opacity-50 transition-colors"
          >
            {closing ? (
              <>
                <Icon name="spinner" className="w-3 h-3 inline mr-1 animate-spin" />
                Cerrando...
              </>
            ) : (
              <>
                <Icon name="check" className="w-3 h-3 inline mr-1" />
                Cerrar vuelta
              </>
            )}
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-3 rounded-lg text-sm ${
          message.type === 'success' 
            ? 'bg-success/10 text-success border border-success/20' 
            : 'bg-danger/10 text-danger border border-danger/20'
        }`}>
          {message.text}
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-cream border border-cream-dark text-center">
          <p className="text-lg font-semibold text-ink">{summary.totalConsumed}</p>
          <p className="text-[11px] text-ink-soft-60">Consumido</p>
        </div>
        <div className="p-3 rounded-lg bg-cream border border-cream-dark text-center">
          <p className="text-lg font-semibold text-success">{summary.totalReturned}</p>
          <p className="text-[11px] text-ink-soft-60">Retornado</p>
        </div>
        <div className="p-3 rounded-lg bg-cream border border-cream-dark text-center">
          <p className="text-lg font-semibold text-danger">{summary.totalWaste}</p>
          <p className="text-[11px] text-ink-soft-60">Merma</p>
        </div>
      </div>

      {/* Return form */}
      {showReturnForm && (
        <div className="p-4 rounded-xl bg-white border border-cream-dark space-y-3">
          <h4 className="text-xs font-semibold text-ink uppercase tracking-wider">Registrar retorno</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-ink-soft-60 font-medium">Ingrediente</label>
              <select
                value={newReturn.ingredient_id}
                onChange={(e) => setNewReturn(r => ({ ...r, ingredient_id: e.target.value }))}
                className="w-full text-sm border border-cream-dark rounded-lg px-2.5 py-1.5 mt-0.5 focus:outline-none focus:border-gold"
              >
                <option value="">Seleccionar...</option>
                {ingredients.map(i => (
                  <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-ink-soft-60 font-medium">Cantidad devuelta</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={newReturn.quantity_returned}
                onChange={(e) => setNewReturn(r => ({ ...r, quantity_returned: e.target.value }))}
                className="w-full text-sm border border-cream-dark rounded-lg px-2.5 py-1.5 mt-0.5 focus:outline-none focus:border-gold"
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-ink-soft-60 font-medium">Notas (opcional)</label>
            <input
              type="text"
              value={newReturn.notes}
              onChange={(e) => setNewReturn(r => ({ ...r, notes: e.target.value }))}
              className="w-full text-sm border border-cream-dark rounded-lg px-2.5 py-1.5 mt-0.5 focus:outline-none focus:border-gold"
              placeholder="Motivo del retorno..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowReturnForm(false)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-cream-dark hover:border-ink-soft transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleReturn}
              disabled={saving || !newReturn.ingredient_id || !newReturn.quantity_returned}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gold text-ink hover:bg-gold-dark disabled:opacity-50 transition-colors"
            >
              {saving ? 'Guardando...' : 'Registrar'}
            </button>
          </div>
        </div>
      )}

      {/* Consumption details table */}
      <div className="overflow-x-auto rounded-xl border border-cream-dark bg-white">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-cream-dark bg-cream">
              <th className="text-left py-2 px-3 font-semibold text-ink-soft uppercase tracking-wider">Ingrediente</th>
              <th className="text-right py-2 px-3 font-semibold text-ink-soft uppercase tracking-wider">Consumido</th>
              <th className="text-right py-2 px-3 font-semibold text-ink-soft uppercase tracking-wider">Retornado</th>
              <th className="text-right py-2 px-3 font-semibold text-ink-soft uppercase tracking-wider">Merma</th>
            </tr>
          </thead>
          <tbody>
            {summary.items.map((item) => (
              <tr key={item.ingredientId} className="border-b border-cream-dark/50 last:border-0 hover:bg-cream-dark/30">
                <td className="py-2 px-3 font-medium text-ink">{item.ingredientName}</td>
                <td className="py-2 px-3 text-right text-ink-soft-60">{item.consumed} {item.unit}</td>
                <td className="py-2 px-3 text-right text-success">{item.returned} {item.unit}</td>
                <td className="py-2 px-3 text-right text-danger">{item.waste} {item.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Return history */}
      {returns.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Historial de retornos</h4>
          <div className="space-y-1">
            {returns.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-2 rounded-lg bg-cream-dark/50 text-xs">
                <div>
                  <span className="font-medium text-ink">{r.ingredient_name}</span>
                  <span className="text-ink-soft-60 ml-2">
                    {formatDate(r.created_at)}
                  </span>
                </div>
                <span className="font-medium text-success">+{r.quantity_returned} {r.unit}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
