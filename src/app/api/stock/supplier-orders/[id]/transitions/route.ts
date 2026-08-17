import { NextRequest, NextResponse } from 'next/server';
import { querySingle } from '@/lib/db'; import { verifyToken } from '@/lib/auth'; import { sanitizeError } from '@/lib/security';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i; const MAP: Record<string,string> = { enviar: 'approved', confirmar: 'delivered', recibir: 'received', cancelar: 'cancelled' };
function auth(r: NextRequest) { const t = r.cookies.get('admin_session')?.value || r.cookies.get('eventflow_token')?.value; return t ? verifyToken(t) : null; }
export async function PUT(r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { if (!auth(r)) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    const { id } = await params; if (!UUID.test(id)) return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 422 });
    const { accion, motivo } = await r.json();
    const nuevo = MAP[accion]; if (!nuevo) return NextResponse.json({ success: false, error: `Acción inválida: ${accion}` }, { status: 400 });
    if (accion==='cancelar' && !motivo) return NextResponse.json({ success: false, error: 'Motivo requerido para cancelar' }, { status: 400 });
    const validTransitions: Record<string,string[]> = { pending: ['approved','cancelled'], approved: ['delivered','received','cancelled'], delivered: ['received','cancelled'], received: [], cancelled: [] };
    const actual = await querySingle('SELECT status FROM supplier_orders WHERE id=$1',[id]);
    if (!actual) return NextResponse.json({ success: false, error: 'OC no encontrada' }, { status: 404 });
    if (!validTransitions[actual.status]?.includes(nuevo)) return NextResponse.json({ success: false, error: `Transición ${actual.status}→${nuevo} no válida` }, { status: 409 });
    await querySingle(`UPDATE supplier_orders SET status=$1${motivo?', notes=COALESCE(notes||\'\',\'\')||\' Cancelado: \'||$3':''}, updated_at=now() WHERE id=$2 RETURNING *`, [nuevo, id, motivo||null].filter(Boolean));
    return NextResponse.json({ success: true, data: { status: nuevo } });
  } catch (e) { return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 }); }
}
