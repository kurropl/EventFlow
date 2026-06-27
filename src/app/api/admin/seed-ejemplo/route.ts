/**
 * POST /api/admin/seed-ejemplo — Ejecuta el seed de ejemplo
 *
 * Crea datos demo para recorrer las 16 fases del flujo.
 * Solo inserciones, nunca borra datos existentes (ON CONFLICT DO NOTHING).
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sanitizeError } from '@/lib/security';

export async function POST() {
  try {
    const results: string[] = [];

    // Helper: safe insert with uuid generation
    const safeInsert = async (sql: string, params?: any[]) => {
      try {
        await query(sql, params || []);
        return 'OK';
      } catch (e: any) {
        if (e.message?.includes('duplicate key') || e.message?.includes('already exists')) return 'SKIP';
        return `ERR: ${e.message}`;
      }
    };

    // 1. Lead
    results.push(await safeInsert(
      `INSERT INTO leads (id, name, email, phone, source, notes)
       VALUES ('d0000000-0000-0000-0000-000000000001', 'Maria Sánchez', 'maria@example.com', '+34600111222', 'referido', 'Boda 120 invitados, agosto 2026')
       ON CONFLICT (id) DO NOTHING`
    ));

    // 2. Event (events no tiene lead_id/email/phone/total_tables/total_capacity —
    // usa client_name/client_email/client_phone; el nº de mesas vive en la tabla `tables`).
    results.push(await safeInsert(
      `INSERT INTO events (id, client_name, client_email, client_phone, event_type, event_date, guest_count, kids_count, status, client_token, linen_type, centerpiece, notes)
       VALUES ('e0000000-0000-0000-0000-000000000001', 'Maria Sánchez', 'maria@example.com', '+34600111222', 'boda', '2026-08-23', 120, 8, 'sent', 'eyJhbGciOjJIUzI1NiIsInR5cCI6IkpXVCJ9.cliente-ejemplo-seed', 'blanco', 'floral', 'Evento de ejemplo para demostración del flujo completo')
       ON CONFLICT (id) DO NOTHING`
    ));

    // 3. Quote (columnas reales: total_pvp/total_cost, no "total"/"deposit_pct")
    results.push(await safeInsert(
      `INSERT INTO quotes (id, event_id, status, base_pvp, base_cost, total_pvp, total_cost, notes)
       VALUES ('q0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'sent', 8500.00, 0, 8500.00, 0, 'Presupuesto para boda 120 invitados con menú completo')
       ON CONFLICT (id) DO NOTHING`
    ));

    // 4. Menu items
    results.push(await safeInsert(
      `INSERT INTO event_menu_items (id, event_id, name, category, quantity)
       VALUES ('m1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Salmorejo con jamón', 'entrante', 120)
       ON CONFLICT (id) DO NOTHING`
    ));
    results.push(await safeInsert(
      `INSERT INTO event_menu_items (id, event_id, name, category, quantity)
       VALUES ('m2000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'Solomillo al Pedro Ximénez', 'principal', 120)
       ON CONFLICT (id) DO NOTHING`
    ));
    results.push(await safeInsert(
      `INSERT INTO event_menu_items (id, event_id, name, category, quantity)
       VALUES ('m3000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'Tarta de queso con caramelo', 'postre', 120)
       ON CONFLICT (id) DO NOTHING`
    ));

    // 5. Ingredients (id es UUID; columna legacy current_price existe como alias de unit_cost)
    results.push(await safeInsert(
      `INSERT INTO ingredients (id, name, current_price, unit, category)
       VALUES ('11100000-0000-0000-0000-000000000001', 'Tomate pera', 2.00, 'kg', 'verdura')
       ON CONFLICT (id) DO NOTHING`
    ));
    results.push(await safeInsert(
      `INSERT INTO ingredients (id, name, current_price, unit, category)
       VALUES ('11100000-0000-0000-0000-000000000002', 'Pan', 2.00, 'kg', 'panaderia')
       ON CONFLICT (id) DO NOTHING`
    ));
    results.push(await safeInsert(
      `INSERT INTO ingredients (id, name, current_price, unit, category)
       VALUES ('11100000-0000-0000-0000-000000000003', 'Aceite de oliva virgen extra', 10.00, 'l', 'aceite')
       ON CONFLICT (id) DO NOTHING`
    ));
    results.push(await safeInsert(
      `INSERT INTO ingredients (id, name, current_price, unit, category)
       VALUES ('11100000-0000-0000-0000-000000000004', 'Ajo', 5.00, 'kg', 'verdura')
       ON CONFLICT (id) DO NOTHING`
    ));

    // 6. Catalog item (necesario antes de recipe_items, que referencia catalog_items)
    results.push(await safeInsert(
      `INSERT INTO catalog_items (id, name, category, pvp, cost, ingredients)
       VALUES ('cccc0000-0000-0000-0000-000000000001', 'Salmorejo con jamón', 'aperitivo-frio', 12.50, 0,
         '[{"name":"Tomate pera","grams":1000},{"name":"Pan","grams":200},{"name":"Aceite de oliva virgen extra","grams":100},{"name":"Ajo","grams":20}]'::jsonb)
       ON CONFLICT (id) DO NOTHING`
    ));

    // 7. Recipe (entidad propia con ingredients JSONB, opcionalmente ligada a catalog_items)
    results.push(await safeInsert(
      `INSERT INTO recipes (id, name, description, servings, active, published, catalog_item_id)
       VALUES ('r0000000-0000-0000-0000-000000000001', 'Salmorejo', 'Receta de salmorejo - 10 raciones', 10, true, true, 'cccc0000-0000-0000-0000-000000000001')
       ON CONFLICT (id) DO NOTHING`
    ));

    // 8. Recipe items (escandallo real: catalog_item_id + ingredient_id, ambos UUID FK)
    results.push(await safeInsert(
      `INSERT INTO recipe_items (id, catalog_item_id, ingredient_id, quantity, unit)
       VALUES ('ri100000-0000-0000-0000-000000000001', 'cccc0000-0000-0000-0000-000000000001', '11100000-0000-0000-0000-000000000001', 1000, 'g')
       ON CONFLICT (id) DO NOTHING`
    ));
    results.push(await safeInsert(
      `INSERT INTO recipe_items (id, catalog_item_id, ingredient_id, quantity, unit)
       VALUES ('ri100000-0000-0000-0000-000000000002', 'cccc0000-0000-0000-0000-000000000001', '11100000-0000-0000-0000-000000000002', 200, 'g')
       ON CONFLICT (id) DO NOTHING`
    ));
    results.push(await safeInsert(
      `INSERT INTO recipe_items (id, catalog_item_id, ingredient_id, quantity, unit)
       VALUES ('ri100000-0000-0000-0000-000000000003', 'cccc0000-0000-0000-0000-000000000001', '11100000-0000-0000-0000-000000000003', 100, 'ml')
       ON CONFLICT (id) DO NOTHING`
    ));
    results.push(await safeInsert(
      `INSERT INTO recipe_items (id, catalog_item_id, ingredient_id, quantity, unit)
       VALUES ('ri100000-0000-0000-0000-000000000004', 'cccc0000-0000-0000-0000-000000000001', '11100000-0000-0000-0000-000000000004', 20, 'g')
       ON CONFLICT (id) DO NOTHING`
    ));

    // 8b. Guest form
    results.push(await safeInsert(
      `INSERT INTO guest_forms (id, event_id, client_name, email, guests)
       VALUES ('gf0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Maria Sánchez', 'maria@example.com',
         '[]'::jsonb)
       ON CONFLICT (id) DO NOTHING`
    ));

    // 9. Escandallo items (ingredient_id/recipe_item_id son FKs UUID reales)
    results.push(await safeInsert(
      `INSERT INTO event_shopping_items (id, event_id, ingredient_id, recipe_item_id, ingredient_name, theoretical_qty, unit, estimated_cost, actual_quantity, actual_cost_total)
       VALUES ('e5100000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '11100000-0000-0000-0000-000000000001', 'ri100000-0000-0000-0000-000000000001', 'Tomate', 12000, 'g', 24.00, 11000, 22.00)
       ON CONFLICT (id) DO NOTHING`
    ));
    results.push(await safeInsert(
      `INSERT INTO event_shopping_items (id, event_id, ingredient_id, recipe_item_id, ingredient_name, theoretical_qty, unit, estimated_cost, actual_quantity, actual_cost_total)
       VALUES ('e5100000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', '11100000-0000-0000-0000-000000000002', 'ri100000-0000-0000-0000-000000000002', 'Pan', 2400, 'g', 4.80, 2500, 5.00)
       ON CONFLICT (id) DO NOTHING`
    ));
    results.push(await safeInsert(
      `INSERT INTO event_shopping_items (id, event_id, ingredient_id, recipe_item_id, ingredient_name, theoretical_qty, unit, estimated_cost, actual_quantity, actual_cost_total)
       VALUES ('e5100000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', '11100000-0000-0000-0000-000000000003', 'ri100000-0000-0000-0000-000000000003', 'Aceite oliva', 1200, 'g', 12.00, 1100, 11.00)
       ON CONFLICT (id) DO NOTHING`
    ));
    results.push(await safeInsert(
      `INSERT INTO event_shopping_items (id, event_id, ingredient_id, recipe_item_id, ingredient_name, theoretical_qty, unit, estimated_cost, actual_quantity, actual_cost_total)
       VALUES ('e5100000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', '11100000-0000-0000-0000-000000000004', 'ri100000-0000-0000-0000-000000000004', 'Ajo', 240, 'g', 1.20, 250, 1.25)
       ON CONFLICT (id) DO NOTHING`
    ));

    // 10. Más catalog items (menú completo: principal y postre; columnas reales pvp/cost/ingredients)
    results.push(await safeInsert(
      `INSERT INTO catalog_items (id, name, category, pvp, cost, ingredients)
       VALUES ('cccc0000-0000-0000-0000-000000000002', 'Solomillo al PX', 'carne', 22.00, 0, '[]'::jsonb)
       ON CONFLICT (id) DO NOTHING`
    ));
    results.push(await safeInsert(
      `INSERT INTO catalog_items (id, name, category, pvp, cost, ingredients)
       VALUES ('cccc0000-0000-0000-0000-000000000003', 'Tarta de queso', 'postre', 8.50, 0, '[]'::jsonb)
       ON CONFLICT (id) DO NOTHING`
    ));

    // 11. Payment
    results.push(await safeInsert(
      `INSERT INTO payments (id, event_id, amount, method, concept, paid)
       VALUES ('p0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 3400.00, 'transferencia', 'Señal presupuesto 40%', true)
       ON CONFLICT (id) DO NOTHING`
    ));

    // 12. Staffing lines (id es UUID)
    results.push(await safeInsert(
      `INSERT INTO staffing_lines (id, event_id, role, slots_needed, status)
       VALUES ('50000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'camarero', 8, 'open')
       ON CONFLICT (id) DO NOTHING`
    ));
    results.push(await safeInsert(
      `INSERT INTO staffing_lines (id, event_id, role, slots_needed, status)
       VALUES ('50000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'cocinero', 3, 'open')
       ON CONFLICT (id) DO NOTHING`
    ));

    // 13. Briefing
    results.push(await safeInsert(
      `INSERT INTO event_briefings (id, event_id, content, status)
       VALUES ('b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001',
         '{"event":{"name":"Boda Maria","date":"2026-08-23","time":"13:00","location":"Finca Alboroto"},"menu":[{"pase":1,"plato":"Salmorejo","notas":"Servir frío"},{"pase":2,"plato":"Solomillo","notas":"A punto"},{"pase":3,"plato":"Tarta queso","notas":"Caramelo aparte"}],"staff":[{"zona":"A","camarero":"Pepe"},{"zona":"B","camarero":"Luis"}],"timeline":[{"hora":"07:00","tarea":"Montaje"},{"hora":"12:00","tarea":"Servicio"},{"hora":"18:00","tarea":"Cierre"}],"alergenos":{"salmorejo":["gluten (pan)"],"tarta":["lactosa"]},"mesas":{"total":12,"invitados_por_mesa":10}}'::jsonb,
         'draft')
       ON CONFLICT (id) DO NOTHING`
    ));

    const ok = results.filter(r => r === 'OK').length;
    const skipped = results.filter(r => r === 'SKIP').length;
    const errors = results.filter(r => r.startsWith('ERR'));

    return NextResponse.json({
      success: true,
      data: { created: ok, skipped, errors: errors.length },
    });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 });
  }
}