/**
 * EventFlow — Import de recetas (Excel/CSV) → desglose de componentes  ·  FR-C10
 *
 * Plantilla (una fila por componente):
 *   plato | categoría | ingrediente | cantidad | unidad | merma_% | notas
 *
 * Alimenta `recipe_items` (catalog_item → ingredient_id → quantity), la estructura
 * canónica del escandallo (FR-S05: ingrediente único por id). Aquí van las partes
 * PURAS (sin BD): detección de columnas, normalización de unidades y merma.
 */

/** Categorías válidas de catalog_items (CHECK del esquema). */
export const CATALOG_CATEGORIES = [
  'aperitivo-frio', 'aperitivo-caliente', 'compartir-mesa', 'carne', 'pescado',
  'arroz', 'sorbete', 'postre', 'bebida', 'complemento',
] as const;

/** Unidades canónicas aceptadas en el import (se normalizan a estas). */
const UNIT_ALIASES: Record<string, string> = {
  g: 'g', gr: 'g', gramo: 'g', gramos: 'g',
  kg: 'kg', kilo: 'kg', kilos: 'kg', kilogramo: 'kg',
  ml: 'ml', mililitro: 'ml', mililitros: 'ml', cc: 'ml',
  l: 'l', litro: 'l', litros: 'l', lt: 'l',
  ud: 'ud', un: 'ud', uds: 'ud', unidad: 'ud', unidades: 'ud', u: 'ud',
  doc: 'doc', docena: 'doc', docenas: 'doc',
};

export interface ImportColumnMap {
  plato?: string; categoria?: string; ingrediente?: string;
  cantidad?: string; unidad?: string; merma?: string; notas?: string;
}

const COLUMN_ALIASES: Record<keyof ImportColumnMap, string[]> = {
  plato: ['plato', 'nombre', 'name', 'receta', 'dish'],
  categoria: ['categoria', 'categoría', 'category', 'cat'],
  ingrediente: ['ingrediente', 'ingredient', 'componente'],
  cantidad: ['cantidad', 'quantity', 'qty', 'cant'],
  unidad: ['unidad', 'unit', 'medida', 'um'],
  merma: ['merma', 'merma_%', 'merma%', 'waste', 'perdida', 'pérdida'],
  notas: ['notas', 'notes', 'nota', 'observaciones'],
};

/** Detecta el mapeo de columnas a partir de las cabeceras del Excel. */
export function detectColumns(headers: string[]): ImportColumnMap {
  const map: ImportColumnMap = {};
  for (const header of headers) {
    const hl = String(header).toLowerCase().trim();
    for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (map[key as keyof ImportColumnMap]) continue;
      if (aliases.some((a) => hl === a || hl.includes(a))) {
        map[key as keyof ImportColumnMap] = header;
        break;
      }
    }
  }
  return map;
}

/** Normaliza una unidad del Excel a la canónica; null si no se reconoce. */
export function normalizeUnit(raw: unknown): string | null {
  const u = String(raw ?? '').toLowerCase().trim().replace(/\.$/, '');
  if (!u) return 'g';
  return UNIT_ALIASES[u] ?? null;
}

/** Categoría válida o 'complemento' (catch-all) si no encaja. */
export function normalizeCategory(raw: unknown): string {
  const c = String(raw ?? '').toLowerCase().trim();
  return (CATALOG_CATEGORIES as readonly string[]).includes(c) ? c : 'complemento';
}

/**
 * Cantidad bruta a comprar a partir de la neta y la merma % (peso bruto vs neto).
 *   bruto = neto / (1 − merma/100)
 * Ej.: 1000 g netos con 20% de merma → 1250 g brutos.
 */
export function grossFromNet(net: number, mermaPct: number): number {
  const n = Number(net) || 0;
  const m = Math.min(Math.max(Number(mermaPct) || 0, 0), 99); // 0..99%
  if (m === 0) return Math.round(n * 1000) / 1000;
  return Math.round((n / (1 - m / 100)) * 1000) / 1000;
}

export interface ParsedLine {
  ingrediente: string;
  cantidad_neta: number;
  cantidad_bruta: number;   // con merma aplicada
  unidad: string | null;    // null = no reconocida
  merma_pct: number;
  notas: string | null;
  errores: string[];
}
export interface ParsedRecipe {
  plato: string;
  categoria: string;
  lineas: ParsedLine[];
}

/** Agrupa las filas del Excel en recetas (plato → líneas), aplicando merma. */
export function parseRows(rows: Record<string, any>[], cols: ImportColumnMap): ParsedRecipe[] {
  const byDish = new Map<string, ParsedRecipe>();
  for (const row of rows) {
    const plato = String(cols.plato ? row[cols.plato] ?? '' : '').trim();
    const ingrediente = String(cols.ingrediente ? row[cols.ingrediente] ?? '' : '').trim();
    if (!plato || !ingrediente) continue;

    if (!byDish.has(plato)) {
      byDish.set(plato, {
        plato,
        categoria: normalizeCategory(cols.categoria ? row[cols.categoria] : ''),
        lineas: [],
      });
    }
    const neta = cols.cantidad ? Number(row[cols.cantidad]) || 0 : 0;
    const merma = cols.merma ? Number(row[cols.merma]) || 0 : 0;
    const unidad = normalizeUnit(cols.unidad ? row[cols.unidad] : 'g');
    const errores: string[] = [];
    if (neta <= 0) errores.push('cantidad inválida');
    if (unidad === null) errores.push(`unidad no reconocida: "${cols.unidad ? row[cols.unidad] : ''}"`);

    byDish.get(plato)!.lineas.push({
      ingrediente,
      cantidad_neta: neta,
      cantidad_bruta: grossFromNet(neta, merma),
      unidad,
      merma_pct: merma,
      notas: cols.notas ? String(row[cols.notas] ?? '').trim() || null : null,
      errores,
    });
  }
  return [...byDish.values()];
}
