/**
 * EventFlow — Parser de códigos GS1-128 / EAN (Sprint 6, F1.1, acta de cocina)
 *
 * Interpreta el texto crudo devuelto por el escáner (html5-qrcode) para
 * auto-rellenar lote y caducidad al recibir mercancía — antes el escáner
 * solo volcaba el texto sin procesar en un campo aparte, sin rellenar nada.
 *
 * Cubre los Identificadores de Aplicación (AI) más relevantes para
 * recepción de alimentos:
 *   (01) GTIN            — 14 dígitos, longitud fija
 *   (10) Lote/Batch       — alfanumérico, longitud variable (hasta 20)
 *   (11) Fecha producción — AAMMDD
 *   (15) Fecha consumo preferente — AAMMDD
 *   (17) Fecha caducidad  — AAMMDD
 * Acepta tanto la forma "legible" con paréntesis, p.ej. "(01)12345678901231(10)L45(17)261231",
 * como el flujo de dígitos crudo típico de una lectura de barras 1D.
 */

const GS = ''; // FNC1 / Group Separator, algunos escáneres lo preservan

export interface ParsedGS1 {
  gtin: string | null;
  lot: string | null;
  productionDate: string | null; // YYYY-MM-DD
  expiryDate: string | null; // YYYY-MM-DD
  bestBeforeDate: string | null; // YYYY-MM-DD
  raw: string;
}

function yymmddToIso(yymmdd: string): string | null {
  if (!/^\d{6}$/.test(yymmdd)) return null;
  const yy = parseInt(yymmdd.slice(0, 2), 10);
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  // GS1: 00-50 -> 20xx, 51-99 -> 19xx (irrelevante en la práctica alimentaria)
  const yyyy = yy <= 50 ? 2000 + yy : 1900 + yy;
  if (mm === '00') return null; // día del mes desconocido, GS1 permite dd=00
  return `${yyyy}-${mm}-${dd === '00' ? '01' : dd}`;
}

/** Forma legible: "(01)xxxx(10)LOTE(17)261231" */
function parseBracketed(text: string): ParsedGS1 | null {
  const matches = [...text.matchAll(/\((\d{2,4})\)([^\(]+)/g)];
  if (matches.length === 0) return null;
  const result: ParsedGS1 = { gtin: null, lot: null, productionDate: null, expiryDate: null, bestBeforeDate: null, raw: text };
  for (const m of matches) {
    const ai = m[1];
    const value = m[2].trim();
    if (ai === '01') result.gtin = value.slice(0, 14);
    else if (ai === '10') result.lot = value;
    else if (ai === '11') result.productionDate = yymmddToIso(value.slice(0, 6));
    else if (ai === '15') result.bestBeforeDate = yymmddToIso(value.slice(0, 6));
    else if (ai === '17') result.expiryDate = yymmddToIso(value.slice(0, 6));
  }
  return result;
}

/** Flujo de dígitos crudo (sin paréntesis), con o sin separador GS embebido. */
function parseRawDigitStream(text: string): ParsedGS1 | null {
  if (!/^\d/.test(text)) return null;
  const result: ParsedGS1 = { gtin: null, lot: null, productionDate: null, expiryDate: null, bestBeforeDate: null, raw: text };
  let rest = text;
  let matchedAny = false;

  while (rest.length >= 2) {
    const ai2 = rest.slice(0, 2);
    const ai3 = rest.slice(0, 3);
    const ai4 = rest.slice(0, 4);

    if (ai2 === '01' && rest.length >= 16) {
      result.gtin = rest.slice(2, 16);
      rest = rest.slice(16);
      matchedAny = true;
    } else if (ai2 === '11' && rest.length >= 8) {
      result.productionDate = yymmddToIso(rest.slice(2, 8));
      rest = rest.slice(8);
      matchedAny = true;
    } else if (ai2 === '15' && rest.length >= 8) {
      result.bestBeforeDate = yymmddToIso(rest.slice(2, 8));
      rest = rest.slice(8);
      matchedAny = true;
    } else if (ai2 === '17' && rest.length >= 8) {
      result.expiryDate = yymmddToIso(rest.slice(2, 8));
      rest = rest.slice(8);
      matchedAny = true;
    } else if (ai2 === '10') {
      // Longitud variable — termina en GS explícito o al final de la cadena.
      const body = rest.slice(2);
      const gsIdx = body.indexOf(GS);
      const lot = gsIdx >= 0 ? body.slice(0, gsIdx) : body;
      result.lot = lot.slice(0, 20);
      rest = gsIdx >= 0 ? body.slice(gsIdx + 1) : '';
      matchedAny = true;
    } else if (ai3 === '310' || ai4.startsWith('310')) {
      // Peso neto (31xx) — longitud fija 6 dígitos tras el AI de 4 (indicador decimal incluido)
      if (rest.length >= 10) { rest = rest.slice(10); matchedAny = true; } else break;
    } else {
      // AI desconocido/no soportado: no podemos seguir de forma fiable.
      break;
    }
  }
  return matchedAny ? result : null;
}

/**
 * Interpreta el texto de un escaneo. Devuelve null si no reconoce ningún
 * patrón GS1 — en ese caso el texto crudo se conserva tal cual (comportamiento
 * previo: se guarda en qr_code sin más).
 */
export function parseGS1(text: string): ParsedGS1 | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  return parseBracketed(trimmed) || parseRawDigitStream(trimmed);
}
