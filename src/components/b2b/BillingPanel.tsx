'use client';
/**
 * EventFlow — Facturación y Cobros
 * Cobros pendientes (señal + saldo) + Facturas
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { PageHeader, Spinner, EmptyState } from '@/components/ui';
import { StatStrip } from '@/components/ui/StatStrip';

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
  pending: 'bg-warning/10 text-warning border-warning/30',
  paid: 'bg-success/10 text-success border-success/30',
  overdue: 'bg-danger/10 text-danger border-danger/30',
  cancelled: 'bg-cream text-ink-soft border-cream-dark',
};

const PAYMENT_CONCEPT_COLORS: Record<string, string> = {
  'Señal': 'bg-warning/10 text-warning border-warning/30',
  'Saldo': 'bg-blue-50 text-blue-700 border-blue-200',
  'default': 'bg-cream text-ink-soft border-cream-dark',
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
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-cream-dark hover:bg-cream transition-colors">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <div>
          <h2 className="text-lg font-bold text-ink">{selectedInvoice.invoice_number}</h2>
          <p className="text-xs text-ink-soft">{selectedInvoice.client_name} · {selectedInvoice.event_type}</p>
        </div>
        <span className={`ml-auto text-[11px] font-medium px-2.5 py-1 rounded-full border ${STATUS_COLORS[selectedInvoice.status] || ''}`}>
          {selectedInvoice.status === 'paid' ? 'Pagada' : selectedInvoice.status === 'pending' ? 'Pendiente' : selectedInvoice.status}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-cream border border-cream-dark">
        <div><p className="text-[10px] text-ink-soft uppercase tracking-wide font-semibold">Subtotal</p><p className="text-lg font-bold text-ink">{money(selectedInvoice.subtotal)}</p></div>
        <div><p className="text-[10px] text-ink-soft uppercase tracking-wide font-semibold">IVA {selectedInvoice.iva_pct}%</p><p className="text-lg font-bold text-ink">{money(selectedInvoice.iva_amount)}</p></div>
        <div><p className="text-[10px] text-ink-soft uppercase tracking-wide font-semibold">Total</p><p className="text-lg font-bold text-ink">{money(selectedInvoice.total)}</p></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-white border border-cream-dark">
        <div><p className="text-[10px] text-ink-soft uppercase tracking-wide font-semibold">Cliente fiscal</p><p className="text-sm text-ink font-medium">{selectedInvoice.fiscal_name}</p><p className="text-xs text-ink-soft">{selectedInvoice.fiscal_nif}</p></div>
        <div><p className="text-[10px] text-ink-soft uppercase tracking-wide font-semibold">Fechas</p><p className="text-sm text-ink">Emitida: {fmtDate(selectedInvoice.created_at)}</p>{selectedInvoice.paid_at && <p className="text-xs text-success">Pagada: {fmtDate(selectedInvoice.paid_at)}</p>}</div>
      </div>
      <div className="flex gap-3">
        {selectedInvoice.status === 'pending' && (
          <button onClick={() => { fetch(`/api/invoices/${selectedInvoice.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'paid' }) }).then(() => { setSelectedInvoice(null); fetchData(); }); }}
            className="flex-1 text-sm font-medium py-2.5 rounded-xl bg-success text-white hover:bg-success/90 transition-colors">
            Marcar como Pagada
          </button>
        )}
        <a href={`/admin/recibo/${selectedInvoice.id}`} target="_blank"
          className="flex-1 text-sm font-medium py-2.5 rounded-xl border border-cream-dark hover:bg-cream transition-colors text-center">
          🖨 Ver Justificante
        </a>
      </div>
    </motion.div>
  );

  return (
    <div className="space-y-5">
      <PageHeader title="Facturación y Cobros" subtitle="Cobros pendientes, pagos recibidos y facturación" />

      {/* Stats */}
      <StatStrip items={[
        { label: 'Pendiente', value: money(totalPendingAmount), accent: true },
        { label: 'Cobrado', value: money(totalPaidAmount) },
        { label: 'Vencidos', value: overduePayments.length },
        { label: 'Facturado', value: money(invoices.reduce((s, i) => s + (i.total || 0), 0)) },
      ]} />

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-cream rounded-xl w-fit">
        <button onClick={() => setActiveTab('payments')}
          className={`px-4 py-1.5 text-[12px] font-medium rounded-lg transition-colors ${activeTab === 'payments' ? 'bg-white text-ink shadow-sm' : 'text-ink-soft hover:text-ink'}`}>
          Cobros
        </button>
        <button onClick={() => setActiveTab('invoices')}
          className={`px-4 py-1.5 text-[12px] font-medium rounded-lg transition-colors ${activeTab === 'invoices' ? 'bg-white text-ink shadow-sm' : 'text-ink-soft hover:text-ink'}`}>
          Facturas
        </button>
      </div>

      {loading ? (
        <Spinner label="Cargando..." />
      ) : activeTab === 'payments' ? (
        /* === PAYMENTS VIEW === */
        <div className="space-y-4">
          {payments.length === 0 ? (
            <EmptyState
              title="No hay cobros registrados"
              description="Al aceptar un presupuesto se generan automáticamente la señal y el saldo final."
            />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-cream-dark bg-white">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-cream-dark bg-cream">
                    <th className="text-left text-[11px] font-semibold text-ink-soft uppercase tracking-wide px-4 py-3">Evento</th>
                    <th className="text-left text-[11px] font-semibold text-ink-soft uppercase tracking-wide px-4 py-3">Concepto</th>
                    <th className="text-right text-[11px] font-semibold text-ink-soft uppercase tracking-wide px-4 py-3">Importe</th>
                    <th className="text-center text-[11px] font-semibold text-ink-soft uppercase tracking-wide px-4 py-3">Vencimiento</th>
                    <th className="text-center text-[11px] font-semibold text-ink-soft uppercase tracking-wide px-4 py-3">Estado</th>
                    <th className="text-right text-[11px] font-semibold text-ink-soft uppercase tracking-wide px-4 py-3">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => {
                    const isOverdue = !p.paid && p.due_date && new Date(p.due_date) < new Date();
                    return (
                      <tr key={p.id} className={`border-b border-cream-dark hover:bg-cream transition-colors ${isOverdue ? 'bg-danger/5' : ''}`}>
                        <td className="px-4 py-3.5">
                          <p className="text-sm font-medium text-ink">{p.client_name}</p>
                          <p className="text-[11px] text-ink-soft-60 capitalize">{p.event_type} · {fmtDate(p.event_date)}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            {getConceptBadge(p.concept)}
                            <span className="text-sm text-ink">{p.concept}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right text-sm font-bold text-ink">{money(p.amount)}</td>
                        <td className="px-4 py-3.5 text-center text-sm text-ink-soft">{fmtDate(p.due_date)}</td>
                        <td className="px-4 py-3.5 text-center">
                          {p.paid ? (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/30">
                              Cobrado {p.paid_date ? fmtDate(p.paid_date) : ''}
                            </span>
                          ) : isOverdue ? (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-danger/10 text-danger border border-danger/30">
                              Vencido
                            </span>
                          ) : (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/30">
                              Pendiente
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          {!p.paid && (
                            <button
                              onClick={() => markPaymentPaid(p)}
                              disabled={payingId === p.id}
                              className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-success text-white hover:bg-success/90 disabled:opacity-50 transition-colors">
                              {payingId === p.id ? '...' : 'Cobrar'}
                            </button>
                          )}
                          {p.paid && (
                            <div className="flex gap-1 justify-end">
                              {p.receipt_url ? (
                                <a href={p.receipt_url} target="_blank"
                                  className="text-[11px] font-medium px-2.5 py-1 rounded-lg border border-cream-dark hover:bg-cream transition-colors inline-flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
                                  Justificante
                                </a>
                              ) : (
                                <label className="text-[11px] font-medium px-2.5 py-1 rounded-lg border border-cream-dark hover:bg-cream cursor-pointer transition-colors inline-flex items-center gap-1">
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
            <EmptyState
              title="No hay facturas todavía"
              description="Completa un evento y genera la factura desde aquí."
            />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-cream-dark bg-white">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-cream-dark bg-cream">
                    <th className="text-left text-[11px] font-semibold text-ink-soft uppercase tracking-wide px-4 py-3">Factura</th>
                    <th className="text-left text-[11px] font-semibold text-ink-soft uppercase tracking-wide px-4 py-3">Cliente</th>
                    <th className="text-left text-[11px] font-semibold text-ink-soft uppercase tracking-wide px-4 py-3">Evento</th>
                    <th className="text-right text-[11px] font-semibold text-ink-soft uppercase tracking-wide px-4 py-3">Total</th>
                    <th className="text-center text-[11px] font-semibold text-ink-soft uppercase tracking-wide px-4 py-3">Estado</th>
                    <th className="text-right text-[11px] font-semibold text-ink-soft uppercase tracking-wide px-4 py-3">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id}
                      onClick={() => setSelectedInvoice(inv)}
                      className="border-b border-cream-dark hover:bg-cream cursor-pointer transition-colors">
                      <td className="px-4 py-3.5">
                        <p className="text-sm font-medium text-ink">{inv.invoice_number}</p>
                        <p className="text-[11px] text-ink-soft-60">{fmtDate(inv.created_at)}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-sm text-ink">{inv.client_name}</p>
                        <p className="text-[11px] text-ink-soft-60">{inv.fiscal_nif}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-sm text-ink capitalize">{inv.event_type}</p>
                        <p className="text-[11px] text-ink-soft-60">{fmtDate(inv.event_date)}</p>
                      </td>
                      <td className="px-4 py-3.5 text-right text-sm font-bold text-ink">{money(inv.total)}</td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[inv.status] || ''}`}>
                          {inv.status === 'paid' ? 'Pagada' : inv.status === 'pending' ? 'Pendiente' : inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex gap-1 justify-end" onClick={e => e.stopPropagation()}>
                          {inv.status === 'pending' && (
                            <button onClick={() => fetch(`/api/invoices/${inv.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'paid' }) }).then(fetchData)}
                              className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-success text-white hover:bg-success/90">
                              Pagar
                            </button>
                          )}
                          <a href={`/admin/recibo/${inv.id}`} target="_blank"
                            className="text-[11px] font-medium px-2.5 py-1 rounded-lg border border-cream-dark hover:bg-cream">
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