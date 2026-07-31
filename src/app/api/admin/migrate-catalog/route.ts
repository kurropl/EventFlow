/**
 * EventFlow — API: Migrar catálogo a recetas
 * POST /api/admin/migrate-catalog
 *
 * Crea recetas para todos los catalog_items que aún no tienen una.
 * Solo ejecutable por admin.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { migrateCatalogToRecipes } from '../../../../lib/domain/migrateCatalogToRecipes';
import { sanitizeError } from '@/lib/security';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_session')?.value || request.cookies.get('eventflow_token')?.value;
    if (!token || !verifyToken(token)) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const result = await migrateCatalogToRecipes();

    return NextResponse.json({
      success: true,
      data: result,
      message: `Migración completada: ${result.created} recetas creadas, ${result.skipped} errores.`
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}