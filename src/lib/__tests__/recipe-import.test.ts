/**
 * EventFlow — Tests TDD: Importación de Recetas desde Excel
 * Solo tests de parser (unitarios). Los de integración requieren rebuild.
 */

import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseRecipeExcel } from '@/lib/domain/recipeImport';

const R = (cols: [number, any][]) => {
  const a: any[] = Array(13).fill(null);
  cols.forEach(([i, v]) => a[i] = v);
  return a;
};

// Columnas en sheet_to_json: A=0, B=1, C=2, D=3, E=4, F=5, G=6, H=7, I=8
// El Excel real tiene datos desde col B, pero sheet_to_json las devuelve desde 0

describe('Recipe Import - Parser', () => {
  it('parsea un Excel con datos de ejemplo', () => {
    const wb = XLSX.utils.book_new();
    const data = [
      R([]),                    // row 1
      R([[0,'Croquetas de Jamón'],[3,'LOGO']]),  // row 2: B=recipe name (col 0)
      R([]), R([]),             // rows 3-4
      R([[0,0],[1,'<PESO>'],[2,'#DIV/0!'],[3,'AUTOR: Chef Juan']]), // row 5
      R([]),                    // row 6
      R([[0,'CANT'],[1,'MEDIDA'],[2,'INGREDIENTE'],[3,'PRECIO_U'],[4,'PRECIO_T']]), // row 7
      R([[0,30],[1,'g'],[2,'jamon iberico'],[3,0.05],[4,1.5]]),   // row 8
      R([[0,80],[1,'g'],[2,'bechamel'],[3,0.02],[4,1.6]]),       // row 9
      R([[0,20],[1,'g'],[2,'harina'],[3,0.01],[4,0.2]]),         // row 10
      R([[0,1],[1,'ud'],[2,'huevo'],[3,0.15],[4,0.15]]),         // row 11
      R([[0,15],[1,'g'],[2,'pan rallado'],[3,0.01],[4,0.15]]),   // row 12
      R([]), R([]), R([]), R([]), R([]), R([]), R([]), R([]), R([]), // rows 13-20
      R([[7,'gluten, lacteos, huevo']]),         // row 21: I=allergens (col 7)
      R([]),                    // row 22
      R([[0,'COSTE TOTAL MP'],[4,3.6]]),    // row 23: E=cost (col 4)
      R([[0,'MERMA'],[4,0.2]]),            // row 24: E=merma%
      R([[0,'COSTE TOTAL'],[4,4.32]]),     // row 25
      R([[0,'COSTE UNITARIO'],[4,'#DIV/0!']]),  // row 26
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'PLANTILLA GENERICA');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const result = parseRecipeExcel(buffer);
    expect(result.name).toBe('Croquetas de Jamón');
    expect(result.author).toContain('Chef Juan');
    expect(result.ingredients.length).toBe(5);
    expect(result.ingredients[0].name).toBe('jamon iberico');
    expect(result.ingredients[0].quantity).toBe(30);
    expect(result.ingredients[0].unit).toBe('g');
    expect(result.allergens).toContain('gluten, lacteos, huevo');
    expect(result.mermaPct).toBe(0.2);
  });

  it('devuelve ingredientes vacios para Excel sin datos', () => {
    const wb = XLSX.utils.book_new();
    const data = [R([]), R([[0,'Receta Vacia']])];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'PLANTILLA GENERICA');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const result = parseRecipeExcel(buffer);
    expect(result.name.length).toBeGreaterThan(0);  // may be default or parsed
    expect(result.ingredients.length).toBe(0);
  });
});