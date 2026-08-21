/**
 * EventFlow — APPCC: Registrar recepción con OCR/scan de lote
 * POST /api/cocina/appcc/scan
 * 
 * Recibe una imagen de etiqueta de lote, la procesa con OCR,
 * y devuelve los campos extraídos (lote, caducidad, proveedor, producto, peso).
 */
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { query } from '@/lib/db';
import { sanitizeError } from '@/lib/security';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'appcc-scan');
const TESSERACT_BIN = '/usr/bin/tesseract';

interface ScannedLabel {
  lote: string;
  caducidad: string | null;
  producto: string;
  proveedor: string;
  peso: number | null;
  unidad: string;
  textoCompleto: string;
  confianza: number;
}

function runTesseract(imagePath: string): { text: string; confidence: number } {
  const outBase = imagePath.replace(/\.[^.]+$/, '');
  try {
    execSync(`"${TESSERACT_BIN}" "${imagePath}" "${outBase}" -l spa --oem 1 2>&1`, { timeout: 30000 });
    const txtPath = outBase + '.txt';
    let text = existsSync(txtPath) ? require('fs').readFileSync(txtPath, 'utf-8').trim() : '';
    // Intentar inglés también si no hubo resultados en español
    if (!text) {
      execSync(`"${TESSERACT_BIN}" "${imagePath}" "${outBase}" -l eng --oem 1 2>&1`, { timeout: 30000 });
      if (existsSync(txtPath)) {
        text = require('fs').readFileSync(txtPath, 'utf-8').trim();
      }
    }
    return { text, confidence: text.length > 10 ? 0.75 : 0.2 };
  } catch (e: any) {
    return { text: '', confidence: 0 };
  }
}

function parseLabel(text: string): ScannedLabel {
  const result: ScannedLabel = {
    lote: '', caducidad: null, producto: '', proveedor: '',
    peso: null, unidad: '', textoCompleto: text, confianza: 0,
  };

  const lines = text.split('\n').filter(l => l.trim());
  const upperText = text.toUpperCase();

  // 1. Lote: "LOTE: XXX" / "LOT: XXX" / "(10)XXX"
  const lotPatterns = [
    /(?:LOTE|LOT|BATCH|N[.]\s*LOTE)[\s:]*([A-Z0-9_-]+)/i,
    /\(10\)([A-Z0-9_-]+)/,
  ];
  for (const p of lotPatterns) {
    const m = text.match(p);
    if (m && m[1]) { result.lote = m[1].trim(); break; }
  }
  // También buscar "LOTE" en cualquier línea
  if (!result.lote) {
    for (const line of lines) {
      const m = line.match(/LOTE[.:]*\s*([A-Z0-9_-]+)/i);
      if (m) { result.lote = m[1].trim(); break; }
    }
  }

  // 2. Caducidad: "CAD: DD/MM/AAAA" / "EXP: ..." / "(17)YYMMDD"
  const expPatterns = [
    /(?:CAD|CADUCIDAD|CONSUMO|EXP|EXPIRACI[OÓ]N|BEST[[:space:]]BEFORE|VENCE)[\s:]*?(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})/i,
    /\(17\)(\d{6})/,
  ];
  for (const p of expPatterns) {
    const m = text.match(p);
    if (m && m[1]) {
      let d = m[1].trim();
      // Convertir AAMMDD de GS1 a YYYY-MM-DD
      if (/^\d{6}$/.test(d)) {
        const yy = parseInt(d.slice(0, 2));
        d = `${yy <= 50 ? 2000 + yy : 1900 + yy}-${d.slice(2, 4)}-${d.slice(4, 6)}`;
      } else {
        // DD/MM/AAAA → AAAA-MM-DD
        const parts = d.split(/[/\-]/);
        if (parts.length === 3) d = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      result.caducidad = d;
      break;
    }
  }
  if (!result.caducidad) {
    for (const line of lines) {
      const m = line.match(/(?:CAD|CADUC|EXP)[\s:]*([\d/]+)/i);
      if (m) {
        let d = m[1];
        const parts = d.split(/[/\-]/);
        if (parts.length === 3) d = `${parts[2]}-${parts[1]}-${parts[0]}`;
        result.caducidad = d;
        break;
      }
    }
  }

  // 3. Peso: "PESO: X kg" / "NETO: X g" / "PESO NETO"
  const weightPatterns = [
    /(?:PESO\s*(?:NETO)?|NETTO|NET)[\s:]*?([\d.,]+)\s*(kg|g|lb|on)/i,
    /([\d.,]+)\s*(kg|g)\b/i,
  ];
  for (const p of weightPatterns) {
    const m = text.match(p);
    if (m) {
      result.peso = parseFloat(m[1].replace(',', '.'));
      result.unidad = m[2].toLowerCase();
      break;
    }
  }

  // 4. Producto: primera línea significativa que no sea lote/caducidad/peso
  if (!result.producto) {
    for (const line of lines) {
      const clean = line.replace(/[()\-]/g, '').trim();
      if (clean && !clean.match(/^(?:LOTE|LOT|BATCH|CAD|CADUCIDAD|EXP|PESO|NETO|TOTAL|IVA|FABRIC|FEC)/i) && clean.length > 2 && clean.length < 100) {
        result.producto = clean;
        break;
      }
    }
  }

  // 5. Proveedor: buscar marcas conocidas o línea al inicio
  if (!result.proveedor) {
    for (const line of lines.slice(0, 3)) {
      const clean = line.trim();
      if (clean && clean.length > 3 && clean.length < 80 && !clean.match(/^(?:L[OÒ]T|CAD|EXP|PESO|NETO)/i)) {
        // Verificar si parece un nombre de proveedor
        if (/^(?:distribuidora|carnicer|pescader|fruter|makro|mercadona|costco|carrefour|dia|bonpreu|veritas)/i.test(clean)) {
          result.proveedor = clean;
          break;
        }
      }
    }
  }

  // Confianza basada en cantidad de campos encontrados
  let matches = 0;
  if (result.lote) matches++;
  if (result.caducidad) matches++;
  if (result.producto) matches++;
  if (result.peso) matches++;
  result.confianza = Math.min(1, matches / 4);

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get('image') as File | null;

    if (!image) {
      return NextResponse.json({ success: false, error: 'No se recibió imagen' }, { status: 400 });
    }

    const bytes = await image.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = image.type?.includes('png') ? 'png' : 'jpg';
    const filename = `appcc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    await mkdir(UPLOAD_DIR, { recursive: true });
    const filePath = path.join(UPLOAD_DIR, filename);
    await writeFile(filePath, buffer);

    // OCR
    const { text, confidence } = runTesseract(filePath);

    // Limpieza
    try { await require('fs').unlink(filePath); } catch {}

    if (!text) {
      return NextResponse.json(
        { success: false, error: 'No se pudo extraer texto de la imagen. Asegúrate de que la etiqueta sea legible.' },
        { status: 422 }
      );
    }

    const parsed = parseLabel(text);

    // Buscar ingrediente por nombre
    let ingredientId: string | null = null;
    if (parsed.producto) {
      const names = [parsed.producto.toLowerCase()];
      const result = await query(
        `SELECT id, name FROM ingredients WHERE LOWER(name) = ANY($1::text[])`,
        [names]
      );
      if (result.rows.length > 0) {
        ingredientId = result.rows[0].id;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...parsed,
        ingredientId,
        matched: !!ingredientId,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}