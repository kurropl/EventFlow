/**
 * EventFlow — Extras Catalog API
 * GET    /api/extras-catalog       — List all extras (optionally filter by category/active)
 * POST   /api/extras-catalog       — Create new extra (Admin)
 * PUT    /api/extras-catalog       — Update extra (Admin)
 * DELETE /api/extras-catalog?id=X  — Soft-delete (deactivate) extra
 */

import { NextRequest, NextResponse } from 'next/server';
import { querySingle, queryMany, transaction } from '@/lib/db';
import { sanitizeError } from '@/lib/security';
import { requireAdmin } from '@/lib/auth';

interface ExtraCatalogItem {
  id: string;
  category: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  price: number;
  price_unit: string;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const activeOnly = searchParams.get('active') !== 'false'; // default true
    const all = searchParams.get('all') === 'true';

    let query = 'SELECT * FROM extras_catalog';
    const conditions: string[] = [];
    const params: any[] = [];

    if (!all && activeOnly) {
      conditions.push('active = true');
    }
    if (category && category !== 'all') {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY category, sort_order, name';

    const extras = await queryMany<ExtraCatalogItem>(query, params);

    // Group by category for easier consumption
    const grouped: Record<string, ExtraCatalogItem[]> = {};
    for (const extra of extras) {
      if (!grouped[extra.category]) grouped[extra.category] = [];
      grouped[extra.category].push(extra);
    }

    return NextResponse.json({
      success: true,
      data: all ? grouped : extras,
      count: extras.length,
    });
  } catch (error) {
    console.error('[extras-catalog GET]', error);
    return NextResponse.json(
      { error: sanitizeError(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Require admin auth
    const authError = await requireAdmin(request);
    if (authError) return authError;

    const body = await request.json();
    const { category, name, description, photo_url, price, price_unit, sort_order } = body;

    // Validation
    if (!category || !name) {
      return NextResponse.json(
        { error: 'category y name son requeridos' },
        { status: 400 }
      );
    }

    const validCategories = ['centro_mesa', 'manteleria', 'minuta', 'flores', 'iluminacion', 'sonido', 'otro'];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: `category inválida. Válidas: ${validCategories.join(', ')}` },
        { status: 400 }
      );
    }

    const validUnits = ['ud', 'mesa', 'pax', 'evento'];
    const unit = price_unit || 'ud';
    if (!validUnits.includes(unit)) {
      return NextResponse.json(
        { error: `price_unit inválida. Válidas: ${validUnits.join(', ')}` },
        { status: 400 }
      );
    }

    const extra = await querySingle<ExtraCatalogItem>(
      `INSERT INTO extras_catalog (category, name, description, photo_url, price, price_unit, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        category,
        name.trim(),
        description || null,
        photo_url || null,
        parseFloat(price) || 0,
        unit,
        parseInt(sort_order) || 0,
      ]
    );

    return NextResponse.json({ success: true, data: extra }, { status: 201 });
  } catch (error) {
    console.error('[extras-catalog POST]', error);
    return NextResponse.json(
      { error: sanitizeError(error) },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authError = await requireAdmin(request);
    if (authError) return authError;

    const body = await request.json();
    const { id, category, name, description, photo_url, price, price_unit, active, sort_order } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    // Check if extra exists
    const existing = await querySingle<ExtraCatalogItem>(
      'SELECT * FROM extras_catalog WHERE id = $1',
      [id]
    );
    if (!existing) {
      return NextResponse.json({ error: 'Extra no encontrado' }, { status: 404 });
    }

    const extra = await querySingle<ExtraCatalogItem>(
      `UPDATE extras_catalog SET
        category = COALESCE($1, category),
        name = COALESCE($2, name),
        description = $3,
        photo_url = $4,
        price = COALESCE($5, price),
        price_unit = COALESCE($6, price_unit),
        active = COALESCE($7, active),
        sort_order = COALESCE($8, sort_order)
       WHERE id = $9
       RETURNING *`,
      [
        category || null,
        name?.trim() || null,
        description !== undefined ? description : existing.description,
        photo_url !== undefined ? photo_url : existing.photo_url,
        price !== undefined ? parseFloat(price) : null,
        price_unit || null,
        active !== undefined ? active : null,
        sort_order !== undefined ? parseInt(sort_order) : null,
        id,
      ]
    );

    return NextResponse.json({ success: true, data: extra });
  } catch (error) {
    console.error('[extras-catalog PUT]', error);
    return NextResponse.json(
      { error: sanitizeError(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authError = await requireAdmin(request);
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    // Soft delete: set active = false
    const extra = await querySingle<ExtraCatalogItem>(
      'UPDATE extras_catalog SET active = false WHERE id = $1 RETURNING *',
      [id]
    );

    if (!extra) {
      return NextResponse.json({ error: 'Extra no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: extra });
  } catch (error) {
    console.error('[extras-catalog DELETE]', error);
    return NextResponse.json(
      { error: sanitizeError(error) },
      { status: 500 }
    );
  }
}
