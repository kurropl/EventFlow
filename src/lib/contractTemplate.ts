/**
 * EventFlow — Plantilla del contrato de servicios de catering (SPEC Sprint 3, G8)
 *
 * Texto legal estándar (D4 — redactado como boilerplate razonable, NO
 * revisado por un abogado; el negocio debe validarlo legalmente antes de
 * usarlo en producción real). Genera un snapshot HTML del contrato en el
 * momento de su creación — no un PDF (D1: sin infraestructura de generación
 * de PDF en servidor; el cliente puede imprimir/guardar el HTML como PDF
 * desde el navegador).
 */

const TERMS_HTML = `
  <h2>Términos y condiciones</h2>
  <ol>
    <li><b>Objeto.</b> El presente contrato regula la prestación de servicios de
    catering y organización del evento descrito, por parte de J. Benítez
    ("el Prestador") al cliente arriba indicado ("el Cliente"), en los
    términos y condiciones aquí recogidos y en el presupuesto aceptado que
    forma parte integrante de este documento.</li>
    <li><b>Precio y forma de pago.</b> El precio total del servicio es el
    indicado en el presupuesto aceptado. Salvo acuerdo distinto, el pago se
    realiza en dos plazos: un 40% en concepto de señal a la aceptación del
    presupuesto, y el 60% restante antes de la fecha del evento, según el
    calendario de pagos detallado en este documento.</li>
    <li><b>Modificaciones.</b> Cualquier cambio en el número de comensales,
    menú, fecha o condiciones del servicio deberá comunicarse por escrito y
    podrá dar lugar a un ajuste del precio, reflejado en un presupuesto
    actualizado.</li>
    <li><b>Cancelación.</b> En caso de cancelación por parte del Cliente, la
    señal entregada quedará en poder del Prestador en concepto de
    indemnización por los gastos de organización y reserva ya
    comprometidos, sin perjuicio de otras cantidades que pudieran adeudarse
    conforme a lo pactado.</li>
    <li><b>Alérgenos e intolerancias.</b> El Prestador elaborará el menú
    conforme a la información sobre alergias e intolerancias facilitada por
    el Cliente y sus invitados. El Prestador no se hace responsable de
    reacciones derivadas de información no comunicada con la antelación
    suficiente.</li>
    <li><b>Fuerza mayor.</b> Ninguna de las partes será responsable del
    incumplimiento de sus obligaciones cuando este se deba a causas de
    fuerza mayor ajenas a su voluntad.</li>
    <li><b>Protección de datos.</b> Los datos personales facilitados se
    tratarán conforme al Reglamento (UE) 2016/679 (RGPD) y la LOPDGDD, con
    la única finalidad de gestionar la relación contractual y la prestación
    del servicio.</li>
    <li><b>Jurisdicción.</b> Para cualquier controversia derivada de este
    contrato, ambas partes se someten a los Juzgados y Tribunales del
    domicilio del Prestador, con renuncia a cualquier otro fuero que
    pudiera corresponderles.</li>
  </ol>
`;

function fmtDate(d: unknown): string {
  if (!d) return '—';
  try { return new Date(d as string).toLocaleDateString('es-ES'); } catch { return String(d); }
}

export function renderContractHtml(p: { event: any; quote: any; payments: any[] }): string {
  const { event, quote, payments } = p;
  const total = Number(quote?.total_pvp ?? event.total_pvp ?? 0).toFixed(2);
  const paymentRows = (payments || []).map((pay) =>
    `<tr><td>${pay.concept}</td><td>${Number(pay.amount).toFixed(2)} €</td><td>${fmtDate(pay.due_date)}</td></tr>`
  ).join('');

  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Contrato — ${event.client_name}</title></head>
<body>
  <h1>Contrato de prestación de servicios de catering</h1>
  <p><b>Cliente:</b> ${event.client_name} (${event.client_email})</p>
  <p><b>Evento:</b> ${event.event_type} — ${fmtDate(event.event_date)} — ${event.guest_count} comensales</p>
  <p><b>Total presupuesto:</b> ${total} €</p>
  <h2>Calendario de pagos</h2>
  <table border="1" cellpadding="6" cellspacing="0">
    <thead><tr><th>Concepto</th><th>Importe</th><th>Vencimiento</th></tr></thead>
    <tbody>${paymentRows}</tbody>
  </table>
  ${TERMS_HTML}
</body>
</html>`;
}
