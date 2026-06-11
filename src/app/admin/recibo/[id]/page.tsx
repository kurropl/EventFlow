/**
 * EventFlow — Justificante de Pago (vista imprimible)
 * /admin/recibo/[id] — Muestra el recibo del pago del evento
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';

interface Invoice {
  id: string; invoice_number: string; status: string;
  fiscal_name: string; fiscal_nif: string; fiscal_address: string;
  subtotal: number; iva_pct: number; iva_amount: number;
  total: number; extras_pvp: number;
  payments_total: number; balance_due: number;
  paid_at: string; created_at: string;
  client_name: string; client_email: string;
  event_type: string; event_date: string;
  guest_count: number;
  confirmed_price: number;
  extra_consumptions: any[];
}

const money = (n: number | string) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);
const fmtDate = (d: string) => {
  if (!d) return '—';
  const [y, m, day] = d.slice(0, 10).split('-');
  return `${parseInt(day)}/${parseInt(m)}/${y}`;
};

export default function JustificantePago() {
  const params = useParams();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/invoices/${params.id}`)
      .then(r => r.json())
      .then(json => { setInvoice(json.data); setLoading(false); })
      .catch(e => { console.error(e); setLoading(false); });
  }, [params.id]);

  const handlePrint = () => window.print();

  if (loading) return <div className="flex items-center justify-center min-h-screen text-sm text-gray-500">Cargando...</div>;
  if (!invoice) return <div className="flex items-center justify-center min-h-screen text-sm text-red-500">Factura no encontrada</div>;

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {/* Print button — hidden in print */}
      <div className="max-w-[210mm] mx-auto px-4 py-6 print:hidden">
        <button onClick={handlePrint}
          className="px-6 py-2.5 rounded-xl bg-[#1A1A2E] text-white text-sm font-medium hover:bg-[#2D2D44] transition-colors">
          🖨 Imprimir Justificante
        </button>
      </div>

      {/* Invoice / Receipt card */}
      <div ref={printRef}
        className="max-w-[210mm] mx-auto bg-white print:shadow-none print:mx-0 print:max-w-none"
        style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        {/* Header */}
        <div className="px-10 pt-10 pb-8 border-b border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-[#1A1A2E]" style={{ fontFamily: 'Playfair Display, serif' }}>
                J. Benítez
              </h1>
              <p className="text-xs text-gray-500 mt-1">Salón de Celebraciones · Sevilla</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-[#1A1A2E]">{invoice.invoice_number}</p>
              <p className="text-xs text-gray-500 mt-1">Emitida: {fmtDate(invoice.created_at)}</p>
              <p className={`text-xs font-medium mt-1 ${
                invoice.status === 'paid' ? 'text-green-600' : 'text-amber-600'
              }`}>
                {invoice.status === 'paid' ? 'Pagada' : 'Pendiente'}
                {invoice.paid_at && ` · ${fmtDate(invoice.paid_at)}`}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-10 py-8 space-y-8">
          {/* Client & Event info */}
          <div className="grid grid-cols-2 gap-12">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">Cliente</p>
              <p className="text-sm font-semibold text-[#1A1A2E]">{invoice.fiscal_name}</p>
              <p className="text-xs text-gray-600">{invoice.fiscal_nif}</p>
              <p className="text-xs text-gray-500">{invoice.fiscal_address}</p>
              <p className="text-xs text-gray-500 mt-2">{invoice.client_email}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">Evento</p>
              <p className="text-sm font-semibold text-[#1A1A2E] capitalize">{invoice.event_type}</p>
              <p className="text-xs text-gray-600">{fmtDate(invoice.event_date)}</p>
              <p className="text-xs text-gray-500">{invoice.guest_count} comensales</p>
            </div>
          </div>

          {/* Line items */}
          <table className="w-full text-sm border-t border-gray-200">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Concepto</th>
                <th className="text-right py-3 text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Importe</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-3 text-[#1A1A2E]">Servicio de catering · {invoice.event_type}</td>
                <td className="py-3 text-right text-[#1A1A2E]">{money(invoice.confirmed_price)}</td>
              </tr>
              {invoice.extras_pvp > 0 && (
                <tr className="border-b border-gray-100">
                  <td className="py-3 text-[#1A1A2E]">Consumos extra</td>
                  <td className="py-3 text-right text-[#1A1A2E]">{money(invoice.extras_pvp)}</td>
                </tr>
              )}
              <tr className="border-b border-gray-100">
                <td className="py-3 text-gray-500 text-xs">IVA ({invoice.iva_pct}%)</td>
                <td className="py-3 text-right text-sm text-gray-500">{money(invoice.iva_amount)}</td>
              </tr>
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span>{money(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Extras</span>
                <span>{money(invoice.extras_pvp)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">IVA {invoice.iva_pct}%</span>
                <span>{money(invoice.iva_amount)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-[#1A1A2E] pt-2 border-t border-gray-300">
                <span>TOTAL</span>
                <span>{money(invoice.total)}</span>
              </div>
              {invoice.payments_total > 0 && (
                <div className="flex justify-between text-sm text-green-600 pt-1">
                  <span>Pagado</span>
                  <span>{money(invoice.payments_total)}</span>
                </div>
              )}
              {invoice.balance_due > 0 && (
                <div className="flex justify-between text-sm font-semibold text-red-600 pt-1">
                  <span>Pendiente</span>
                  <span>{money(invoice.balance_due)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="pt-6 border-t border-gray-200 text-center text-[10px] text-gray-400 space-y-1">
            <p>J. Benítez · Sevilla</p>
            <p>Este documento es un justificante de pago oficial. Conserve una copia para sus registros.</p>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; }
          @page { margin: 15mm; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
