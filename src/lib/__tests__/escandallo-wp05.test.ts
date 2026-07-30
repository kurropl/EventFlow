/**
 * WP-05 — Tests del cálculo de coste del escandallo
 *
 * Fórmula: coste = qty_base × pax × coste_unitario_base
 * Verifica: función pura computeEscandalloCost, classifyIngredient, computeLineCost
 */
import { describe, it, expect } from 'vitest';
import {
  computeEscandalloCost,
  classifyIngredient,
  computeLineCost,
} from '@/domain/escandallo';

describe('WP-05 — classifyIngredient', () => {
  it('bebida → beverage', () => {
    expect(classifyIngredient('bebida')).toBe('beverage');
    expect(classifyIngredient('Bebidas')).toBe('beverage');
    expect(classifyIngredient('bar')).toBe('beverage');
    expect(classifyIngredient('vino')).toBe('beverage');
    expect(classifyIngredient('coctel')).toBe('beverage');
  });

  it('food → food', () => {
    expect(classifyIngredient('carne')).toBe('food');
    expect(classifyIngredient('pescado')).toBe('food');
    expect(classifyIngredient('arroz')).toBe('food');
    expect(classifyIngredient('postre')).toBe('food');
    expect(classifyIngredient('sorbete')).toBe('food');
  });

  it('null/undefined → other', () => {
    expect(classifyIngredient(null)).toBe('other');
    expect(classifyIngredient(undefined)).toBe('other');
    expect(classifyIngredient('')).toBe('other');
  });

  it('categoría desconocida → food', () => {
    expect(classifyIngredient('otra-categoria')).toBe('food');
  });
});

describe('WP-05 — computeLineCost (fórmula pura)', () => {
  it('3 ingredientes × 100 pax × coste unitario → cuadra a mano', () => {
    // Ingrediente 1: 500g × 100 pax × 0.04 €/g = 2000 €
    expect(computeLineCost(500, 100, 0.04)).toBe(2000);
    // Ingrediente 2: 200g × 100 pax × 0.02 €/g = 400 €
    expect(computeLineCost(200, 100, 0.02)).toBe(400);
    // Ingrediente 3: 150ml × 100 pax × 0.01 €/ml = 150 €
    expect(computeLineCost(150, 100, 0.01)).toBe(150);
  });

  it('pax = 0 o negativo → usa 1 como mínimo', () => {
    expect(computeLineCost(100, 0, 0.05)).toBe(5);
    expect(computeLineCost(100, -5, 0.05)).toBe(5);
  });

  it('coste_unitario = 0 → 0 (ingrediente sin precio)', () => {
    expect(computeLineCost(500, 100, 0)).toBe(0);
  });

  it('qty_base = 0 → 0', () => {
    expect(computeLineCost(0, 100, 0.05)).toBe(0);
  });

  it('redondea a céntimos (sin ruido de coma flotante)', () => {
    // 1.333g × 3 pax × 0.003 €/g = 0.011997 → 0.01
    expect(computeLineCost(1.333, 3, 0.003)).toBe(0.01);
    // 0.1g × 7 pax × 0.15 €/g = 0.105 → 0.11
    expect(computeLineCost(0.1, 7, 0.15)).toBe(0.11);
  });
});

describe('WP-05 — computeEscandalloCost (función principal)', () => {
  it('fixture: receta de 3 ingredientes, 100 pax, cuadra a mano', () => {
    const lines = [
      { qty_base: 500, unit_cost: 0.04, dish_category: 'carne' },     // 500×100×0.04 = 2000
      { qty_base: 200, unit_cost: 0.02, dish_category: 'pescado' },   // 200×100×0.02 = 400
      { qty_base: 150, unit_cost: 0.01, dish_category: 'bebida' },    // 150×100×0.01 = 150
    ];

    const result = computeEscandalloCost(lines, 100, 0, 0);

    expect(result.food_cost).toBe(2400);       // 2000 + 400
    expect(result.beverage_cost).toBe(150);     // solo ingrediente bebida
    expect(result.bar_service_cost).toBe(0);    // sin barra libre
    expect(result.total_cost).toBe(2550);       // 2400 + 150
    expect(result.cost_per_pax).toBe(25.5);     // 2550 / 100
    expect(result.lines).toHaveLength(3);
    expect(result.lines[0].category).toBe('food');
    expect(result.lines[2].category).toBe('beverage');
  });

  it('barra libre se suma a beverage_cost', () => {
    const lines = [
      { qty_base: 100, unit_cost: 0.05, dish_category: 'carne' },  // 100×50×0.05 = 250
    ];

    const result = computeEscandalloCost(lines, 50, 16, 2); // bar: 16€/h × 2h = 32€

    expect(result.food_cost).toBe(250);
    expect(result.bar_service_cost).toBe(32);
    expect(result.beverage_cost).toBe(32);      // solo barra libre (sin ingredientes bebida)
    expect(result.total_cost).toBe(282);         // 250 + 32
    expect(result.cost_per_pax).toBe(5.64);      // 282 / 50
  });

  it('mixto: ingredientes food + beverage + barra libre', () => {
    const lines = [
      { qty_base: 300, unit_cost: 0.03, dish_category: 'carne' },     // 300×80×0.03 = 720
      { qty_base: 100, unit_cost: 0.02, dish_category: 'vino' },      // 100×80×0.02 = 160
    ];

    const result = computeEscandalloCost(lines, 80, 10, 3); // bar: 10×3 = 30

    expect(result.food_cost).toBe(720);
    expect(result.bar_service_cost).toBe(30);
    expect(result.beverage_cost).toBe(190);     // 160 + 30
    expect(result.total_cost).toBe(910);        // 720 + 190
    expect(result.cost_per_pax).toBe(11.38);    // 910 / 80
  });

  it('sin ingredientes, solo barra libre', () => {
    const result = computeEscandalloCost([], 50, 18, 3);

    expect(result.food_cost).toBe(0);
    expect(result.bar_service_cost).toBe(54);    // 18 × 3
    expect(result.beverage_cost).toBe(54);
    expect(result.total_cost).toBe(54);
    expect(result.cost_per_pax).toBe(1.08);     // 54 / 50
  });

  it('pax = 1 (evento individual)', () => {
    const lines = [
      { qty_base: 50, unit_cost: 0.1, dish_category: 'arroz' },
    ];
    const result = computeEscandalloCost(lines, 1, 0, 0);
    expect(result.total_cost).toBe(5);          // 50 × 1 × 0.1
    expect(result.cost_per_pax).toBe(5);
  });

  it('sin categoría → other, no contabiliza en food ni beverage', () => {
    const lines = [
      { qty_base: 100, unit_cost: 0.05, dish_category: null },
    ];
    const result = computeEscandalloCost(lines, 10, 0, 0);
    expect(result.food_cost).toBe(0);
    expect(result.beverage_cost).toBe(0);
    // La línea se incluye en lines pero no suma a food ni beverage
    expect(result.lines[0].category).toBe('other');
    expect(result.lines[0].line_cost).toBe(50);  // 100×10×0.05
  });
});
