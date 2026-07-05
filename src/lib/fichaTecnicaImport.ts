/**
 * EventFlow — Import de ficha técnica individual (Excel)
 *
 * A diferencia del import masivo de src/lib/recipeImport.ts (fila por
 * ingrediente, detección de columnas por cabecera), esta plantilla es de
 * diseño fijo — una hoja "PLANTILLA GENERICA" por plato, réplica de
 * PLANTILLA_FICHA_TECNICA_AUTOMATIZADA.xlsx — así que se lee por
 * coordenada de celda, no por cabecera.
 *
 * Layout (fijo):
 *   B2            nombre del plato
 *   H3:H20        elaboración (una línea por fila, fusionada o no)
 *   B8:F22        líneas de ingrediente (cantidad/medida/ingrediente/precio unitario)
 *   B5 / D5       peso total (calculado) / raciones (calculado por Excel:
 *                 =peso_total / peso_por_ración) — se recupera peso_por_ración
 *                 dividiendo B5 entre D5 en vez de parsear la fórmula de D5,
 *                 porque el cliente a veces divide por un número literal
 *                 (=B5/0.01) y a veces por C5 — el resultado cacheado de D5
 *                 es fiable en ambos casos.
 *   F24           merma y costes adicionales (fracción, p.ej. 0.2 = 20%)
 *   F28           precio venta al público final (o el placeholder "?" si no se fijó)
 *   I22:J30 / H22:J30  alérgenos (una línea por fila, o un único bloque)
 *   E5            "AUTOR : <nombre>"
 */

export interface ParsedFichaLine {
  ingrediente: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number | null;
}

export interface ParsedFichaTecnica {
  name: string;
  instructions: string | null;
  lineas: ParsedFichaLine[];
  pesoRacion: number | null;
  mermaPct: number;
  pvp: number | null;
  allergens: string | null;
  author: string | null;
  errores: string[];
}

/** Célula genérica: cualquier objeto con `.v` (valor/cached), como las que
 *  devuelve la librería `xlsx` (SheetJS) para cada dirección de celda. */
export type CellGetter = (addr: string) => { v?: unknown } | undefined;

function str(cell: { v?: unknown } | undefined): string {
  if (!cell || cell.v == null) return '';
  return String(cell.v).trim();
}

function num(cell: { v?: unknown } | undefined): number | null {
  if (!cell || cell.v == null) return null;
  const n = Number(cell.v);
  return Number.isFinite(n) ? n : null;
}

export function parseFichaTecnica(get: CellGetter): ParsedFichaTecnica {
  const errores: string[] = [];

  const name = str(get('B2'));
  if (!name) errores.push('B2 (nombre del plato) está vacío');
  // "RECETA"/"PASTA ESPEJO" etc. — la propia plantilla vacía deja "RECETA"
  // literal en B2; si no se ha rellenado con un nombre real, avisar.
  if (name.toUpperCase() === 'RECETA') errores.push('B2 sigue en el valor de plantilla ("RECETA"), no se ha puesto el nombre del plato');

  // Elaboración: una línea por fila entre H3 y H20 (fusionadas o no).
  const instructionLines: string[] = [];
  for (let row = 3; row <= 20; row++) {
    const v = str(get(`H${row}`));
    if (v) instructionLines.push(v);
  }
  const instructions = instructionLines.length ? instructionLines.join('\n') : null;

  // Líneas de ingrediente: B8:F22 (cantidad/medida/ingrediente/precio unitario).
  const lineas: ParsedFichaLine[] = [];
  for (let row = 8; row <= 22; row++) {
    const ingrediente = str(get(`D${row}`));
    if (!ingrediente) continue;
    const cantidad = num(get(`B${row}`));
    const unidad = str(get(`C${row}`)).toLowerCase() || 'g';
    if (cantidad == null || cantidad <= 0) {
      errores.push(`Fila ${row}: "${ingrediente}" sin cantidad válida`);
      continue;
    }
    // Precio unitario (columna E): se usa para fijar el coste de un
    // ingrediente NUEVO al importar — si el ingrediente ya existe en la
    // base de datos, se respeta su precio actual (puede venir de Stock/OCR
    // y ser más reciente que lo que diga esta ficha en concreto).
    const precioUnitario = num(get(`E${row}`));
    lineas.push({ ingrediente, cantidad, unidad, precioUnitario });
  }
  if (lineas.length === 0) errores.push('No se encontró ninguna línea de ingrediente válida (B8:F22)');

  // Peso por ración: se recupera de B5 (peso total) ÷ D5 (raciones, ya
  // calculado por Excel) — fiable tanto si D5 divide por C5 como por un
  // número literal escrito directamente en la fórmula.
  const pesoTotal = num(get('B5'));
  const raciones = num(get('D5'));
  const pesoRacion = pesoTotal && raciones && raciones > 0 ? Math.round((pesoTotal / raciones) * 10000) / 10000 : null;
  if (pesoRacion == null) errores.push('No se pudo derivar el peso por ración (B5/D5) — revisa que D5 tenga un valor calculado');

  // Merma: F24 se guarda como fracción (0.2 = 20%) con formato de %.
  const mermaRaw = num(get('F24'));
  const mermaPct = mermaRaw != null ? Math.round(mermaRaw * 10000) / 100 : 20;

  // Precio de venta: F28 puede ser el placeholder "?" (no fijado aún).
  const pvpCell = get('F28');
  const pvp = pvpCell && typeof pvpCell.v === 'number' ? pvpCell.v : null;

  // Alérgenos: una línea por fila, columnas H/I/J, filas 22-30 (el bloque
  // fusionado H22:J30 del máster o filas sueltas como en la ficha real).
  const allergenLines: string[] = [];
  for (let row = 22; row <= 30; row++) {
    for (const col of ['H', 'I', 'J']) {
      const v = str(get(`${col}${row}`));
      if (v) allergenLines.push(v);
    }
  }
  const allergens = allergenLines.length ? allergenLines.join(', ') : null;

  // Autor: "    AUTOR : <nombre>" en E5.
  const authorRaw = str(get('E5'));
  const authorMatch = authorRaw.match(/AUTOR\s*:\s*(.+)/i);
  const author = authorMatch && authorMatch[1].trim() ? authorMatch[1].trim() : null;

  return { name, instructions, lineas, pesoRacion, mermaPct, pvp, allergens, author, errores };
}
