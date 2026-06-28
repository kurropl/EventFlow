import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export async function GET(_req: NextRequest) {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, pass_number, name, icon, sort_order FROM service_passes ORDER BY sort_order ASC`
    );
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error listing service passes:', error);
    return NextResponse.json(
      { success: false, error: 'Error al listar pases de servicio' },
      { status: 500 }
    );
  }
}
