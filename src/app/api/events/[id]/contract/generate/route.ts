/**
 * EventFlow — Generar contrato del evento (SPEC Sprint 3, G8, D3)
 * POST /api/events/[id]/contract/generate
 *
 * Botón separado de la aceptación del presupuesto (decisión D3): un admin
 * decide cuándo generar el contrato, no ocurre automáticamente dentro de
 * acceptQuote. Requiere que el evento ya tenga client_token (es decir, que
 * el presupuesto esté aceptado en adelante).
 */
import { NextRequest, NextResponse } from 'next/server';
import { querySingle, transaction } from '@/lib/db';
import { sanitizeError, isValidUUID } from '@/lib/security';
import { generateEventContract } from '@/lib/domain/eventContract';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!isValidUUID(params.id)) {
      return NextResponse.json({ success: false, error: 'event id inválido' }, { status: 422 });
    }

    const event = await querySingle<any>(`SELECT id, client_token FROM events WHERE id = $1`, [params.id]);
    if (!event) {
      return NextResponse.json({ success: false, error: 'Evento no encontrado' }, { status: 404 });
    }
    if (!event.client_token) {
      return NextResponse.json(
        { success: false, error: 'El presupuesto debe estar aceptado antes de generar el contrato' },
        { status: 400 }
      );
    }

    const result = await transaction((client) => generateEventContract(client, params.id));

    return NextResponse.json(
      { success: true, data: result.contract, created: result.created },
      { status: result.created ? 201 : 200 }
    );
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
