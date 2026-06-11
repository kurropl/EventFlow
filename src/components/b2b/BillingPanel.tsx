'use client';
/**
 * EventFlow — Facturación y Cobros
 * Cobros pendientes (señal + saldo) + Facturas
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

interface Payment {
  id: string; event_id: string; concept: string;
  amount: number; due_date: string; paid: boolean; paid_date: string | null;
  method: string | null; notes: string | null; receipt_url: string | null;
  client_name: string; event_type: string; event_date: string;
}

interface Invoice {
  id: string; invoice_number: string; status: string;
  fiscal_name: string; fiscal_nif: string;
  subtotal: number; iva_pct: number; iva_amount: number;
  total: number; extras_pvp: number;
  payments_total: number; balance_due: number;
  paid_at: string; created_at: string;
  client_name: string; event_type: string; event_date: string;
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

const PAYMENT_CONCEPT_COLORS: Record<string, string> = {
  'Señal': 'bg-amber-50 text-amber-700 border-amber-200',
  'Saldo': 'bg-blue-50 text-blue-700 border-blue-200',
  'default': 'bg-gray-50 text-gray-600 border-gray-200',
};

export default function BillingPanel() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [activeTab, setActiveTab] = useState<'payments' | 'invoices'>('payments');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [payRes, invRes] = await Promise.all([
        fetch('/api/payments'),
        fetch('/api/invoices'),
      ]);
      const payJson = await payRes.json();
      const invJson = await invRes.json();
      setPayments(payJson.data || []);
      setInvoices(invJson.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const markPaymentPaid = async (payment: Payment) => {
    setPayingId(payment.id);
    try {
      await fetch(`/api/payments/${payment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paid: true, paid_date: new Date().toISOString().split('T')[0], method: 'transferencia' }),
      });
      fetchData();
    } catch (e) { console.error(e); }
    setPayingId(null);
  };

  const getConceptBadge = (concept: string) => {
    const key = concept.includes('Señal') ? 'Señal' : concept.includes('Saldo') ? 'Saldo' : 'default';
    const cls = PAYMENT_CONCEPT_COLORS[key] || PAYMENT_CONCEPT_COLORS.default;
    return <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${cls}`}>{concept.split('(')[0].trim()}</span>;
  };

  const unpaidPayments = payments.filter(p => !p.paid);
  const overduePayments = unpaidPayments.filter(p => p.due_date && new Date(p.due_date) < new Date());
  const paidPayments = payments.filter(p => p.paid);
  const totalPendingAmount = unpaidPayments.reduce((s, p) => s + Number(p.amount), 0);
  const totalPaidAmount = paidPayments.reduce((s, p) => s + Number(p.amount), 0);

  if (selectedInvoice) return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Same invoice detail view as before - abbreviated */}
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-[#FAF8F5] border border-[#E5E7EB]">
        <div><p className="text-[10px] text-[#6B7280] uppercase tracking-wide font-semibold">Subtotal</p><p className="text-lg font-bold text-[#1A1A2E]">{money(selectedInvoice.subtotal)}</p></div>
        <div><p className="text-[10px] text-[#6B7280] uppercase tracking-wide font-semibold">IVA {selectedInvoice.iva_pct}%</p><p className="text-lg font-bold text-[#1A1A2E]">{money(selectedInvoice.iva_amount)}</p></div>
        <div><p className="text-[10px] text-[#6B7280] uppercase tracking-wide font-semibold">Total</p><p className="text-lg font-bold text-[#1A1A2E]">{money(selectedInvoice.total)}</p></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-white border border-[#E5E7EB]">
        <div><p className="text-[10px] text-[#6B7280] uppercase tracking-wide font-semibold">Cliente fiscal</p><p className="text-sm text-[#1A1A2E] font-medium">{selectedInvoice.fiscal_name}</p><p className="text-xs text-[#6B7280]">{selectedInvoice.fiscal_nif}</p></div>
        <div><p className="text-[10px] text-[#6B7280] uppercase tracking-wide font-semibold">Fechas</p><p className="text-sm text-[#1A1A2E]">Emitida: {fmtDate(selectedInvoice.created_at)}</p>{selectedInvoice.paid_at && <p className="text-xs text-green-600">Pagada: {fmtDate(selectedInvoice.paid_at)}</p>}</div>
      </div>
      <div className="flex gap-3">
        {selectedInvoice.status === 'pending' && (
          <button onClick={() => { fetch(`/api/invoices/${selectedInvoice.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'paid' }) }).then(() => { setSelectedInvoice(null); fetchData(); }); }}
            className="flex-1 text-sm font-medium py-2.5 rounded-xl bg-[#15803D] text-white hover:bg-[#166534] transition-colors">
            Marcar como Pagada
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
      <div>
        <h1 className="text-xl font-bold text-[#1A1A2E]">Facturación y Cobros</h1>
        <p className="text-xs text-[#6B7280]">Cobros pendientes, pagos recibidos y facturación</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#FFF8EC] border border-[#FDE68A]">
          <p className="text-[10px] text-[#B45309] uppercase tracking-wide font-semibold">Pendiente cobro</p>
          <p className="text-2xl font-bold text-[#1A1A2E] mt-1">{money(totalPendingAmount)}</p>
          <p className="text-[10px] text-[#6B7280]">{unpaidPayments.length} cobros pendientes</p>
        </div>
        <div className="p-4 rounded-xl bg-[#EFFAF2] border border-[#A7F3D0]">
          <p className="text-[10px] text-[#15803D] uppercase tracking-wide font-semibold">Cobrado</p>
          <p className="text-2xl font-bold text-[#1A1A2E] mt-1">{money(totalPaidAmount)}</p>
          <p className="text-[10px] text-[#6B7280]">{paidPayments.length} pagos recibidos</p>
        </div>
        <div className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FECACA]">
          <p className="text-[10px] text-[#DC2626] uppercase tracking-wide font-semibold">Vencidos</p>
          <p className="text-2xl font-bold text-[#1A1A2E] mt-1">{overduePayments.length}</p>
          <p className="text-[10px] text-[#6B7280]">{money(overduePayments.reduce((s, p) => s + Number(p.amount), 0))}</p>
        </div>
        <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E5E7EB]">
          <p className="text-[10px] text-[#6B7280] uppercase tracking-wide font-semibold">Total facturado</p>
          <p className="text-2xl font-bold text-[#1A1A2E] mt-1">{money(invoices.reduce((s, i) => s + Number(i.total), 0))}</p>
          <p className="text-[10px] text-[#6B7280]">{invoices.length} facturas</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[#F3F4F6] rounded-xl w-fit">
        <button onClick={() => setActiveTab('payments')}
          className={`px-4 py-1.5 text-[12px] font-medium rounded-lg transition-colors ${activeTab === 'payments' ? 'bg-white text-[#1A1A2E] shadow-sm' : 'text-[#6B7280] hover:text-[#1A1A2E]'}`}>
          Cobros
        </button>
        <button onClick={() => setActiveTab('invoices')}
          className={`px-4 py-1.5 text-[12px] font-medium rounded-lg transition-colors ${activeTab === 'invoices' ? 'bg-white text-[#1A1A2E] shadow-sm' : 'text-[#6B7280] hover:text-[#1A1A2E]'}`}>
          Facturas
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-sm text-[#6B7280]">Cargando...</div>
      ) : activeTab === 'payments' ? (
        /* === PAYMENTS VIEW === */
        <div className="space-y-4">
          {payments.length === 0 ? (
            <div className="text-center py-12 text-sm text-[#6B7280] bg-[#FAF8F5] rounded-2xl border border-dashed border-[#E5E7EB]">
              No hay cobros registrados. Al aceptar un presupuesto se generan automáticamente la señal y el saldo final.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[#E5E7EB] bg-white">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-[#FAF8F5]">
                    <th className="text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide px-4 py-3">Evento</th>
                    <th className="text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide px-4 py-3">Concepto</th>
                    <th className="text-right text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide px-4 py-3">Importe</th>
                    <th className="text-center text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide px-4 py-3">Vencimiento</th>
                    <th className="text-center text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide px-4 py-3">Estado</th>
                    <th className="text-right text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide px-4 py-3">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => {
                    const isOverdue = !p.paid && p.due_date && new Date(p.due_date) < new Date();
                    return (
                      <tr key={p.id} className={`border-b border-[#F3F4F6] hover:bg-[#FAF8F5] transition-colors ${isOverdue ? 'bg-red-50/30' : ''}`}>
                        <td className="px-4 py-3.5">
                          <p className="text-sm font-medium text-[#1A1A2E]">{p.client_name}</p>
                          <p className="text-[11px] text-[#9CA3AF] capitalize">{p.event_type} · {fmtDate(p.event_date)}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            {getConceptBadge(p.concept)}
                            <span className="text-sm text-[#1A1A2E]">{p.concept}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right text-sm font-bold text-[#1A1A2E]">{money(p.amount)}</td>
                        <td className="px-4 py-3.5 text-center text-sm text-[#6B7280]">{fmtDate(p.due_date)}</td>
                        <td className="px-4 py-3.5 text-center">
                          {p.paid ? (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Cobrado {p.paid_date ? fmtDate(p.paid_date) : ''}
                            </span>
                          ) : isOverdue ? (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                              Vencido
                            </span>
                          ) : (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                              Pendiente
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          {!p.paid && (
                            <button
                              onClick={() => markPaymentPaid(p)}
                              disabled={payingId === p.id}
                              className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-[#15803D] text-white hover:bg-[#166534] disabled:opacity-50 transition-colors">
                              {payingId === p.id ? '...' : 'Cobrar'}
                            </button>
                          )}
                          {p.paid && (
                            <div className="flex gap-1 justify-end">
                              {p.receipt_url ? (
                                <a href={p.receipt_url} target="_blank"
                                  className="text-[11px] font-medium px-2.5 py-1 rounded-lg border border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors inline-flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
                                  Justificante
                                </a>
                              ) : (
                                <label className="text-[11px] font-medium px-2.5 py-1 rounded-lg border border-[#E5E7EB] hover:bg-[#F3F4F6] cursor-pointer transition-colors inline-flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 4v8m0 0l-3-3m3 3l3-3M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>
                                  Subir justificante
                                  <input type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      const fd = new FormData();
                                      fd.append('file', file);
                                      try {
                                        const res = await fetch('/api/upload/receipt', { method: 'POST', body: fd });
                                        const data = await res.json();
                                        if (data.success && data.data?.url) {
                                          await fetch(`/api/payments/${p.id}`, {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ receipt_url: data.data.url }),
                                          });
                                          fetchData();
                                        }
                                      } catch {}
                                    }} />
                                </label>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* === INVOICES VIEW (same as before) === */
        <div className="space-y-4">
          {invoices.length === 0 ? (
            <div className="text-center py-12 text-sm text-[#6B7280] bg-[#FAF8F5] rounded-2xl border border-dashed border-[#E5E7EB]">
              No hay facturas todavía. Completa un evento y genera la factura desde aquí.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[#E5E7EB] bg-white">
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
                            <button onClick={() => fetch(`/api/invoices/${inv.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'paid' }) }).then(fetchData)}
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
      )}
    </div>
  );
}