'use client';
/**
 * EventFlow — Facturación y Cobros
 * Facturas, pagos, justificante imprimible.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

interface Invoice {
  id: string; invoice_number: string; status: string;
  fiscal_name: string; fiscal_nif: string;
  subtotal: number; iva_pct: number; iva_amount: number;
  total: number; extras_pvp: number;
  payments_total: number; balance_due: number;
  paid_at: string; created_at: string;
  client_name: string; event_type: string; event_date: string;
}

interface EventCompleted {
  id: string; client_name: string; event_type: string;
  event_date: string; guest_count: number; confirmed_price: number;
}

const money = (n: number | string) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n) || 0);
const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const [y, m, day] = d.slice(0, 10).split('-');
  return `${parseInt(day)}/${parseInt(m)}/${y}`;
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  overdue: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-gray-50 text-gray-500 border-gray-200',
};

export default function BillingPanel() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [completedOrders, setCompletedOrders] = useState<EventCompleted[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerate, setShowGenerate] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [generating, setGenerating] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, ordRes] = await Promise.all([
        fetch('/api/invoices'),
        fetch('/api/event-orders?status=completed'),
      ]);
      const invJson = await invRes.json();
      const ordJson = await ordRes.json();
      setInvoices(invJson.data || []);
      setCompletedOrders(ordJson.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const generateInvoice = async () => {
    if (!selectedOrderId) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_order_id: selectedOrderId }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Error al generar factura');
      } else {
        setShowGenerate(false);
        setSelectedOrderId('');
        fetchData();
      }
    } catch (e) { console.error(e); }
    setGenerating(false);
  };

  const markPaid = async (invoiceId: string) => {
    await fetch(`/api/invoices/${invoiceId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'paid' }),
    });
    // Also record a payment
    const inv = invoices.find(i => i.id === invoiceId);
    if (inv) {
      const eventRes = await fetch(`/api/invoices/${invoiceId}`);
      const json = await eventRes.json();
      const eventId = json.data?.event_id;
      if (eventId) {
        await fetch('/api/payments', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_id: eventId,
            concept: `Pago completo · ${inv.invoice_number}`,
            amount: inv.total - inv.payments_total,
            paid: true,
            paid_date: new Date().toISOString().split('T')[0],
            method: 'transferencia',
          }),
        });
      }
    }
    fetchData();
  };

  if (selectedInvoice) return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => setSelectedInvoice(null)}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <div>
          <h2 className="text-lg font-bold text-[#1A1A2E]">{selectedInvoice.invoice_number}</h2>
          <p className="text-xs text-[#6B7280]">{selectedInvoice.client_name} · {selectedInvoice.event_type}</p>
        </div>
        <span className={`ml-auto text-[11px] font-medium px-2.5 py-1 rounded-full border ${STATUS_COLORS[selectedInvoice.status] || ''}`}>
          {selectedInvoice.status === 'paid' ? 'Pagada' : selectedInvoice.status === 'pending' ? 'Pendiente' : selectedInvoice.status}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 p-4 rounded-xl bg-[#FAF8F5] border border-[#E5E7EB]">
        <div>
          <p className="text-[10px] text-[#6B7280] uppercase tracking-wide font-semibold">Subtotal</p>
          <p className="text-lg font-bold text-[#1A1A2E]">{money(selectedInvoice.subtotal)}</p>
        </div>
        <div>
          <p className="text-[10px] text-[#6B7280] uppercase tracking-wide font-semibold">IVA {selectedInvoice.iva_pct}%</p>
          <p className="text-lg font-bold text-[#1A1A2E]">{money(selectedInvoice.iva_amount)}</p>
        </div>
        <div>
          <p className="text-[10px] text-[#6B7280] uppercase tracking-wide font-semibold">Total</p>
          <p className="text-lg font-bold text-[#1A1A2E]">{money(selectedInvoice.total)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-white border border-[#E5E7EB]">
        <div>
          <p className="text-[10px] text-[#6B7280] uppercase tracking-wide font-semibold">Cliente fiscal</p>
          <p className="text-sm text-[#1A1A2E] font-medium">{selectedInvoice.fiscal_name}</p>
          <p className="text-xs text-[#6B7280]">{selectedInvoice.fiscal_nif}</p>
        </div>
        <div>
          <p className="text-[10px] text-[#6B7280] uppercase tracking-wide font-semibold">Fechas</p>
          <p className="text-sm text-[#1A1A2E]">Emitida: {fmtDate(selectedInvoice.created_at)}</p>
          {selectedInvoice.paid_at && <p className="text-xs text-green-600">Pagada: {fmtDate(selectedInvoice.paid_at)}</p>}
        </div>
      </div>

      <div className="flex gap-3">
        {selectedInvoice.status === 'pending' && (
          <button onClick={() => markPaid(selectedInvoice.id)}
            className="flex-1 text-sm font-medium py-2.5 rounded-xl bg-[#15803D] text-white hover:bg-[#166534] transition-colors">
            ✅ Marcar como Pagada
          </button>
        )}
        <a href={`/admin/recibo/${selectedInvoice.id}`} target="_blank"
          className="flex-1 text-sm font-medium py-2.5 rounded-xl border border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors text-center">
          🖨 Ver Justificante
        </a>
      </div>
    </motion.div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1A1A2E]">Facturación</h1>
          <p className="text-xs text-[#6B7280]">Facturas, pagos y justificantes</p>
        </div>
        {completedOrders.length > 0 && !showGenerate && (
          <button onClick={() => setShowGenerate(true)}
            className="text-[11px] font-medium px-3 py-1.5 rounded-lg bg-[#1A1A2E] text-white hover:bg-[#2D2D44] transition-colors">
            + Generar Factura
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-[#EFFAF2] border border-[#A7F3D0]">
          <p className="text-[10px] text-[#15803D] uppercase tracking-wide font-semibold">Pagadas</p>
          <p className="text-2xl font-bold text-[#1A1A2E] mt-1">{invoices.filter(i => i.status === 'paid').length}</p>
        </div>
        <div className="p-4 rounded-xl bg-[#FFF8EC] border border-[#FDE68A]">
          <p className="text-[10px] text-[#B45309] uppercase tracking-wide font-semibold">Pendientes</p>
          <p className="text-2xl font-bold text-[#1A1A2E] mt-1">{invoices.filter(i => i.status === 'pending').length}</p>
        </div>
        <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E5E7EB]">
          <p className="text-[10px] text-[#6B7280] uppercase tracking-wide font-semibold">Total facturado</p>
          <p className="text-2xl font-bold text-[#1A1A2E] mt-1">{money(invoices.reduce((s, i) => s + Number(i.total), 0))}</p>
        </div>
      </div>

      {/* Generate invoice panel */}
      {showGenerate && (
        <div className="p-4 rounded-xl bg-white border border-[#E5E7EB] space-y-3">
          <h3 className="text-sm font-semibold text-[#1A1A2E]">Generar Factura</h3>
          <select value={selectedOrderId} onChange={e => setSelectedOrderId(e.target.value)}
            className="w-full text-sm border border-[#E5E7EB] rounded-xl px-4 py-2.5">
            <option value="">Seleccionar evento completado...</option>
            {completedOrders
              .filter(o => !invoices.find(i => i.client_name === o.client_name && i.event_date === o.event_date))
              .map(o => (
                <option key={o.id} value={o.id}>{o.client_name} · {o.event_type} · {fmtDate(o.event_date)} · {money(o.confirmed_price)}</option>
              ))}
          </select>
          <div className="flex gap-2">
            <button onClick={generateInvoice} disabled={!selectedOrderId || generating}
              className="flex-1 text-sm font-medium py-2 rounded-xl bg-[#2563EB] text-white hover:bg-[#1D4ED8] disabled:opacity-50 transition-colors">
              {generating ? 'Generando...' : 'Generar Factura'}
            </button>
            <button onClick={() => setShowGenerate(false)}
              className="text-sm font-medium px-4 py-2 rounded-xl border border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Invoices table */}
      {loading ? (
        <div className="text-center py-12 text-sm text-[#6B7280]">Cargando...</div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-12 text-sm text-[#6B7280] bg-[#FAF8F5] rounded-2xl border border-dashed border-[#E5E7EB]">
          No hay facturas todavía. Completa un evento y genera la factura desde aquí.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#FAF8F5]">
                <th className="text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide px-4 py-3">Factura</th>
                <th className="text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide px-4 py-3">Cliente</th>
                <th className="text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide px-4 py-3">Evento</th>
                <th className="text-right text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide px-4 py-3">Total</th>
                <th className="text-center text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide px-4 py-3">Estado</th>
                <th className="text-right text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide px-4 py-3">Acción</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}
                  onClick={() => setSelectedInvoice(inv)}
                  className="border-b border-[#F3F4F6] hover:bg-[#FAF8F5] cursor-pointer transition-colors">
                  <td className="px-4 py-3.5">
                    <p className="text-sm font-medium text-[#1A1A2E]">{inv.invoice_number}</p>
                    <p className="text-[11px] text-[#9CA3AF]">{fmtDate(inv.created_at)}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-sm text-[#1A1A2E]">{inv.client_name}</p>
                    <p className="text-[11px] text-[#9CA3AF]">{inv.fiscal_nif}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-sm text-[#1A1A2E] capitalize">{inv.event_type}</p>
                    <p className="text-[11px] text-[#9CA3AF]">{fmtDate(inv.event_date)}</p>
                  </td>
                  <td className="px-4 py-3.5 text-right text-sm font-bold text-[#1A1A2E]">{money(inv.total)}</td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[inv.status] || ''}`}>
                      {inv.status === 'paid' ? 'Pagada' : inv.status === 'pending' ? 'Pendiente' : inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex gap-1 justify-end" onClick={e => e.stopPropagation()}>
                      {inv.status === 'pending' && (
                        <button onClick={() => markPaid(inv.id)}
                          className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-[#15803D] text-white hover:bg-[#166534]">
                          Pagar
                        </button>
                      )}
                      <a href={`/admin/recibo/${inv.id}`} target="_blank"
                        className="text-[11px] font-medium px-2.5 py-1 rounded-lg border border-[#E5E7EB] hover:bg-[#F3F4F6]">
                        🖨
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
