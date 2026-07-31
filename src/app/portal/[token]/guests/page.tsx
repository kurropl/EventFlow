'use client';

import { useParams } from 'next/navigation';

// ============================================================
// Portal Guests — Gestión de invitados (WP-26)
// Placeholder hasta implementación completa
// ============================================================

export default function PortalGuestsPage() {
  const params = useParams();
  const token = params.token as string;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
        <h2 className="text-xl font-semibold text-[#1A1A1A] mb-4">
          👥 Gestión de invitados
        </h2>
        <p className="text-[#6B7280] mb-4">
          Aquí podrás gestionar tu lista de invitados, enviar invitaciones RSVP y ver el estado de confirmaciones.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-700">
            <strong>Próximamente:</strong> Esta sección se implementará en WP-26 (Portal: invitados y RSVP).
          </p>
        </div>
      </div>
    </div>
  );
}
