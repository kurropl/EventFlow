/**
 * EventFlow — Business Settings API
 * GET  /api/settings — Get business settings
 * PUT  /api/settings — Update business settings
 */
import { NextRequest, NextResponse } from 'next/server';
import { querySingle } from '@/lib/db';
import { sanitizeError, sanitizeText } from '@/lib/security';
import { verifyToken } from '@/lib/auth';

function requireAuth(request: NextRequest): boolean {
  const token = request.cookies.get('admin_session')?.value || request.cookies.get('eventflow_token')?.value;
  if (!token) return false;
  return !!verifyToken(token);
}

export async function GET(request: NextRequest) {
  try {
    if (!requireAuth(request)) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
    const settings = await querySingle<any>(
      `SELECT business_name, address, cif, phone, email, logo_url, bar_price_per_hour, iva_pct,
              block_accept_on_stock_shortage, asientos_por_mesa, asientos_por_mesa_infantil,
              pax_por_camarero_coctel, pax_por_camarero_menu, refuerzo_cada
       FROM business_settings LIMIT 1`
    );
    return NextResponse.json({ success: true, data: settings || {} });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!requireAuth(request)) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
    const body = await request.json();
    const fields: string[] = [];
    const vals: any[] = [];
    let idx = 1;

    const updatable: Record<string, any> = {
      business_name: body.business_name,
      address: body.address,
      cif: body.cif,
      phone: body.phone,
      email: body.email,
      logo_url: body.logo_url,
      bar_price_per_hour: body.bar_price_per_hour != null ? Number(body.bar_price_per_hour) : undefined,
      iva_pct: body.iva_pct != null ? Number(body.iva_pct) : undefined,
      block_accept_on_stock_shortage: typeof body.block_accept_on_stock_shortage === 'boolean'
        ? body.block_accept_on_stock_shortage : undefined,
      // Ratios de mesas/camareros (FR-A05) — configurables (antes hardcodeados
      // en lib/operations.ts, pese a que ya aceptaba un parámetro `ratios`).
      asientos_por_mesa: body.asientos_por_mesa != null ? Math.max(1, Math.round(Number(body.asientos_por_mesa))) : undefined,
      asientos_por_mesa_infantil: body.asientos_por_mesa_infantil != null ? Math.max(1, Math.round(Number(body.asientos_por_mesa_infantil))) : undefined,
      pax_por_camarero_coctel: body.pax_por_camarero_coctel != null ? Math.max(1, Math.round(Number(body.pax_por_camarero_coctel))) : undefined,
      pax_por_camarero_menu: body.pax_por_camarero_menu != null ? Math.max(1, Math.round(Number(body.pax_por_camarero_menu))) : undefined,
      refuerzo_cada: body.refuerzo_cada != null ? Math.max(1, Math.round(Number(body.refuerzo_cada))) : undefined,
    };

    for (const [key, val] of Object.entries(updatable)) {
      if (val !== undefined && val !== null) {
        fields.push(`${key} = $${idx++}`);
        vals.push(typeof val === 'string' ? sanitizeText(val, 200) : val);
      }
    }

    if (fields.length === 0) {
      return NextResponse.json({ success: false, error: 'No hay campos para actualizar' }, { status: 400 });
    }

    fields.push('updated_at = now()');
    const settings = await querySingle<any>(
      `UPDATE business_settings SET ${fields.join(', ')} WHERE id = (SELECT id FROM business_settings LIMIT 1) RETURNING *`,
      vals
    );

    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
