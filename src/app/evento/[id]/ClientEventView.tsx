'use client';
/**
 * EventFlow — Client Event View (Client Component)
 * 
 * Displays event details for the client.
 * No prices shown.
 */

interface ClientEventViewProps {
  clientName: string;
  eventType: string;
  eventDate: string;
  guestCount: number;
  kidsCount: number;
  status: string;
  menuName: string;
  items: any[];
  notes: string | null;
  createdAt: string;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  boda: 'Boda',
  cumpleaños: 'Cumpleaños',
  corporativo: 'Corporativo',
  bautizo: 'Bautizo',
  comunión: 'Comunión',
  otro: 'Otro',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Recibido', color: 'bg-amber-100 text-amber-800' },
  sent: { label: 'Propuesta enviada', color: 'bg-blue-100 text-blue-800' },
  accepted: { label: 'Confirmado', color: 'bg-emerald-100 text-emerald-800' },
  in_progress: { label: 'En curso', color: 'bg-purple-100 text-purple-800' },
  completed: { label: 'Completado', color: 'bg-stone-100 text-stone-800' },
  paid: { label: 'Completado', color: 'bg-stone-100 text-stone-800' },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-800' },
  lost: { label: 'Rechazado', color: 'bg-red-100 text-red-800' },
  reopened: { label: 'En curso', color: 'bg-purple-100 text-purple-800' },
};

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function ClientEventView({
  clientName, eventType, eventDate, guestCount, kidsCount,
  status, menuName, items, notes, createdAt,
}: ClientEventViewProps) {
  const statusInfo = STATUS_LABELS[status] || STATUS_LABELS.draft;

  return (
    <div className="min-h-screen" style={{ background: '#f6f1e7', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <header className="sticky top-0 z-50" style={{ background: 'linear-gradient(135deg, #0d0a06 0%, #1a1208 100%)' }}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between" style={{ borderBottom: '2px solid #d4a548' }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full border border-[#d4a548] flex items-center justify-center"
              style={{ fontFamily: "'Playfair Display', serif", color: '#d4a548', fontStyle: 'italic', fontWeight: 700 }}>
              A
            </div>
            <span className="font-serif text-[#d4a548] text-base" style={{ fontFamily: "'Playfair Display', serif" }}>
              J. Benitez
            </span>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Welcome */}
        <div className="text-center">
          <h1 className="font-serif text-3xl md:text-4xl text-stone-800 mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
            {EVENT_TYPE_LABELS[eventType] || eventType}
          </h1>
          <p className="text-stone-500 text-base">
            Hola, <strong>{clientName}</strong>. Aquí tienes los detalles de tu evento.
          </p>
        </div>

        {/* Event details card */}
        <div className="bg-white rounded-2xl shadow-md border border-stone-200 p-6">
          <h2 className="font-serif text-xl text-stone-800 mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
            Detalles del Evento
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-stone-400 uppercase tracking-wider">Fecha</div>
              <div className="text-sm font-semibold text-stone-700 mt-1">{formatDate(eventDate)}</div>
            </div>
            <div>
              <div className="text-xs text-stone-400 uppercase tracking-wider">Tipo</div>
              <div className="text-sm font-semibold text-stone-700 mt-1">{EVENT_TYPE_LABELS[eventType] || eventType}</div>
            </div>
            <div>
              <div className="text-xs text-stone-400 uppercase tracking-wider">Adultos</div>
              <div className="text-sm font-semibold text-stone-700 mt-1">{guestCount}</div>
            </div>
            <div>
              <div className="text-xs text-stone-400 uppercase tracking-wider">Niños</div>
              <div className="text-sm font-semibold text-stone-700 mt-1">{kidsCount || 0}</div>
            </div>
          </div>
        </div>

        {/* Menu card */}
        <div className="bg-white rounded-2xl shadow-md border border-stone-200 p-6">
          <h2 className="font-serif text-xl text-stone-800 mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
            Menú Seleccionado
          </h2>
          <div className="mb-4">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
              {menuName}
            </span>
          </div>

          {/* Items list */}
          {items.length > 0 ? (
            <div className="space-y-1">
              {items.map((item: any, i: number) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-stone-100 last:border-0">
                  <div className="w-2 h-2 rounded-full bg-[#d4a548]" />
                  <span className="text-sm text-stone-700">{item.name || item.item_id}</span>
                  {item.category && (
                    <span className="text-[10px] text-stone-400 uppercase ml-auto">{item.category}</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-stone-400 italic">No se han seleccionado platos aún.</p>
          )}
        </div>

        {/* Notes */}
        {notes && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
            <h3 className="font-serif text-lg text-stone-800 mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
              Notas
            </h3>
            <p className="text-sm text-stone-600">{notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-8 border-t border-stone-200">
          <p className="text-xs text-stone-400">
            Presentado el {formatDate(createdAt)} · J. Benitez
          </p>
          <p className="text-xs text-stone-300 mt-1">
            by EventFlow · Salón de Celebraciones
          </p>
        </div>
      </main>
    </div>
  );
}