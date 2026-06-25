/**
 * EventFlow — Factura de proveedor (FR-A10)
 * PUT /api/provider-invoices/[id]  — marcar pagado / adjuntar justificante / editar
 */
import { NextRequest, NextResponse } from 'next/server';
import { querySingle } from '@/lib/db';
import { sanitizeError } from '@/lib/security';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { status, proof_url, amount, due_date, concept, notes } = await request.json();
    const sets: string[] = [];
    const vals: any[] = [];
    let p = 1;
    if (status !== undefined) {
      if (!['pendiente', 'pagado', 'vencido'].includes(status)) {
        return NextResponse.json({ success: false, error: 'status inválido' }, { status: 422 });
      }
      sets.push(`status = $${p++}`); vals.push(status);
      // Al marcar pagado, sella la fecha de pago; al reabrir, la limpia.
      sets.push(`paid_at = ${status === 'pagado' ? 'now()' : 'NULL'}`);
    }
    if (proof_url !== undefined) { sets.push(`proof_url = $${p++}`); vals.push(proof_url || null); }
    if (amount !== undefined) { sets.push(`amount = $${p++}`); vals.push(Number(amount) || 0); }
    if (due_date !== undefined) { sets.push(`due_date = $${p++}::date`); vals.push(due_date || null); }
    if (concept !== undefined) { sets.push(`concept = $${p++}`); vals.push(concept || null); }
    if (notes !== undefined) { sets.push(`notes = $${p++}`); vals.push(notes || null); }
    if (sets.length === 0) return NextResponse.json({ success: false, error: 'Nada que actualizar' }, { status: 400 });

    vals.push(params.id);
    const inv = await querySingle<any>(
      `UPDATE provider_invoices SET ${sets.join(', ')} WHERE id = $${p} RETURNING *`, vals
    );
    if (!inv) return NextResponse.json({ success: false, error: 'Factura no encontrada' }, { status: 404 });
    return NextResponse.json({ success: true, data: inv });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
