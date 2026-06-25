/**
 * EventFlow — Tests del import de recetas (FR-C10)
 */
import { describe, it, expect } from 'vitest';
import {
  detectColumns, normalizeUnit, normalizeCategory, grossFromNet, parseRows,
} from '../recipeImport';

describe('detectColumns', () => {
  it('detecta cabeceras en español e inglés', () => {
    const m = detectColumns(['Plato', 'Categoría', 'Ingrediente', 'Cantidad', 'Unidad', 'Merma_%', 'Notas']);
    expect(m.plato).toBe('Plato');
    expect(m.ingrediente).toBe('Ingrediente');
    expect(m.cantidad).toBe('Cantidad');
    expect(m.merma).toBe('Merma_%');
  });
});

describe('normalizeUnit', () => {
  it('normaliza alias a unidad canónica', () => {
    expect(normalizeUnit('gr')).toBe('g');
    expect(normalizeUnit('Kilos')).toBe('kg');
    expect(normalizeUnit('litros')).toBe('l');
    expect(normalizeUnit('unidades')).toBe('ud');
    expect(normalizeUnit('docena')).toBe('doc');
  });
  it('vacío → g; desconocida → null', () => {
    expect(normalizeUnit('')).toBe('g');
    expect(normalizeUnit('cucharada')).toBeNull();
  });
});

describe('normalizeCategory', () => {
  it('válida se mantiene; inválida → complemento', () => {
    expect(normalizeCategory('carne')).toBe('carne');
    expect(normalizeCategory('foo')).toBe('complemento');
  });
});

describe('grossFromNet — merma (bruto vs neto)', () => {
  it('1000 g netos con 20% merma → 1250 g brutos', () => {
    expect(grossFromNet(1000, 20)).toBe(1250);
  });
  it('sin merma → igual', () => {
    expect(grossFromNet(200, 0)).toBe(200);
  });
  it('clamp de merma a 99%', () => {
    expect(grossFromNet(100, 150)).toBe(grossFromNet(100, 99));
  });
});

describe('parseRows', () => {
  const cols = { plato: 'plato', categoria: 'categoria', ingrediente: 'ingrediente', cantidad: 'cantidad', unidad: 'unidad', merma: 'merma' };
  it('agrupa por plato y aplica merma', () => {
    const rows = [
      { plato: 'Solomillo', categoria: 'carne', ingrediente: 'Solomillo', cantidad: 200, unidad: 'g', merma: 15 },
      { plato: 'Solomillo', categoria: 'carne', ingrediente: 'Sal', cantidad: 2, unidad: 'g', merma: 0 },
    ];
    const r = parseRows(rows, cols);
    expect(r).toHaveLength(1);
    expect(r[0].plato).toBe('Solomillo');
    expect(r[0].lineas).toHaveLength(2);
    expect(r[0].lineas[0].cantidad_bruta).toBe(grossFromNet(200, 15));
  });
  it('marca errores de cantidad/unidad', () => {
    const rows = [{ plato: 'X', categoria: 'carne', ingrediente: 'Y', cantidad: 0, unidad: 'cucharada', merma: 0 }];
    const r = parseRows(rows, cols);
    expect(r[0].lineas[0].errores.length).toBeGreaterThan(0);
  });
});
