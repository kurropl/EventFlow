'use client';

import { useParams } from 'next/navigation';

// ============================================================
// Portal Menu — Menú y variantes (WP-28)
// Placeholder hasta implementación completa
// ============================================================

export default function PortalMenuPage() {
  const params = useParams();
  const token = params.token as string;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
        <h2 className="text-xl font-semibold text-[#1A1A1A] mb-4">
          🍽️ Menú del evento
        </h2>
        <p className="text-[#6B7280] mb-4">
          Aquí podrás ver el menú contratado y asignar variantes (infantil, celíaco, vegetariano) a cada invitado.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-700">
            <strong>Próximamente:</strong> Esta sección se implementará en WP-28 (Portal: menú y variantes por invitado).
          </p>
        </div>
      </div>
    </div>
  );
}
