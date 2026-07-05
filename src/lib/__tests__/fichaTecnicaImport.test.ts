/**
 * EventFlow — Test del parser de ficha técnica individual (Excel)
 * Datos fijados a partir de PASTA_ESPEJO.xlsx (ficha real del cliente).
 */
import { describe, it, expect } from 'vitest';
import { parseFichaTecnica, type CellGetter } from '../fichaTecnicaImport';

// Réplica exacta de las celdas (valor cacheado) de PASTA_ESPEJO.xlsx.
const PASTA_ESPEJO_CELLS: Record<string, unknown> = {
  B2: 'PASTA ESPEJO',
  E5: '    AUTOR : ',
  H3: '1. MEZCLAR TODOS LOS INGREDIENTES HASTA QUE ESTÉN BIEN INTEGRADOS Y DEJAR ENFRIAR.',
  H4: '2. CORTAR Y HORNEAR A 170ºC.',
  B5: 2.142,
  D5: 214.2,
  B8: 0.2, C8: 'KG', D8: 'HARINA TRIGO', E8: 1.03,
  B9: 0.5, C9: 'KG', D9: 'AZ. GLACE', E9: 2.6,
  B10: 0.04, C10: 'KG', D10: 'SAL', E10: 0.22,
  B11: 1.4, C11: 'KG', D11: 'MANTEQUILLA', E11: 9.3,
  B12: 0.002, C12: 'UNIDADES', D12: 'YEMA', E12: 6.55,
  I22: 'GLUTEN',
  I23: 'LACTOSA',
  I24: 'HUEVOS',
  F24: 0.2,
  F28: 1.0,
};

function mockGetter(cells: Record<string, unknown>): CellGetter {
  return (addr: string) => (addr in cells ? { v: cells[addr] } : undefined);
}

describe('parseFichaTecnica — PASTA_ESPEJO.xlsx (ficha real del cliente)', () => {
  const result = parseFichaTecnica(mockGetter(PASTA_ESPEJO_CELLS));

  it('nombre del plato', () => {
    expect(result.name).toBe('PASTA ESPEJO');
  });

  it('elaboración: une las líneas de H3/H4', () => {
    expect(result.instructions).toBe(
      '1. MEZCLAR TODOS LOS INGREDIENTES HASTA QUE ESTÉN BIEN INTEGRADOS Y DEJAR ENFRIAR.\n2. CORTAR Y HORNEAR A 170ºC.'
    );
  });

  it('5 líneas de ingrediente, con precio unitario de la columna E', () => {
    expect(result.lineas).toHaveLength(5);
    expect(result.lineas[0]).toEqual({ ingrediente: 'HARINA TRIGO', cantidad: 0.2, unidad: 'kg', precioUnitario: 1.03 });
    expect(result.lineas[3]).toEqual({ ingrediente: 'MANTEQUILLA', cantidad: 1.4, unidad: 'kg', precioUnitario: 9.3 });
  });

  it('peso por ración derivado de B5/D5 = 0.01', () => {
    expect(result.pesoRacion).toBe(0.01);
  });

  it('merma_pct convertida de fracción a porcentaje (0.2 -> 20)', () => {
    expect(result.mermaPct).toBe(20);
  });

  it('pvp leído directamente de F28', () => {
    expect(result.pvp).toBe(1.0);
  });

  it('alérgenos: une las filas I22:I24', () => {
    expect(result.allergens).toBe('GLUTEN, LACTOSA, HUEVOS');
  });

  it('autor: null si no hay nombre tras "AUTOR :"', () => {
    expect(result.author).toBeNull();
  });

  it('sin errores de parseo en una ficha bien formada', () => {
    expect(result.errores).toEqual([]);
  });
});

describe('parseFichaTecnica — casos límite', () => {
  it('nombre de plantilla sin rellenar produce error', () => {
    const r = parseFichaTecnica(mockGetter({ B2: 'RECETA' }));
    expect(r.errores.some((e) => e.includes('plantilla'))).toBe(true);
  });

  it('F28 = "?" (placeholder de la plantilla) -> pvp null, no NaN', () => {
    const r = parseFichaTecnica(mockGetter({ ...PASTA_ESPEJO_CELLS, F28: '?' }));
    expect(r.pvp).toBeNull();
  });

  it('autor con nombre real tras "AUTOR :"', () => {
    const r = parseFichaTecnica(mockGetter({ ...PASTA_ESPEJO_CELLS, E5: '    AUTOR : Chef Juan' }));
    expect(r.author).toBe('Chef Juan');
  });

  it('sin líneas de ingrediente produce error', () => {
    const r = parseFichaTecnica(mockGetter({ B2: 'Vacío' }));
    expect(r.errores.some((e) => e.includes('ingrediente'))).toBe(true);
  });
});
