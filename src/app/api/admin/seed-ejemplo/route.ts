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
       VALUES ('d0000000-0000-0000-0000-000000000001', 'Maria Sánchez', 'maria@example.com', '+34600111222', 'instagram', 'Boda 120 invitados, agosto 2026')
       ON CONFLICT (id) DO NOTHING`
    ));

    // 2. Event
    results.push(await safeInsert(
      `INSERT INTO events (id, lead_id, client_name, email, phone, event_type, event_date, guest_count, kids_count, status, client_token, linen_type, centerpiece, total_tables, total_capacity, notes)
       VALUES ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Maria Sánchez', 'maria@example.com', '+34600111222', 'Boda', '2026-08-23', 120, 8, 'presupuestado', 'eyJhbGciOjJIUzI1NiIsInR5cCI6IkpXVCJ9.cliente-ejemplo-seed', 'blanco', 'floral', 12, 120, 'Evento de ejemplo para demostración del flujo completo')
       ON CONFLICT (id) DO NOTHING`
    ));

    // 3. Quote
    results.push(await safeInsert(
      `INSERT INTO quotes (id, event_id, status, total, deposit_pct, deposit_amount, notes)
       VALUES ('q0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'sent', 8500.00, 40, 3400.00, 'Presupuesto para boda 120 invitados con menú completo')
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

    // 5. Ingredients
    results.push(await safeInsert(
      `INSERT INTO ingredients (id, name, current_price, unit, category)
       VALUES ('ing-001', 'Tomate pera', 2.00, 'kg', 'verdura')
       ON CONFLICT (id) DO NOTHING`
    ));
    results.push(await safeInsert(
      `INSERT INTO ingredients (id, name, current_price, unit, category)
       VALUES ('ing-002', 'Pan', 2.00, 'kg', 'panaderia')
       ON CONFLICT (id) DO NOTHING`
    ));
    results.push(await safeInsert(
      `INSERT INTO ingredients (id, name, current_price, unit, category)
       VALUES ('ing-003', 'Aceite de oliva virgen extra', 10.00, 'l', 'aceite')
       ON CONFLICT (id) DO NOTHING`
    ));
    results.push(await safeInsert(
      `INSERT INTO ingredients (id, name, current_price, unit, category)
       VALUES ('ing-004', 'Ajo', 5.00, 'kg', 'verdura')
       ON CONFLICT (id) DO NOTHING`
    ));

    // 6. Recipe + recipe_items
    results.push(await safeInsert(
      `INSERT INTO recipes (id, name, description, servings, active, published)
       VALUES ('r0000000-0000-0000-0000-000000000001', 'Salmorejo', 'Receta de salmorejo - 10 raciones', 10, true, true)
       ON CONFLICT (id) DO NOTHING`
    ));
    results.push(await safeInsert(
      `INSERT INTO recipe_items (id, recipe_id, ingredient_id, ingredient_name, quantity, unit)
       VALUES ('ri000001', 'r0000000-0000-0000-0000-000000000001', 'ing-001', 'Tomate', 1000, 'g')
       ON CONFLICT (id) DO NOTHING`
    ));
    results.push(await safeInsert(
      `INSERT INTO recipe_items (id, recipe_id, ingredient_id, ingredient_name, quantity, unit)
       VALUES ('ri000002', 'r0000000-0000-0000-0000-000000000001', 'ing-002', 'Pan', 200, 'g')
       ON CONFLICT (id) DO NOTHING`
    ));
    results.push(await safeInsert(
      `INSERT INTO recipe_items (id, recipe_id, ingredient_id, ingredient_name, quantity, unit)
       VALUES ('ri000003', 'r0000000-0000-0000-0000-000000000001', 'ing-003', 'Aceite de oliva', 100, 'ml')
       ON CONFLICT (id) DO NOTHING`
    ));
    results.push(await safeInsert(
      `INSERT INTO recipe_items (id, recipe_id, ingredient_id, ingredient_name, quantity, unit)
       VALUES ('ri000004', 'r0000000-0000-0000-0000-000000000001', 'ing-004', 'Ajo', 20, 'g')
       ON CONFLICT (id) DO NOTHING`
    ));

    // 7. Guest form
    results.push(await safeInsert(
      `INSERT INTO guest_forms (id, event_id, client_name, email, guests)
       VALUES ('gf0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Maria Sánchez', 'maria@example.com',
         '[]'::jsonb)
       ON CONFLICT (id) DO NOTHING`
    ));

    // 8. Escandallo items
    results.push(await safeInsert(
      `INSERT INTO event_shopping_items (id, event_id, ingredient_id, recipe_item_id, ingredient_name, theoretical_qty, unit, estimated_cost, actual_quantity, actual_cost_total)
       VALUES ('esi-001', 'e0000000-0000-0000-0000-000000000001', 'ing-001', 'ri000001', 'Tomate', 12000, 'g', 24.00, 11000, 22.00)
       ON CONFLICT (id) DO NOTHING`
    ));
    results.push(await safeInsert(
      `INSERT INTO event_shopping_items (id, event_id, ingredient_id, recipe_item_id, ingredient_name, theoretical_qty, unit, estimated_cost, actual_quantity, actual_cost_total)
       VALUES ('esi-002', 'e0000000-0000-0000-0000-000000000001', 'ing-002', 'ri000002', 'Pan', 2400, 'g', 4.80, 2500, 5.00)
       ON CONFLICT (id) DO NOTHING`
    ));
    results.push(await safeInsert(
      `INSERT INTO event_shopping_items (id, event_id, ingredient_id, recipe_item_id, ingredient_name, theoretical_qty, unit, estimated_cost, actual_quantity, actual_cost_total)
       VALUES ('esi-003', 'e0000000-0000-0000-0000-000000000001', 'ing-003', 'ri000003', 'Aceite oliva', 1200, 'g', 12.00, 1100, 11.00)
       ON CONFLICT (id) DO NOTHING`
    ));
    results.push(await safeInsert(
      `INSERT INTO event_shopping_items (id, event_id, ingredient_id, recipe_item_id, ingredient_name, theoretical_qty, unit, estimated_cost, actual_quantity, actual_cost_total)
       VALUES ('esi-004', 'e0000000-0000-0000-0000-000000000001', 'ing-004', 'ri000004', 'Ajo', 240, 'g', 1.20, 250, 1.25)
       ON CONFLICT (id) DO NOTHING`
    ));

    // 9. Catalog items
    results.push(await safeInsert(
      `INSERT INTO catalog_items (id, name, description, category, price, allergens)
       VALUES ('cat-001', 'Salmorejo con jamón', 'Entrante frío con jamón ibérico', 'entrante', 12.50, ARRAY['gluten'])
       ON CONFLICT (id) DO NOTHING`
    ));
    results.push(await safeInsert(
      `INSERT INTO catalog_items (id, name, description, category, price, allergens)
       VALUES ('cat-002', 'Solomillo al PX', 'Carne de cerdo ibérico al Pedro Ximénez', 'principal', 22.00, ARRAY[]::text[])
       ON CONFLICT (id) DO NOTHING`
    ));
    results.push(await safeInsert(
      `INSERT INTO catalog_items (id, name, description, category, price, allergens)
       VALUES ('cat-003', 'Tarta de queso', 'Postre cremoso con caramelo', 'postre', 8.50, ARRAY['lactosa'])
       ON CONFLICT (id) DO NOTHING`
    ));

    // 10. Payment
    results.push(await safeInsert(
      `INSERT INTO payments (id, event_id, amount, method, concept, paid)
       VALUES ('p0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 3400.00, 'transferencia', 'Señal presupuesto 40%', true)
       ON CONFLICT (id) DO NOTHING`
    ));

    // 11. Staffing lines
    results.push(await safeInsert(
      `INSERT INTO staffing_lines (id, event_id, role, slots_needed, status)
       VALUES ('s0000001', 'e0000000-0000-0000-0000-000000000001', 'camarero', 8, 'open')
       ON CONFLICT (id) DO NOTHING`
    ));
    results.push(await safeInsert(
      `INSERT INTO staffing_lines (id, event_id, role, slots_needed, status)
       VALUES ('s0000002', 'e0000000-0000-0000-0000-000000000001', 'cocinero', 3, 'open')
       ON CONFLICT (id) DO NOTHING`
    ));

    // 12. Briefing
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