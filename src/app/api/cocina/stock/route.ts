/**
 * EventFlow — Kitchen Stock API (Equipment CRUD)
 * Manages the physical stock of kitchen materials and equipment
 */
import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import { verifyToken, verifyAuth } from '@/lib/auth';
import { sanitizeError } from '@/lib/security';


export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

    const searchParams = new URL(request.url).searchParams;
    const category = searchParams.get('categoria');
    const search = searchParams.get('q');
    const lowStock = searchParams.get('lowStock') === 'true';

    let sql = "SELECT * FROM equipment WHERE active = true";
    const params: any[] = [];
    let idx = 1;

    if (category) {
      sql += ` AND category = $${idx++}`;
      params.push(category);
    }
    if (search) {
      sql += ` AND name ILIKE $${idx++}`;
      params.push(`%${search}%`);
    }
    if (lowStock) {
      sql += ` AND stock_quantity <= COALESCE(min_stock, 0) AND min_stock > 0`;
    }

    sql += " ORDER BY category, name";

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
    if (!body.name || !body.category) {
      return NextResponse.json({ success: false, error: 'Nombre y categoría son obligatorios' }, { status: 400 });
    }

    const item = await querySingle<any>(
      `INSERT INTO equipment (name, category, unit, stock_quantity, min_stock, notes, purchase_date, purchase_price, serial_number, location, active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, NOW(), NOW())
       RETURNING *`,
      [
        body.name,
        body.category,
        body.unit || 'ud',
        body.stock_quantity || 0,
        body.min_stock || 0,
        body.notes || '',
        body.purchase_date || null,
        body.purchase_price || null,
        body.serial_number || null,
        body.location || 'Almacén'
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
      `UPDATE equipment SET
        name = COALESCE($1, name),
        category = COALESCE($2, category),
        unit = COALESCE($3, unit),
        stock_quantity = COALESCE($4, stock_quantity),
        min_stock = $5,
        notes = $6,
        purchase_date = $7,
        purchase_price = $8,
        serial_number = $9,
        location = COALESCE($10, location),
        updated_at = NOW()
       WHERE id = $11
       RETURNING *`,
      [
        body.name, body.category, body.unit,
        body.stock_quantity, body.min_stock ?? null,
        body.notes ?? null, body.purchase_date ?? null,
        body.purchase_price ?? null, body.serial_number ?? null,
        body.location, body.id
      ]
    );

    if (!item) {
      return NextResponse.json({ success: false, error: 'Item no encontrado' }, { status: 404 });
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

    await querySingle<any>(
      "UPDATE equipment SET active = false, updated_at = NOW() WHERE id = $1",
      [body.id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}