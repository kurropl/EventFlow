/**
 * EventFlow — Carga Items API (Loading items CRUD per hoja)
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

    const hojaId = new URL(request.url).searchParams.get('hoja_carga_id');
    if (!hojaId) return NextResponse.json({ success: false, error: 'hoja_carga_id requerido' }, { status: 400 });

    const items = await queryMany<any>(
      "SELECT * FROM items_carga WHERE hoja_carga_id = $1 ORDER BY tipo, orden, created_at",
      [hojaId]
    );

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
    if (!body.hoja_carga_id || !body.nombre) {
      return NextResponse.json({ success: false, error: 'hoja_carga_id y nombre son obligatorios' }, { status: 400 });
    }

    const maxOrden = await querySingle<any>(
      "SELECT COALESCE(MAX(orden), 0) + 1 as next_orden FROM items_carga WHERE hoja_carga_id = $1",
      [body.hoja_carga_id]
    );

    const item = await querySingle<any>(
      `INSERT INTO items_carga (hoja_carga_id, tipo, nombre, cantidad, unit, cargado, retornado, notas, orden, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, false, false, $6, $7, NOW(), NOW())
       RETURNING *`,
      [
        body.hoja_carga_id,
        body.tipo || 'cocina',
        body.nombre,
        body.cantidad || 1,
        body.unit || 'ud',
        body.notas || null,
        maxOrden?.next_orden || 1
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
      `UPDATE items_carga SET
        tipo = COALESCE($1, tipo),
        nombre = COALESCE($2, nombre),
        cantidad = COALESCE($3, cantidad),
        unit = COALESCE($4, unit),
        cargado = COALESCE($5, cargado),
        retornado = $6,
        notas = $7,
        orden = COALESCE($8, orden),
        updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [
        body.tipo, body.nombre, body.cantidad,
        body.unit, body.cargado, body.retornado,
        body.notas ?? null, body.orden, body.id
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
      "DELETE FROM items_carga WHERE id = $1",
      [body.id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}