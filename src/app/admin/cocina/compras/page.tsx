'use client';

import { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/shared/Icon';
import { KpiCard, SectionCard, Badge, Empty } from '@/components/shared/CocinaUI';
import { formatEUR, formatDate } from '@/lib/format';

interface OrderItem {
  id: string;
  order_id: string;
  ingredient_id: string | null;
  ingredient_name: string;
  quantity: number;
  unit_cost: number;
  unit: string;
}

interface SupplierOrder {
  id: string;
  supplier: string;
  notes: string | null;
  status: string;
  expected_date: string | null;
  created_at: string;
  total_cost: number | null;
  item_count: number;
  computed_total: number;
  items?: OrderItem[];
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  ordered: 'Pedida',
  delivered: 'Entregada',
  received: 'Recibida',
  cancelled: 'Cancelada',
};

const fmtEUR = formatEUR;

export default function ComprasPage() {
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stock/supplier-orders', { credentials: 'include' });
      const d = await res.json();
      if (d.success) {
        const withItems = await Promise.all(
          (d.data || []).map(async (o: SupplierOrder) => {
            const r = await fetch(`/api/stock/supplier-orders?order_id=${o.id}`, { credentials: 'include' });
            const j = await r.json();
            return { ...o, items: j.success ? j.data : [] };
          })
        );
        setOrders(withItems);
      } else setError(d.error || 'Error al cargar');
    } catch {
      setError('Error de red');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Flujo HITL de transiciones (worker D, reconstruido tras conflicto multi-agente) ──
  const [transitioningId, setTransitioningId] = useState<string | null>(null);
  const transitionOrder = async (orderId: string, accion: string) => {
    setTransitioningId(orderId);
    try {
      const res = await fetch(`/api/stock/supplier-orders/${orderId}/transitions`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ accion }),
      });
      const d = await res.json();
      if (!d.success) { setError(d.error || 'Error en la transición'); } else { setError(null); }
      load();
    } catch { setError('Error de red'); }
    setTransitioningId(null);
  };

  const totalPending = orders.filter(o => o.status === 'pending' || o.status === 'ordered').length;
  const totalReceived = orders.filter(o => o.status === 'received').length;
  const totalValue = orders.reduce((s, o) => s + Number(o.total_cost || o.computed_total || 0), 0);
  const filtered = filter ? orders.filter(o => o.supplier.toLowerCase().includes(filter.toLowerCase()) || (o.notes || '').toLowerCase().includes(filter.toLowerCase())) : orders;

  return (
    <div className="space-y-3">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <KpiCard icon="truck" label="Órdenes de compra" value={String(orders.length)} />
        <KpiCard icon="clock" label="Pendientes" value={String(totalPending)} />
        <KpiCard icon="checkCircle" label="Recibidas" value={String(totalReceived)} />
        <KpiCard icon="banknote" label="Valor total" value={fmtEUR(totalValue)} />
      </div>

      <SectionCard title="Órdenes de compra" icon="truck">
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1 max-w-xs">
            <Icon name="search" className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft/50" />
            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Buscar por proveedor…"
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-divider/60 bg-white focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </div>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-14 bg-cream rounded-lg" />)}
          </div>
        ) : error ? (
          <Empty icon="alertCircle" title="Error" sub={error} />
        ) : filtered.length === 0 ? (
          <Empty icon="truck" title="Sin órdenes" sub="Crea una orden de compra desde Inventario → Pedidos" />
        ) : (
          <div className="space-y-2">
            {filtered.map(o => (
              <div key={o.id} className="bg-white border border-divider/50 rounded-lg p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-gold/10 flex items-center justify-center flex-shrink-0">
                      <Icon name="truck" className="w-3.5 h-3.5 text-gold" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-ink truncate">{o.supplier}</div>
                      <div className="text-[10px] text-ink-soft">
                        {o.item_count} línea{o.item_count !== 1 ? 's' : ''} · {formatDate(o.created_at)}
                        {o.expected_date && ` · entrega ${formatDate(o.expected_date)}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-bold text-ink">{fmtEUR(Number(o.total_cost || o.computed_total || 0))}</span>
                    <Badge label={STATUS_LABEL[o.status] || o.status} variant={o.status === 'received' ? 'ok' : o.status === 'cancelled' ? 'error' : 'warn'} />
                    {o.status === 'pending' && (
                      <button onClick={() => transitionOrder(o.id, 'enviar')} disabled={transitioningId === o.id} className="text-[9px] px-2 py-1 rounded bg-gold/10 text-gold font-medium hover:bg-gold/20 disabled:opacity-50">Enviar</button>
                    )}
                    {o.status === 'approved' && (
                      <>
                        <button onClick={() => transitionOrder(o.id, 'confirmar')} disabled={transitioningId === o.id} className="text-[9px] px-2 py-1 rounded bg-gold/10 text-gold font-medium hover:bg-gold/20 disabled:opacity-50">Entregar</button>
                        <button onClick={() => transitionOrder(o.id, 'recibir')} disabled={transitioningId === o.id} className="text-[9px] px-2 py-1 rounded bg-success/10 text-success font-medium hover:bg-success/20 disabled:opacity-50">Recibir</button>
                      </>
                    )}
                    {o.status === 'delivered' && (
                      <button onClick={() => transitionOrder(o.id, 'recibir')} disabled={transitioningId === o.id} className="text-[9px] px-2 py-1 rounded bg-success/10 text-success font-medium hover:bg-success/20 disabled:opacity-50">Recibir</button>
                    )}
                    {(o.status === 'pending' || o.status === 'approved' || o.status === 'delivered') && (
                      <button onClick={() => { if (confirm('¿Cancelar esta orden de compra?')) transitionOrder(o.id, 'cancelar'); }} disabled={transitioningId === o.id} className="text-[9px] px-2 py-1 rounded bg-danger/10 text-danger font-medium hover:bg-danger/20 disabled:opacity-50">Cancelar</button>
                    )}
                  </div>
                </div>
                {o.items && o.items.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-divider/40 space-y-1">
                    {o.items.map(it => (
                      <div key={it.id} className="flex items-center justify-between text-[10px] text-ink-soft">
                        <span className="truncate">{it.ingredient_name}</span>
                        <span className="flex-shrink-0">
                          {it.quantity} {it.unit} · {fmtEUR(it.unit_cost * it.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
