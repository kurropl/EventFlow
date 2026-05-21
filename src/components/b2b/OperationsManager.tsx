'use client';
/**
 * EventFlow — Operations Manager (B2B)
 * ERP de gestión del salón de celebraciones
 */

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import TableMapEditor from './TableMapEditor';

interface SelectedItem {
  name: string;
  category: string;
  quantity: number;
  unit_price_pvp: number;
  unit_price_cost: number;
}

interface OperationEvent {
  id: string;
  client_name: string;
  guest_count: number;
  kids_count: number;
  event_date: string;
  selected_items: SelectedItem[];
  total_pvp: number;
  total_cost: number;
  bar_hours: number;
}

const MOCK_EVENT: OperationEvent = {
  id: 'evt-1',
  client_name: 'María García',
  guest_count: 150,
  kids_count: 10,
  event_date: '2025-09-15',
  selected_items: [
    { name: 'Carrillera a baja temperatura', category: 'carne', quantity: 150, unit_price_pvp: 12, unit_price_cost: 4.50 },
    { name: 'Merluza gratinada', category: 'pescado', quantity: 150, unit_price_pvp: 11, unit_price_cost: 4.00 },
    { name: 'Arroz meloso de mariscos', category: 'arroz', quantity: 150, unit_price_pvp: 10, unit_price_cost: 3.80 },
    { name: 'Sorbete de limón', category: 'sorbete', quantity: 150, unit_price_pvp: 3, unit_price_cost: 0.80 },
    { name: 'Tarta de celebración', category: 'postre', quantity: 150, unit_price_pvp: 4, unit_price_cost: 1.20 },
    { name: 'Gorditas del sur', category: 'aperitivo-frio', quantity: 150, unit_price_pvp: 3.50, unit_price_cost: 1.20 },
    { name: 'Choco frito', category: 'aperitivo-caliente', quantity: 150, unit_price_pvp: 5, unit_price_cost: 1.80 },
    { name: 'Cava brindis', category: 'bebida', quantity: 150, unit_price_pvp: 2.50, unit_price_cost: 0.90 },
  ],
  total_pvp: 4875,
  total_cost: 1800,
  bar_hours: 3,
};

function calculateOperations(guestCount: number, kidsCount: number, items: SelectedItem[]) {
  const totalPax = guestCount + kidsCount;
  const waiters = Math.ceil(guestCount / 15);
  const adultTables = Math.ceil(guestCount / 4);
  const kidsTables = kidsCount > 0 ? Math.ceil(kidsCount / 2) : 0;
  const totalTables = adultTables + kidsTables;
  const metres = totalTables;

  const purchaseOrder = items.map((item) => ({
    name: item.name,
    baseQty: item.quantity,
    withMargin: Math.ceil(item.quantity * 1.10),
    margin: Math.ceil(item.quantity * 0.10),
  }));

  return { totalPax, waiters, totalTables, adultTables, kidsTables, metres, purchaseOrder };
}

export default function OperationsManager() {
  const [selectedEvent, setSelectedEvent] = useState<OperationEvent | null>(MOCK_EVENT);
  const [activeTab, setActiveTab] = useState<'overview' | 'tables' | 'purchase'>('overview');
  
  const handleSavePlan = useCallback((data: { tables: any[]; elements: any[] }) => {
    console.log('Plano guardado:', data);
    // Here you'd sync to Supabase
  }, []);

  if (!selectedEvent) {
    return (
      <div className="text-center py-20 text-cream/30">
        <p className="text-lg mb-4">No hay eventos seleccionados</p>
        <p className="text-sm">Selecciona un evento del pipeline para ver las operaciones.</p>
      </div>
    );
  }

  const ops = calculateOperations(selectedEvent.guest_count, selectedEvent.kids_count, selectedEvent.selected_items);
  const profit = selectedEvent.total_pvp - selectedEvent.total_cost;
  const marginPct = Math.round((profit / selectedEvent.total_pvp) * 100);

  return (
    <div className="space-y-6">
      {/* Event header */}
      <div className="bg-ink-900/40 rounded-xl border border-gold/10 p-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h3 className="text-cream text-xl font-serif">{selectedEvent.client_name}</h3>
            <p className="text-cream/40 text-sm">
              {selectedEvent.event_date} · {selectedEvent.guest_count} adultos + {selectedEvent.kids_count} niños
            </p>
          </div>
          <div className="flex gap-4">
            <div className="text-right">
              <div className="text-xs text-cream/40 uppercase tracking-wider">Margen Neto</div>
              <div className={`text-2xl font-bold ${marginPct >= 30 ? 'text-green-400' : marginPct >= 15 ? 'text-gold' : 'text-red-400'}`}>
                {marginPct}%
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-cream/40 uppercase tracking-wider">Beneficio</div>
              <div className="text-2xl font-bold text-gold">{profit.toFixed(2)}€</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-ink-900/40 rounded-lg p-1">
        {(['overview', 'tables', 'purchase'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-all
              ${activeTab === tab ? 'bg-gold/15 text-gold' : 'text-cream/40 hover:text-cream/70'}`}
          >
            {tab === 'overview' ? 'Resumen' : tab === 'tables' ? 'Mapa de Mesas' : 'Escandallo'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Staff & tables cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-ink-900/40 rounded-xl border border-gold/10 p-4 text-center">
              <div className="text-2xl font-bold text-cream mb-1">{ops.waiters}</div>
              <div className="text-xs text-cream/40">Camareros</div>
              <div className="text-[10px] text-cream/30">1 por cada 15 pax</div>
            </div>
            <div className="bg-ink-900/40 rounded-xl border border-gold/10 p-4 text-center">
              <div className="text-2xl font-bold text-cream mb-1">{ops.totalTables}</div>
              <div className="text-xs text-cream/40">Mesas</div>
              <div className="text-[10px] text-cream/30">{ops.adultTables} adult. + {ops.kidsTables} niños</div>
            </div>
            <div className="bg-ink-900/40 rounded-xl border border-gold/10 p-4 text-center">
              <div className="text-2xl font-bold text-cream mb-1">{selectedEvent.bar_hours}h</div>
              <div className="text-xs text-cream/40">Barra Libre</div>
            </div>
            <div className="bg-ink-900/40 rounded-xl border border-gold/10 p-4 text-center">
              <div className="text-2xl font-bold text-cream mb-1">{ops.metres}</div>
              <div className="text-xs text-cream/40">Metres</div>
              <div className="text-[10px] text-cream/30">1 por conjunto</div>
            </div>
          </div>

          {/* Financial breakdown */}
          <div className="bg-ink-900/40 rounded-xl border border-gold/10 p-4">
            <h4 className="text-cream font-medium text-sm mb-3">Desglose Financiero</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-cream/60">
                <span>Ingresos (PVP)</span>
                <span className="text-cream">{selectedEvent.total_pvp.toFixed(2)}€</span>
              </div>
              <div className="flex justify-between text-cream/60">
                <span>Costes internos</span>
                <span className="text-red-400">-{selectedEvent.total_cost.toFixed(2)}€</span>
              </div>
              <div className="border-t border-gold/10 pt-2 flex justify-between font-medium">
                <span className="text-cream">Beneficio Neto</span>
                <span className="text-green-400">{profit.toFixed(2)}€</span>
              </div>
              <div className="flex justify-between text-cream/40 text-xs">
                <span>Margen de beneficio</span>
                <span>{marginPct}%</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'tables' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-ink-900/40 rounded-xl border border-gold/10 overflow-hidden" style={{ height: 'calc(100vh - 320px)', minHeight: 500 }}>
          <TableMapEditor 
            eventName={`${selectedEvent.client_name} — ${selectedEvent.event_date}`}
            eventId={selectedEvent.id}
            onSave={handleSavePlan}
          />
        </motion.div>
      )}

      {activeTab === 'purchase' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="bg-ink-900/40 rounded-xl border border-gold/10 overflow-hidden">
            <div className="p-4 border-b border-gold/10">
              <h4 className="text-cream font-medium text-sm">Escandallo de Compras (+10% margen)</h4>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gold/5">
                  <th className="text-left px-4 py-2 text-cream/40 text-xs">Artículo</th>
                  <th className="text-right px-4 py-2 text-cream/40 text-xs">Base</th>
                  <th className="text-right px-4 py-2 text-gold/60 text-xs">+10%</th>
                  <th className="text-right px-4 py-2 text-cream/30 text-xs">Margen</th>
                </tr>
              </thead>
              <tbody>
                {ops.purchaseOrder.map((item, i) => (
                  <tr key={i} className="border-b border-gold/5">
                    <td className="px-4 py-2 text-cream">{item.name}</td>
                    <td className="px-4 py-2 text-right text-cream/60">{item.baseQty}</td>
                    <td className="px-4 py-2 text-right text-gold">{item.withMargin}</td>
                    <td className="px-4 py-2 text-right text-cream/30">+{item.margin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
}