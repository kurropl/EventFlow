'use client';

import { useParams } from 'next/navigation';

// ============================================================
// Portal Messages — Mensajería integrada (WP-30)
// Placeholder hasta implementación completa
// ============================================================

export default function PortalMessagesPage() {
  const params = useParams();
  const token = params.token as string;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
        <h2 className="text-xl font-semibold text-[#1A1A1A] mb-4">
          💬 Mensajes
        </h2>
        <p className="text-[#6B7280] mb-4">
          Aquí podrás comunicarte directamente con nuestro equipo de atención al cliente.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-700">
            <strong>Próximamente:</strong> Esta sección se implementará en WP-30 (Portal: mensajería integrada en CRM).
          </p>
        </div>
      </div>
    </div>
  );
}
