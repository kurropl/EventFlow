/**
 * EventFlow — Quote Trace Endpoint
 * GET /api/quotes/[id]/trace
 * Recorre toda la descendencia transaccional desde un presupuesto
 */

import { NextRequest, NextResponse } from 'next/server';
import { querySingle, queryMany, getPool } from '@/lib/db';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Validate UUID
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json(
        { success: false, error: 'ID de presupuesto inválido.' },
        { status: 422 }
      );
    }

    // 1. El presupuesto
    const quote = await querySingle<any>('SELECT * FROM quotes WHERE id = $1', [id]);
    if (!quote) {
      return NextResponse.json(
        { success: false, error: 'Presupuesto no encontrado.' },
        { status: 404 }
      );
    }

    // 2. El evento vinculado (por quote_id)
    const event = await querySingle<any>(
      'SELECT * FROM events WHERE quote_id = $1 ORDER BY created_at DESC LIMIT 1',
      [id]
    );

    const result: any = { quote };

    if (event) {
      result.event = event;
      const eId = event.id;

      // 3. Event orders
      const eventOrders = await queryMany<any>(
        'SELECT * FROM event_orders WHERE event_id = $1 ORDER BY created_at',
        [eId]
      );
      result.eventOrders = eventOrders;

      // 4. Shopping items (escandallo)
      const shoppingItems = await queryMany<any>(
        `SELECT esi.*, i.name AS ingredient_name, i.unit_cost
         FROM event_shopping_items esi
         LEFT JOIN ingredients i ON i.id = esi.ingredient_id
         WHERE esi.event_id = $1`,
        [eId]
      );
      result.shoppingItems = shoppingItems;

      // 5. Payments
      const payments = await queryMany<any>(
        'SELECT * FROM payments WHERE event_id = $1 ORDER BY due_date',
        [eId]
      );
      result.payments = payments;

      // 6. Invoices
      const invoices = await queryMany<any>(
        'SELECT * FROM invoices WHERE event_id = $1 ORDER BY created_at',
        [eId]
      );
      result.invoices = invoices;

      // 7. Staffing lines
      const staffingLines = await queryMany<any>(
        'SELECT * FROM staffing_lines WHERE event_id = $1 ORDER BY role',
        [eId]
      );
      result.staffingLines = staffingLines;

      // 8. Maestras vinculadas (ingredientes usados)
      const ingredientIds = [
        ...new Set(
          shoppingItems
            .filter((si: any) => si.ingredient_id)
            .map((si: any) => si.ingredient_id)
        ),
      ];

      if (ingredientIds.length > 0) {
        const ingredients = await queryMany<any>(
          'SELECT * FROM ingredients WHERE id = ANY($1)',
          [ingredientIds]
        );
        result.ingredients = ingredients;

        // 9. Proveedores de esos ingredientes
        const providerIds = [
          ...new Set(
            ingredients
              .filter((i: any) => i.supplier_id)
              .map((i: any) => i.supplier_id)
          ),
        ];

        if (providerIds.length > 0) {
          const providers = await queryMany<any>(
            'SELECT * FROM providers WHERE id = ANY($1)',
            [providerIds]
          );
          result.providers = providers;
        }
      }

      // 10. Mesas e invitados
      const tables = await queryMany<any>(
        'SELECT * FROM tables WHERE event_id = $1 ORDER BY table_number',
        [eId]
      );
      result.tables = tables;

      const guests = await queryMany<any>(
        'SELECT * FROM guests WHERE event_id = $1 ORDER BY name',
        [eId]
      );
      result.guests = guests;
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[trace] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener trazabilidad.' },
      { status: 500 }
    );
  }
}
