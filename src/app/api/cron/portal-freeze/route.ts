/**
 * EventFlow — Portal Freeze Cron
 * GET /api/cron/portal-freeze
 *
 * Job diario: congela portales cuya freeze_date <= hoy y estado 'activo'.
 * Por cada portal congelado:
 *   1. Genera resumen HTML (PDF-like)
 *   2. Envía email al cliente
 *   3. Emite portal.frozen (que dispara la cadena operativa)
 *
 * Idempotente: freezePortal() solo cambia status='activo' → 'congelado'.
 * Ejecutar una vez al día (cron 0 0 * * * o Vercel cron diario).
 */

import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/security';
import { querySingle, queryMany, transaction } from '@/lib/db';
import { getPool } from '@/lib/db';
import { freezePortal } from '@/domain/portal';
import { emitDomainEvent } from '@/domain/events';
import { sendEmail } from '@/lib/email';
import { formatEUR } from '@/lib/format';

export const dynamic = 'force-dynamic';

// ============================================================
// Types
// ============================================================

interface PortalToFreeze {
  id: number;
  event_id: string;
  access_token: string;
  freeze_date: string;
  status: string;
}

interface EventData {
  event_id: string;
  client_name: string;
  client_email: string;
  event_type: string;
  event_date: string | null;
  guest_count: number;
  kids_count: number;
  venue_type: string;
  location: string | null;
  total_pvp: number;
  service_type: string;
}

interface GuestSummary {
  total: number;
  confirmed: number;
  pending: number;
  rejected: number;
  adults: number;
  kids: number;
  dietary: Record<string, number>;
}

interface TableSummary {
  table_name: string;
  seats: number;
  assigned: number;
  guests: string[];
}

interface VariantSummary {
  variant_type: string;
  count: number;
}

interface ExtraSummary {
  name: string;
  qty: number;
  unit_price: number;
  total: number;
}

// ============================================================
// Data gathering
// ============================================================

async function getEventData(eventId: string): Promise<EventData | null> {
  return await querySingle<EventData>(
    `SELECT
      e.id as event_id,
      e.client_name,
      e.client_email,
      e.event_type,
      e.event_date::text,
      e.guest_count,
      COALESCE(e.kids_count, 0) as kids_count,
      e.venue_type,
      e.location,
      COALESCE(e.total_pvp, 0) as total_pvp,
      e.event_type
     FROM events e
     WHERE e.id = $1`,
    [eventId]
  );
}

async function getGuestSummary(eventId: string): Promise<GuestSummary> {
  const guests = await queryMany<any>(
    `SELECT rsvp, menu_type, dietary
     FROM guests
     WHERE event_id = $1`,
    [eventId]
  );

  const summary: GuestSummary = {
    total: guests.length,
    confirmed: 0,
    pending: 0,
    rejected: 0,
    adults: 0,
    kids: 0,
    dietary: {},
  };

  for (const g of guests) {
    if (g.rsvp === 'confirmado') summary.confirmed++;
    else if (g.rsvp === 'pendiente') summary.pending++;
    else if (g.rsvp === 'rechazado') summary.rejected++;

    if (g.menu_type === 'nino') summary.kids++;
    else summary.adults++;

    // Dietary restrictions
    const dietary = Array.isArray(g.dietary) ? g.dietary : [];
    for (const d of dietary) {
      summary.dietary[d] = (summary.dietary[d] || 0) + 1;
    }
  }

  return summary;
}

async function getTableSummary(eventId: string): Promise<TableSummary[]> {
  const assignments = await queryMany<any>(
    `SELECT
      ta.table_id as table_name,
      COUNT(*) as assigned,
      ARRAY_AGG(ta.guest_name) as guests
     FROM table_assignments ta
     WHERE ta.event_id = $1
     GROUP BY ta.table_id
     ORDER BY ta.table_id`,
    [eventId]
  );

  // Get table seat counts
  const tables = await queryMany<any>(
    `SELECT name, seats
     FROM tables
     WHERE event_id = $1`,
    [eventId]
  );

  const tableMap = new Map<string, number>();
  for (const t of tables) {
    tableMap.set(t.name, t.seats);
  }

  return assignments.map(a => ({
    table_name: a.table_name,
    seats: tableMap.get(a.table_name) || 0,
    assigned: Number(a.assigned),
    guests: a.guests || [],
  }));
}

async function getVariantSummary(eventId: string): Promise<VariantSummary[]> {
  const variants = await queryMany<any>(
    `SELECT variant_type, COUNT(*) as count
     FROM event_guest_variants
     WHERE event_id = $1
     GROUP BY variant_type
     ORDER BY count DESC`,
    [eventId]
  );

  return variants.map(v => ({
    variant_type: v.variant_type,
    count: Number(v.count),
  }));
}

async function getExtrasSummary(eventId: string): Promise<ExtraSummary[]> {
  const extras = await queryMany<any>(
    `SELECT ec.name, ee.qty, ee.price_snapshot as unit_price,
            (ee.qty * ee.price_snapshot) as total
     FROM event_extras ee
     JOIN extras_catalog ec ON ec.id = ee.extra_id
     WHERE ee.event_id = $1
     ORDER BY ec.name`,
    [eventId]
  );

  return extras.map(e => ({
    name: e.name,
    qty: Number(e.qty),
    unit_price: Number(e.unit_price),
    total: Number(e.total),
  }));
}

// ============================================================
// HTML generation (PDF-like email)
// ============================================================

function generateFreezeSummaryHtml(
  eventData: EventData,
  guestSummary: GuestSummary,
  tables: TableSummary[],
  variants: VariantSummary[],
  extras: ExtraSummary[],
  portalUrl: string
): string {
  const formattedDate = eventData.event_date
    ? new Date(eventData.event_date).toLocaleDateString('es-ES', {
        day: 'numeric', month: 'long', year: 'numeric'
      })
    : 'por confirmar';

  const variantLabels: Record<string, string> = {
    infantil: '👶 Infantil',
    celiaco: '🌾 Celíaco/a',
    vegetariano: '🥬 Vegetariano/a',
    vegano: '🌱 Vegano/a',
    sin_lactosa: '🥛 Sin Lactosa',
    sin_frutos_secos: '🥜 Sin Frutos Secos',
    personalizado: '✏️ Personalizado',
  };

  const dietaryLabels: Record<string, string> = {
    celiaco: '🌾 Celíaco',
    sin_gluten: '🌾 Sin Gluten',
    vegano: '🌱 Vegano',
    vegetariano: '🥬 Vegetariano',
    sin_lactosa: '🥛 Sin Lactosa',
    frutos_secos: '🥜 Frutos Secos',
    mariscos: '🦐 Mariscos',
    huevo: '🥚 Huevo',
  };

  // Build dietary section
  let dietaryHtml = '';
  const dietaryEntries = Object.entries(guestSummary.dietary);
  if (dietaryEntries.length > 0) {
    dietaryHtml = `
      <div style="margin-top: 16px;">
        <h3 style="color: #374151; margin: 0 0 8px 0; font-size: 14px;">Restricciones Alimentarias</h3>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          ${dietaryEntries.map(([key, count]) => `
            <span style="background: #FEF3C7; color: #92400E; padding: 4px 12px; border-radius: 16px; font-size: 13px;">
              ${dietaryLabels[key] || key}: ${count}
            </span>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Build variants section
  let variantsHtml = '';
  if (variants.length > 0) {
    variantsHtml = `
      <div style="margin-top: 16px;">
        <h3 style="color: #374151; margin: 0 0 8px 0; font-size: 14px;">Variantes de Menú</h3>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          ${variants.map(v => `
            <span style="background: #DBEAFE; color: #1E40AF; padding: 4px 12px; border-radius: 16px; font-size: 13px;">
              ${variantLabels[v.variant_type] || v.variant_type}: ${v.count}
            </span>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Build tables section
  let tablesHtml = '';
  if (tables.length > 0) {
    tablesHtml = `
      <div style="margin-top: 16px;">
        <h3 style="color: #374151; margin: 0 0 8px 0; font-size: 14px;">Distribución de Mesas</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background: #F3F4F6;">
              <th style="padding: 8px; text-align: left; border-bottom: 1px solid #E5E7EB;">Mesa</th>
              <th style="padding: 8px; text-align: center; border-bottom: 1px solid #E5E7EB;">Asientos</th>
              <th style="padding: 8px; text-align: center; border-bottom: 1px solid #E5E7EB;">Ocupados</th>
              <th style="padding: 8px; text-align: left; border-bottom: 1px solid #E5E7EB;">Invitados</th>
            </tr>
          </thead>
          <tbody>
            ${tables.map(t => `
              <tr style="border-bottom: 1px solid #F3F4F6;">
                <td style="padding: 8px; font-weight: 500;">${t.table_name}</td>
                <td style="padding: 8px; text-align: center;">${t.seats || '-'}</td>
                <td style="padding: 8px; text-align: center;">${t.assigned}</td>
                <td style="padding: 8px; color: #6B7280;">${t.guests.join(', ')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // Build extras section
  let extrasHtml = '';
  if (extras.length > 0) {
    const extrasTotal = extras.reduce((sum, e) => sum + e.total, 0);
    extrasHtml = `
      <div style="margin-top: 16px;">
        <h3 style="color: #374151; margin: 0 0 8px 0; font-size: 14px;">Extras Seleccionados</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background: #F3F4F6;">
              <th style="padding: 8px; text-align: left; border-bottom: 1px solid #E5E7EB;">Concepto</th>
              <th style="padding: 8px; text-align: center; border-bottom: 1px solid #E5E7EB;">Cantidad</th>
              <th style="padding: 8px; text-align: right; border-bottom: 1px solid #E5E7EB;">Precio</th>
              <th style="padding: 8px; text-align: right; border-bottom: 1px solid #E5E7EB;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${extras.map(e => `
              <tr style="border-bottom: 1px solid #F3F4F6;">
                <td style="padding: 8px;">${e.name}</td>
                <td style="padding: 8px; text-align: center;">${e.qty}</td>
                <td style="padding: 8px; text-align: right;">${formatEUR(e.unit_price)}</td>
                <td style="padding: 8px; text-align: right; font-weight: 500;">${formatEUR(e.total)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="background: #F9FAFB;">
              <td colspan="3" style="padding: 8px; text-align: right; font-weight: 600;">Total Extras:</td>
              <td style="padding: 8px; text-align: right; font-weight: 700; color: #C9A84C;">
                ${formatEUR(extrasTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  }

  const totalConfirmed = guestSummary.confirmed;
  const totalPax = guestSummary.adults + guestSummary.kids;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; color: #1A1A1A;">
      <div style="background: linear-gradient(135deg, #C9A84C, #B8963F); padding: 32px 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🔒 Portal Congelado</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">
          Tu evento ha sido confirmado y las listas están cerradas
        </p>
      </div>

      <div style="background: #FAF8F5; padding: 24px; border: 1px solid #E5E7EB; border-top: none;">
        <h2 style="color: #C9A84C; margin: 0 0 16px 0; font-size: 18px;">
          Hola ${eventData.client_name},
        </h2>
        <p style="margin: 0 0 16px 0; line-height: 1.6;">
          La fecha límite de gestión de tu <strong>${eventData.event_type}</strong> ha llegado.
          Tu portal ha sido <strong>congelado</strong> con los siguientes datos definitivos:
        </p>

        <!-- Event info -->
        <div style="background: white; border-radius: 8px; padding: 16px; margin: 16px 0; border: 1px solid #E5E7EB;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <span style="color: #6B7280; font-size: 12px;">Fecha del evento</span>
              <p style="margin: 2px 0 0 0; font-weight: 600;">${formattedDate}</p>
            </div>
            <div>
              <span style="color: #6B7280; font-size: 12px;">Tipo</span>
              <p style="margin: 2px 0 0 0; font-weight: 600; text-transform: capitalize;">${eventData.event_type}</p>
            </div>
            ${eventData.location ? `
            <div>
              <span style="color: #6B7280; font-size: 12px;">Ubicación</span>
              <p style="margin: 2px 0 0 0; font-weight: 600;">${eventData.location}</p>
            </div>
            ` : ''}
            <div>
              <span style="color: #6B7280; font-size: 12px;">Tipo de servicio</span>
              <p style="margin: 2px 0 0 0; font-weight: 600; text-transform: capitalize;">${eventData.event_type === 'coctel' || eventData.event_type === 'coctel-cena' ? 'cóctel' : 'menú'}</p>
            </div>
          </div>
        </div>

        <!-- Guest summary -->
        <div style="background: white; border-radius: 8px; padding: 16px; margin: 16px 0; border: 1px solid #E5E7EB;">
          <h3 style="color: #374151; margin: 0 0 12px 0; font-size: 14px;">Resumen de Invitados</h3>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; text-align: center;">
            <div style="background: #F0FDF4; border-radius: 8px; padding: 12px;">
              <div style="font-size: 24px; font-weight: 700; color: #16A34A;">${totalConfirmed}</div>
              <div style="font-size: 11px; color: #166534;">Confirmados</div>
            </div>
            <div style="background: #FEF3C7; border-radius: 8px; padding: 12px;">
              <div style="font-size: 24px; font-weight: 700; color: #D97706;">${guestSummary.pending}</div>
              <div style="font-size: 11px; color: #92400E;">Pendientes</div>
            </div>
            <div style="background: #FEE2E2; border-radius: 8px; padding: 12px;">
              <div style="font-size: 24px; font-weight: 700; color: #DC2626;">${guestSummary.rejected}</div>
              <div style="font-size: 11px; color: #991B1B;">Rechazados</div>
            </div>
            <div style="background: #F3F4F6; border-radius: 8px; padding: 12px;">
              <div style="font-size: 24px; font-weight: 700; color: #374151;">${totalPax}</div>
              <div style="font-size: 11px; color: #6B7280;">Total Original</div>
            </div>
          </div>
          <p style="margin: 12px 0 0 0; font-size: 13px; color: #6B7280; text-align: center;">
            ${guestSummary.adults} adultos · ${guestSummary.kids} niños
          </p>

          ${dietaryHtml}
          ${variantsHtml}
        </div>

        ${tablesHtml}
        ${extrasHtml}

        ${eventData.total_pvp > 0 ? `
        <div style="background: white; border-radius: 8px; padding: 16px; margin: 16px 0; border: 1px solid #E5E7EB;">
          <h3 style="color: #374151; margin: 0 0 8px 0; font-size: 14px;">Importe Total</h3>
          <div style="font-size: 28px; font-weight: 700; color: #C9A84C;">
            ${formatEUR(eventData.total_pvp)}
          </div>
        </div>
        ` : ''}

        <!-- Note -->
        <div style="background: #EFF6FF; border-radius: 8px; padding: 16px; margin: 16px 0; border: 1px solid #BFDBFE;">
          <p style="margin: 0; font-size: 13px; color: #1E40AF; line-height: 1.5;">
            <strong>ℹ️ Nota:</strong> Desde este momento tu portal es de solo lectura.
            Si necesitas realizar algún cambio, por favor contacta directamente con nuestro equipo.
          </p>
        </div>

        <p style="color: #6B7280; font-size: 13px; margin: 16px 0 0 0; text-align: center;">
          Un saludo,<br/>
          <strong style="color: #C9A84C;">J.Benitez Catering</strong>
        </p>
      </div>
    </div>
  `;
}

// ============================================================
// Main handler
// ============================================================

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
  }

  try {
    // 1. Find portals to freeze: freeze_date <= today AND status = 'activo'
    const portalsToFreeze = await queryMany<PortalToFreeze>(
      `SELECT id, event_id, access_token, freeze_date::text, status
       FROM client_portals
       WHERE freeze_date <= CURRENT_DATE
         AND status = 'activo'
       ORDER BY freeze_date ASC
       LIMIT 50`
    );

    if (portalsToFreeze.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay portales para congelar',
        frozen: 0,
        sent: 0,
        failed: 0,
      });
    }

    console.log(`[PortalFreeze] ${portalsToFreeze.length} portales para congelar`);

    let frozen = 0;
    let sent = 0;
    let failed = 0;
    const errors: Array<{ event_id: string; error: string }> = [];

    for (const portal of portalsToFreeze) {
      try {
        // 2. Freeze the portal (idempotent: only changes 'activo' → 'congelado')
        const wasFrozen = await freezePortal(portal.event_id);
        if (!wasFrozen) {
          console.log(
            `[PortalFreeze] Portal ${portal.id} (evento ${portal.event_id}) ya congelado. Saltando.`
          );
          continue;
        }
        frozen++;

        // 3. Mark frozen_by_job_at
        const pool = getPool();
        await pool.query(
          `UPDATE client_portals SET frozen_by_job_at = now()
           WHERE event_id = $1 AND status = 'congelado'`,
          [portal.event_id]
        );

        // 4. Gather data for email
        const eventData = await getEventData(portal.event_id);
        if (!eventData || !eventData.client_email) {
          console.warn(
            `[PortalFreeze] Evento ${portal.event_id} sin datos o email. Saltando email.`
          );
          continue;
        }

        const guestSummary = await getGuestSummary(portal.event_id);
        const tables = await getTableSummary(portal.event_id);
        const variants = await getVariantSummary(portal.event_id);
        const extras = await getExtrasSummary(portal.event_id);

        const portalUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://eventflow.jbenitez.es'}/portal/${portal.access_token}`;

        // 5. Generate HTML summary
        const html = generateFreezeSummaryHtml(
          eventData,
          guestSummary,
          tables,
          variants,
          extras,
          portalUrl
        );

        // 6. Send email
        const emailResult = await sendEmail({
          to: eventData.client_email,
          subject: `J.Benitez - Resumen de tu ${eventData.event_type} - Portal Congelado`,
          html,
        });

        if (emailResult.success) {
          sent++;
          console.log(
            `[PortalFreeze] Email enviado a ${eventData.client_email} para evento ${portal.event_id}`
          );
        } else {
          console.warn(
            `[PortalFreeze] Error enviando email a ${eventData.client_email}: ${emailResult.error}`
          );
        }

        // 7. Emit portal.frozen domain event (triggers cascade via handler)
        const confirmedPax = guestSummary.confirmed + guestSummary.kids;
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await emitDomainEvent(
            client,
            'portal.frozen',
            'event',
            portal.event_id,
            {
              event_id: portal.event_id,
              portal_id: portal.id,
              guest_count: eventData.guest_count,
              confirmed_guests: guestSummary.confirmed,
              confirmed_adults: guestSummary.adults,
              confirmed_kids: guestSummary.kids,
              confirmed_pax: confirmedPax,
              freeze_date: portal.freeze_date,
              timestamp: new Date().toISOString(),
            }
          );
          await client.query('COMMIT');
          console.log(
            `[PortalFreeze] portal.frozen emitido para evento ${portal.event_id}`
          );
        } catch (emitError) {
          await client.query('ROLLBACK');
          console.error(
            `[PortalFreeze] Error emitiendo portal.frozen para ${portal.event_id}:`,
            emitError
          );
          // Don't fail the whole run for emit errors - portal is already frozen
        } finally {
          client.release();
        }

      } catch (error) {
        failed++;
        const msg = error instanceof Error ? error.message : String(error);
        errors.push({ event_id: portal.event_id, error: msg });
        console.error(
          `[PortalFreeze] Error procesando portal ${portal.id} (evento ${portal.event_id}):`,
          msg
        );
      }
    }

    return NextResponse.json({
      success: true,
      frozen,
      sent,
      failed,
      total: portalsToFreeze.length,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PortalFreeze] Error general:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
