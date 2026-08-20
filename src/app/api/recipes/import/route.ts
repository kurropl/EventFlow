/**
 * EventFlow — API de Importación de Recetas desde Excel
 * POST /api/recipes/import
 *
 * Acepta un archivo Excel (multipart/form-data) con el formato
 * de la PLANTILLA FICHA TECNICA AUTOMATIZADA.xlsx
 * y crea/actualiza la receta en recipes + recipe_ingredients.
 *
 * También soporta GET /api/recipes/import/template para descargar
 * la plantilla vacía.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, verifyAuth } from '@/lib/auth';
import { sanitizeError } from '@/lib/security';
import { parseRecipeExcel, saveRecipeFromExcel } from '@/lib/domain/recipeImport';


export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ success: false, error: 'No se ha enviado ningún archivo' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const recipeData = parseRecipeExcel(buffer);
    const category = (formData.get('category') as string) || undefined;

    if (recipeData.ingredients.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se encontraron ingredientes en el archivo. Revisa el formato.',
        data: { recipeName: recipeData.name, parsed: recipeData },
      }, { status: 400 });
    }

    const result = await saveRecipeFromExcel(recipeData, category);

    return NextResponse.json({
      success: true,
      data: result,
      message: `Receta "${result.recipeName}" importada con ${result.ingredientsImported} ingredientes.${result.ingredientsSkipped.length > 0 ? ` No se encontraron: ${result.ingredientsSkipped.join(', ')}` : ''}`,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const url = new URL(request.url);
    if (url.pathname.includes('/template')) {
      // Descargar plantilla
      return NextResponse.redirect(new URL('/plantilla-ficha-tecnica.xlsx', request.url));
    }

    return NextResponse.json({ success: true, data: { message: 'Usa POST con multipart/form-data y field "file"' } });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}