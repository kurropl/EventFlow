/**
 * EventFlow — Ingredients Inventory API (CRUD + Stock Management)
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

    const searchParams = new URL(request.url).searchParams;
    const category = searchParams.get('category');
    const search = searchParams.get('q');
    const lowStock = searchParams.get('lowStock') === 'true';
    const supplierId = searchParams.get('supplier_id');
    const active = searchParams.get('active');

    let sql = `
      SELECT i.*, 
        p.name as supplier_name,
        COALESCE(
          (SELECT COUNT(*) FROM recipe_ingredients ri WHERE ri.ingredient_id = i.id),
          0
        ) as recipe_count
      FROM ingredients i
      LEFT JOIN providers p ON p.id = i.supplier_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    if (active !== null && active !== '') {
      sql += ` AND i.active = $${idx++}`;
      params.push(active === 'true');
    } else {
      sql += ` AND i.active = true`;
    }

    if (category) {
      sql += ` AND i.category = $${idx++}`;
      params.push(category);
    }
    if (search) {
      sql += ` AND (i.name ILIKE $${idx} OR i.supplier ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }
    if (supplierId) {
      sql += ` AND i.supplier_id = $${idx++}`;
      params.push(supplierId);
    }
    if (lowStock) {
      sql += ` AND i.min_stock > 0 AND COALESCE(i.quantity, 0) <= i.min_stock`;
    }

    sql += " ORDER BY i.name ASC";

    const items = await queryMany<any>(sql, params);
    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

    const body = await request.json();
    if (!body.name || !body.unit) {
      return NextResponse.json({ success: false, error: 'Nombre y unidad son obligatorios' }, { status: 400 });
    }

    const item = await querySingle<any>(
      `INSERT INTO ingredients (
        name, unit, cost_per_unit, unit_cost, supplier, supplier_id,
        quantity, min_stock, stock_unit, packaging_size, active,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, NOW(), NOW())
      RETURNING *`,
      [
        body.name.trim(),
        body.unit,
        body.cost_per_unit || 0,
        body.unit_cost || body.cost_per_unit || 0,
        body.supplier || null,
        body.supplier_id || null,
        body.quantity || 0,
        body.min_stock || 0,
        body.stock_unit || body.unit,
        body.packaging_size || null,
      ]
    );

    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ success: false, error: 'ID es obligatorio' }, { status: 400 });
    }

    const item = await querySingle<any>(
      `UPDATE ingredients SET
        name = COALESCE($1, name),
        unit = COALESCE($2, unit),
        cost_per_unit = COALESCE($3, cost_per_unit),
        unit_cost = COALESCE($4, unit_cost),
        supplier = $5,
        supplier_id = $6,
        quantity = COALESCE($7, quantity),
        min_stock = $8,
        stock_unit = $9,
        packaging_size = $10,
        active = COALESCE($11, active),
        updated_at = NOW()
       WHERE id = $12
       RETURNING *`,
      [
        body.name, body.unit, body.cost_per_unit,
        body.unit_cost, body.supplier ?? null,
        body.supplier_id ?? null, body.quantity,
        body.min_stock ?? null, body.stock_unit,
        body.packaging_size ?? null, body.active,
        body.id
      ]
    );

    if (!item) {
      return NextResponse.json({ success: false, error: 'Ingrediente no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ success: false, error: 'ID es obligatorio' }, { status: 400 });
    }

    const recipeCount = await querySingle<any>(
      "SELECT COUNT(*)::int as cnt FROM recipe_ingredients WHERE ingredient_id = $1",
      [body.id]
    );

    if (recipeCount && recipeCount.cnt > 0) {
      await querySingle<any>(
        "UPDATE ingredients SET active = false, updated_at = NOW() WHERE id = $1",
        [body.id]
      );
      return NextResponse.json({ success: true, message: 'Ingrediente desactivado (se usa en recetas)' });
    }

    await querySingle<any>(
      "DELETE FROM ingredients WHERE id = $1",
      [body.id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}