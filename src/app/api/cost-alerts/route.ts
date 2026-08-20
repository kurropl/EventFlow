/**
 * EventFlow — Cost Alerts API
 * GET  /api/cost-alerts — Obtener alertas de margen pendientes
 * PATCH /api/cost-alerts/[id] — Resolver una alerta
 */

import { NextRequest, NextResponse } from 'next/server';
import { querySingle, queryMany, query } from '@/lib/db';
import { verifyToken, requireAuthRequest } from '@/lib/auth';
import { sanitizeError } from '@/lib/security';


// ============================================================
// GET /api/cost-alerts — Listar alertas pendientes
// ============================================================

export async function GET(request: NextRequest) {
  try {
    if (!requireAuthRequest(request).authenticated) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const resolved = searchParams.get('resolved'); // 'true' | 'false' | null (todos)
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 100);

    let whereClause = '';
    const params: any[] = [limit];

    if (resolved === 'true') {
      whereClause = 'WHERE mca.resolved = true';
    } else if (resolved === 'false') {
      whereClause = 'WHERE mca.resolved = false';
    } else {
      // Por defecto: solo pendientes
      whereClause = 'WHERE mca.resolved = false';
    }

    const alerts = await queryMany(
      `SELECT
         mca.id,
         mca.menu_id,
         mca.alert_type,
         mca.old_margin,
         mca.new_margin,
         mca.old_cost,
         mca.new_cost,
         mca.ingredient_id,
         mca.threshold,
         mca.resolved,
         mca.resolved_at,
         mca.resolved_by,
         mca.notes,
         mca.created_at,
         m.name AS menu_name,
         m.version AS menu_version,
         m.price_per_pax,
         i.name AS ingredient_name
       FROM menu_cost_alerts mca
       JOIN menus m ON m.id = mca.menu_id
       LEFT JOIN ingredients i ON i.id = mca.ingredient_id
       ${whereClause}
       ORDER BY mca.created_at DESC
       LIMIT $1`,
      params
    );

    // Contar pendientes para badge
    const countResult = await querySingle<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM menu_cost_alerts WHERE resolved = false`
    );
    const pendingCount = Number(countResult?.count || 0);

    return NextResponse.json({
      success: true,
      data: alerts,
      pendingCount,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}

// ============================================================
// PATCH /api/cost-alerts — Resolver una alerta
// ============================================================

export async function PATCH(request: NextRequest) {
  try {
    if (!requireAuthRequest(request).authenticated) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { id, resolved, notes } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID de alerta requerido' },
        { status: 400 }
      );
    }

    // Verificar que la alerta existe
    const existing = await querySingle<{ id: number; resolved: boolean }>(
      `SELECT id, resolved FROM menu_cost_alerts WHERE id = $1`,
      [id]
    );

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Alerta no encontrada' },
        { status: 404 }
      );
    }

    // Resolver la alerta
    const updated = await querySingle(
      `UPDATE menu_cost_alerts
       SET resolved = $1,
           resolved_at = CASE WHEN $1 = true THEN NOW() ELSE resolved_at END,
           notes = COALESCE($2, notes)
       WHERE id = $3
       RETURNING *`,
      [resolved !== false, notes || null, id]
    );

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}
