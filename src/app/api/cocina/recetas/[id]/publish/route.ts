/**
 * EventFlow — API: Publicar/Despublicar receta
 */
import { NextRequest, NextResponse } from 'next/server';
import { querySingle } from '@/lib/db';
import { verifyToken, verifyAuth } from '@/lib/auth';
import { sanitizeError } from '@/lib/security';


export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

    const recipe = await querySingle<any>('SELECT id, published FROM recipes WHERE id = $1', [params.id]);
    if (!recipe) return NextResponse.json({ success: false, error: 'Receta no encontrada' }, { status: 404 });

    const newPublished = !recipe.published;
    const result = await querySingle<any>('UPDATE recipes SET published = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [newPublished, params.id]);

    return NextResponse.json({ success: true, data: result, message: newPublished ? 'Receta publicada' : 'Receta despublicada' });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}