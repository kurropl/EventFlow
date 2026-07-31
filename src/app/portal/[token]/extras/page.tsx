'use client';

import { useParams } from 'next/navigation';

// ============================================================
// Portal Extras — Extras y decoración (WP-29)
// Placeholder hasta implementación completa
// ============================================================

export default function PortalExtrasPage() {
  const params = useParams();
  const token = params.token as string;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
        <h2 className="text-xl font-semibold text-[#1A1A1A] mb-4">
          ✨ Extras y decoración
        </h2>
        <p className="text-[#6B7280] mb-4">
          Aquí podrás seleccionar extras para tu evento: centros de mesa, mantelería, minuta y más.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-700">
            <strong>Próximamente:</strong> Esta sección se implementará en WP-29 (Portal: extras y decoración).
          </p>
        </div>
      </div>
    </div>
  );
}
