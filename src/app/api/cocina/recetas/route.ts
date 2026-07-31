/**
 * EventFlow — Recetas API (CORREGIDA)
 */
import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { sanitizeError } from '@/lib/security';

async function verifyAuth(request: NextRequest) {
  const token = request.cookies.get('admin_session')?.value || request.cookies.get('eventflow_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    let sql = "SELECT r.id, r.name, r.category, ci.pvp, ci.cost, ci.description, r.cost_per_serving, r.published, r.active, COALESCE((SELECT COUNT(*) FROM recipe_ingredients ri WHERE ri.recipe_id = r.id), 0)::int as ingredient_count FROM recipes r LEFT JOIN catalog_items ci ON ci.id = r.catalog_item_id WHERE r.active = true";
    const values: any[] = [];
    let idx = 1;

    if (category) { sql += " AND r.category = $" + idx; values.push(category); idx++; }
    if (search) { sql += " AND (r.name ILIKE $" + idx + " OR ci.description ILIKE $" + idx + ")"; values.push('%' + search + '%'); idx++; }
    sql += " ORDER BY r.name ASC";

    return NextResponse.json({ success: true, data: await queryMany<any>(sql, values) });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

    const body = await request.json();
    if (!body.name) return NextResponse.json({ success: false, error: 'El nombre es obligatorio' }, { status: 400 });

    const r = await querySingle<any>(
      "INSERT INTO recipes (name, category, description, published, active, created_at, updated_at) VALUES ($1, $2, $3, false, true, NOW(), NOW()) RETURNING *",
      [body.name, body.category || 'complemento', body.description || null]
    );

    // Crear catalog_item para compatibilidad
    await querySingle<any>("INSERT INTO catalog_items (name, category, pvp, cost, description, active, created_at, updated_at) VALUES ($1, $2, 0, 0, $3, true, NOW(), NOW()) ON CONFLICT (name) DO NOTHING",
      [body.name, body.category || 'complemento', body.description || '']);

    // Si se enviaron ingredientes, guardarlos
    if (body.ingredients && Array.isArray(body.ingredients)) {
      for (const ing of body.ingredients) {
        if (!ing.ingrediente || !ing.cantidad) continue;
        // Buscar ingredient_id por nombre
        let ingRow = await querySingle<any>('SELECT id, unit_cost, cost_per_unit FROM ingredients WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) LIMIT 1', [ing.ingrediente]);
        if (!ingRow) {
          ingRow = await querySingle<any>('SELECT id, unit_cost, cost_per_unit FROM ingredients WHERE name ILIKE $1 LIMIT 1', ['%' + ing.ingrediente + '%']);
        }
        if (ingRow) {
          const unitCost = Number(ingRow.unit_cost || ingRow.cost_per_unit || 0);
          await querySingle<any>(
            'INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, per_guest, cost) VALUES ($1, $2, $3, $4, true, $5) ON CONFLICT (recipe_id, ingredient_id) DO UPDATE SET quantity = EXCLUDED.quantity, unit = EXCLUDED.unit, cost = EXCLUDED.cost',
            [r.id, ingRow.id, ing.cantidad, ing.medida || 'g', ing.cantidad * unitCost]
          );
        }
      }
    }

    return NextResponse.json({ success: true, data: r, message: 'Receta creada. Los ingredientes se vincularan automaticamente.' }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}