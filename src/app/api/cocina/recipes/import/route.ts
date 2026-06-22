/**
 * EventFlow — Importar recetas desde Excel
 * POST /api/cocina/recipes/import
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import * as XLSX from 'xlsx';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se ha enviado ningún archivo' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet) as Record<string, any>[];

    if (!data.length) {
      return NextResponse.json({ error: 'El archivo Excel está vacío' }, { status: 400 });
    }

    // Mapear columnas esperadas (flexible con nombres)
    const colMap: Record<string, string> = {};
    const headers = Object.keys(data[0]);
    const expected = {
      nombre: ['nombre', 'name', 'plato', 'receta'],
      ingrediente: ['ingrediente', 'ingredient', 'ingrediente'],
      cantidad: ['cantidad', 'quantity', 'qty', 'cant'],
      unidad: ['unidad', 'unit', 'ud'],
      categoria: ['categoria', 'category', 'cat'],
      tiempo: ['tiempo', 'time', 'prep_time', 'minutos'],
    };

    for (const header of headers) {
      const hl = header.toLowerCase().trim();
      for (const [key, aliases] of Object.entries(expected)) {
        if (aliases.some(a => hl.includes(a))) {
          colMap[key] = header;
          break;
        }
      }
    }

    if (!colMap.nombre || !colMap.ingrediente) {
      return NextResponse.json({
        error: 'El Excel debe tener al menos columnas "Nombre" e "Ingrediente"',
        headers_detectadas: headers,
        mapeo: colMap,
      }, { status: 400 });
    }

    const pool = getPool();
    const recipes: Record<string, any> = {};
    const order: string[] = [];

    for (const row of data) {
      const name = String(row[colMap.nombre]).trim();
      if (!name) continue;

      if (!recipes[name]) {
        recipes[name] = {
          name,
          category: colMap.categoria ? String(row[colMap.categoria] || '').trim() : '',
          prep_time: colMap.tiempo ? Number(row[colMap.tiempo]) || null : null,
          ingredients: [],
        };
        order.push(name);
      }

      const ingredient = {
        name: String(row[colMap.ingrediente]).trim(),
        quantity: colMap.cantidad ? Number(row[colMap.cantidad]) || 0 : 0,
        unit: colMap.unidad ? String(row[colMap.unidad] || 'g').trim() : 'g',
      };
      recipes[name].ingredients.push(ingredient);
    }

    // Insertar recetas
    const created: string[] = [];
    for (const name of order) {
      const r = recipes[name];
      const result = await pool.query(
        `INSERT INTO recipes (name, category, prep_time, servings, source, ingredients, active)
         VALUES ($1, NULLIF($2,''), $3, 1, 'excel', $4::jsonb, true)
         RETURNING id, name`,
        [r.name, r.category, r.prep_time, JSON.stringify(r.ingredients)]
      );
      created.push(result.rows[0].name);
    }

    return NextResponse.json({
      success: true,
      imported: created.length,
      recipes: created,
    });
  } catch (error: any) {
    console.error('Error importing recipes:', error);
    return NextResponse.json({ error: error.message || 'Error al importar recetas' }, { status: 500 });
  }
}