/**
 * EventFlow — WP-23: Generar factura final deduciendo anticipos
 * POST /api/events/[id]/invoice/final
 *
 * Genera la factura final de un evento, deduciendo automáticamente
 * los anticipos ya facturados.
 *
 * Lógica:
 * - Total evento = confirmed_price + extras
 * - Anticipos = SUM(subtotal) de facturas tipo 'anticipo' no canceladas
 * - Base imponible final = Total - Anticipos
 * - IVA sobre base imponible final
 */

import { NextRequest, NextResponse } from 'next/server';
import { transaction } from '@/lib/db';
import { sanitizeError, isValidUUID } from '@/lib/security';
import { createFinalInvoice } from '@/lib/domain/invoiceByMilestone';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!isValidUUID(params.id)) {
      return NextResponse.json(
        { success: false, error: 'event id inválido' },
        { status: 422 }
      );
    }

    const result = await transaction(async (client) => {
      return createFinalInvoice(client, params.id);
    });

    return NextResponse.json({
      success: true,
      data: {
        invoice: result.invoice,
        advances_deducted: result.advancesDeducted,
        advance_invoices: result.advanceInvoices,
      },
      message: `Factura final ${result.invoice.invoice_number} generada. ` +
        (result.advancesDeducted > 0
          ? `Anticipos deducidos: ${result.advancesDeducted.toFixed(2)} €`
          : 'Sin anticipos previos.'),
    }, { status: 201 });
  } catch (error: any) {
    const status = error.message?.includes('no encontrado') ? 404
      : error.message?.includes('Ya existe') ? 409
      : error.message?.includes('incompletos') ? 400
      : 500;
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status }
    );
  }
}
