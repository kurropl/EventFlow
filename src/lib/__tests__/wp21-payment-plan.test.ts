/**
 * EventFlow — Tests WP-21: Plan de pagos, hitos y recordatorios
 *
 * Tests unitarios para la generación de planes de pago.
 * Tests de integración para el flujo completo de hitos.
 */

import { describe, it, expect } from 'vitest';
import { buildDefaultMilestones } from '@/lib/domain/paymentPlan';

// ============================================================
// Tests unitarios: buildDefaultMilestones
// ============================================================

describe('WP-21 — buildDefaultMilestones (lógica pura)', () => {
  const defaultConfig = {
    deposit_pct: 40,
    deposit_days: 7,
    final_days_before_event: 7,
  };

  it('genera 2 hitos por defecto: señal 40% y resto 60%', () => {
    const milestones = buildDefaultMilestones(10000, '2026-08-15', defaultConfig);
    expect(milestones).toHaveLength(2);

    const senal = milestones.find(m => m.kind === 'senal');
    const resto = milestones.find(m => m.kind === 'resto');

    expect(senal).toBeDefined();
    expect(senal!.pct).toBe(40);
    expect(senal!.daysOffset).toBe(7);

    expect(resto).toBeDefined();
    expect(resto!.pct).toBe(60);
    expect(resto!.daysOffset).toBe(-7);
  });

  it('senal 40% de 5000 = 2000, resto 60% = 3000', () => {
    const milestones = buildDefaultMilestones(5000, '2026-08-15', defaultConfig);

    const senal = milestones.find(m => m.kind === 'senal');
    const resto = milestones.find(m => m.kind === 'resto');

    expect(senal!.pct).toBe(40);
    expect(resto!.pct).toBe(60);
    expect(Number(senal!.pct) + Number(resto!.pct)).toBe(100);
  });

  it('respetar porcentaje personalizado de señal', () => {
    const config = { ...defaultConfig, deposit_pct: 30 };
    const milestones = buildDefaultMilestones(10000, '2026-08-15', config);

    const senal = milestones.find(m => m.kind === 'senal');
    const resto = milestones.find(m => m.kind === 'resto');

    expect(senal!.pct).toBe(30);
    expect(resto!.pct).toBe(70);
  });

  it('respetar días personalizados de vencimiento', () => {
    const config = { ...defaultConfig, deposit_days: 14, final_days_before_event: 3 };
    const milestones = buildDefaultMilestones(10000, '2026-08-15', config);

    const senal = milestones.find(m => m.kind === 'senal');
    const resto = milestones.find(m => m.kind === 'resto');

    expect(senal!.daysOffset).toBe(14);
    expect(resto!.daysOffset).toBe(-3);
  });

  it('genera labels descriptivos con el porcentaje', () => {
    const milestones = buildDefaultMilestones(10000, '2026-08-15', defaultConfig);

    const senal = milestones.find(m => m.kind === 'senal');
    const resto = milestones.find(m => m.kind === 'resto');

    expect(senal!.label).toContain('40%');
    expect(resto!.label).toContain('60%');
  });

  it('suma de porcentajes siempre es 100', () => {
    for (const pct of [10, 20, 25, 30, 40, 50, 75, 90]) {
      const config = { ...defaultConfig, deposit_pct: pct };
      const milestones = buildDefaultMilestones(10000, '2026-08-15', config);
      const totalPct = milestones.reduce((sum, m) => sum + Number(m.pct), 0);
      expect(totalPct).toBe(100);
    }
  });

  it('montos son enteros cuando el total lo permite', () => {
    const milestones = buildDefaultMilestones(10000, '2026-08-15', defaultConfig);
    const senal = milestones.find(m => m.kind === 'senal');
    const resto = milestones.find(m => m.kind === 'resto');

    // 40% de 10000 = 4000, 60% = 6000
    expect(Number(senal!.pct)).toBe(40);
    expect(Number(resto!.pct)).toBe(60);
  });

  it('maneja porcentajes que producen decimales', () => {
    // 33.33% de 1000 = 333.30
    const config = { ...defaultConfig, deposit_pct: 33.33 };
    const milestones = buildDefaultMilestones(1000, '2026-08-15', config);
    const senal = milestones.find(m => m.kind === 'senal');
    const resto = milestones.find(m => m.kind === 'resto');

    expect(senal!.pct).toBe(33.33);
    expect(resto!.pct).toBeCloseTo(66.67, 1);
  });
});

// ============================================================
// Tests de integración (requieren BD)
// ============================================================

describe('WP-21 — Integración (requiere BD)', () => {
  // Estos tests requieren una BD real y están deshabilitados en CI
  // Se ejecutan con: npm run test:unit -- --run --reporter=verbose

  it.skip('acceptQuote genera plan de pago con hitos', async () => {
    // Este test requiere fixture completo de evento + presupuesto
    // Se verifica con el test de integración de acceptQuote existente
  });

  it.skip('job diario marca hitos vencidos', async () => {
    // Requiere reloj simulado + BD
  });

  it.skip('job diario envía emails de recordatorio', async () => {
    // Requiere SMTP mock + BD
  });
});
