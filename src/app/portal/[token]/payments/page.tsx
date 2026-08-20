'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { formatEUR, formatDate } from '@/lib/format';

// ============================================================
// Portal Payments — Historial de pagos
// ============================================================

interface Payment {
  id: string;
  concept: string;
  amount: number;
  paid: boolean;
  paid_date: string | null;
  method: string | null;
  notes: string | null;
  created_at: string;
}

interface Milestone {
  id: string;
  kind: string;
  label: string;
  amount: number;
  due_date: string | null;
  status: string;
  paid_at: string | null;
  accumulated: number;
}

export default function PortalPaymentsPage() {
  const params = useParams();
  const token = params.token as string;
  const [payments, setPayments] = useState<Payment[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [totals, setTotals] = useState({ paid: 0, pending: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPayments() {
      try {
        const response = await fetch(`/api/portal/${token}/payments`);
        const data = await response.json();
        
        if (data.success) {
          setPayments(data.payments);
          setMilestones(data.milestones);
          setTotals(data.totals);
        }
      } catch (err) {
        console.error('Error loading payments:', err);
      } finally {
        setLoading(false);
      }
    }

    loadPayments();
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
        <h2 className="text-xl font-semibold text-[#1A1A1A] mb-4">
          💰 Resumen de pagos
        </h2>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-sm text-green-600">Total pagado</p>
            <p className="text-2xl font-bold text-green-700">
              {formatEUR(totals.paid)}
            </p>
          </div>
          <div className="bg-amber-50 rounded-lg p-4">
            <p className="text-sm text-amber-600">Pendiente</p>
            <p className="text-2xl font-bold text-amber-700">
              {formatEUR(totals.pending)}
            </p>
          </div>
        </div>
      </div>

      {/* Milestones */}
      {milestones.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">
            Hitos de pago
          </h3>
          <div className="space-y-3">
            {milestones.map((milestone) => (
              <div
                key={milestone.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  milestone.status === 'pagado'
                    ? 'bg-green-50 border-green-200'
                    : milestone.status === 'vencido'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-white border-gray-200'
                }`}
              >
                <div>
                  <p className="font-medium text-[#1A1A1A]">{milestone.label}</p>
                  {milestone.due_date && (
                    <p className="text-sm text-[#6B7280]">
                      Fecha límite: {formatDate(milestone.due_date)}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-bold text-[#1A1A1A]">
                    {formatEUR(milestone.amount)}
                  </p>
                  <p className={`text-xs font-medium ${
                    milestone.status === 'pagado'
                      ? 'text-green-600'
                      : milestone.status === 'vencido'
                      ? 'text-red-600'
                      : 'text-amber-600'
                  }`}>
                    {milestone.status === 'pagado' ? '✓ Pagado' : 
                     milestone.status === 'vencido' ? '✗ Vencido' : 'Pendiente'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment history */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
        <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">
          Historial de transacciones
        </h3>
        
        {payments.length === 0 ? (
          <p className="text-[#6B7280] text-center py-4">
            No hay transacciones registradas
          </p>
        ) : (
          <div className="space-y-3">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
              >
                <div>
                  <p className="font-medium text-[#1A1A1A]">
                    {payment.concept || 'Pago'}
                  </p>
                  <p className="text-sm text-[#6B7280]">
                    {formatDate(payment.created_at)}
                    {payment.method && ` • ${payment.method}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">
                    +{formatEUR(payment.amount)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
