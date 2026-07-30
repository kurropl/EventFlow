/**
 * EventFlow — WP-23: Generar factura de anticipo por hito
 * POST /api/events/[id]/milestones/[milestoneId]/invoice
 *
 * Genera una factura de anticipo para un hito pagado.
 * El hito debe estar en estado 'pagado' y no tener factura asociada.
 */

import { NextRequest, NextResponse } from 'next/server';
import { querySingle, transaction } from '@/lib/db';
import { sanitizeError, isValidUUID } from '@/lib/security';
import { createAdvanceInvoice } from '@/lib/domain/invoiceByMilestone';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; milestoneId: string } }
) {
  try {
    if (!isValidUUID(params.id) || !isValidUUID(params.milestoneId)) {
      return NextResponse.json(
        { success: false, error: 'IDs inválidos' },
        { status: 422 }
      );
    }

    // Verificar que el evento existe
    const event = await querySingle<any>(
      `SELECT id FROM events WHERE id = $1`,
      [params.id]
    );
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Evento no encontrado' },
        { status: 404 }
      );
    }

    const result = await transaction(async (client) => {
      return createAdvanceInvoice(client, params.milestoneId);
    });

    return NextResponse.json({
      success: true,
      data: {
        invoice: result.invoice,
        milestone: {
          id: result.milestone.id,
          label: result.milestone.label,
          amount: result.milestone.amount,
          invoiced_at: result.milestone.invoiced_at,
        },
      },
      message: `Factura de anticipo ${result.invoice.invoice_number} generada por ${result.invoice.subtotal} €`,
    }, { status: 201 });
  } catch (error: any) {
    const status = error.message?.includes('no encontrado') ? 404
      : error.message?.includes('ya tiene') ? 409
      : error.message?.includes('estado') ? 422
      : 500;
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status }
    );
  }
}
