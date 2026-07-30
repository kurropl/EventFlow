/**
 * WP-10 — Tests de trazabilidad por lote
 *
 * Tests de la lógica de la API /api/trazabilidad/lot/[id]:
 *   - Formateo de datos del lote
 *   - Cálculo de resumen de consumo
 *   - Detección de alertas (temperatura, caducidad)
 *   - Validación de UUID
 */

import { describe, it, expect } from 'vitest';

// ── Helpers puros extraídos para testeabilidad ─────────────────

/** Valida formato UUID v4 */
function isValidUUID(uuid: string): boolean {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return UUID_REGEX.test(uuid);
}

/** Calcula el resumen de consumo de un lote */
function computeLotSummary(
  batchQuantity: number,
  consumptions: Array<{ quantity_consumed: number }>,
  unit: string
) {
  const totalConsumed = consumptions.reduce(
    (sum, c) => sum + Number(c.quantity_consumed),
    0
  );
  const remaining = Math.max(0, batchQuantity - totalConsumed);

  return {
    total_received: batchQuantity,
    total_consumed: totalConsumed,
    remaining,
    consumption_count: consumptions.length,
    unit,
  };
}

/** Detecta alerta de temperatura (> 8°C) */
function hasTemperatureAlert(temperature: number | null): boolean {
  return temperature !== null && temperature > 8;
}

/** Detecta alerta de caducidad */
function getExpiryAlert(expiryDate: string | null): 'expired' | 'warning' | null {
  if (!expiryDate) return null;
  const expiry = new Date(expiryDate);
  const now = new Date();

  if (expiry < now) return 'expired';

  const daysUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (daysUntilExpiry < 7) return 'warning';

  return null;
}

/** Formatea fecha para PDF */
function formatDateForPdf(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('es-ES');
}

// ── Tests ─────────────────────────────────────────────────────

describe('WP-10 — trazabilidadLot: validación de UUID', () => {
  it('UUID válido es aceptado', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('UUID con mayúsculas es aceptado', () => {
    expect(isValidUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
  });

  it('UUID inválido es rechazado', () => {
    expect(isValidUUID('not-a-uuid')).toBe(false);
  });

  it('UUID incompleto es rechazado', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false);
  });

  it('String vacío es rechazado', () => {
    expect(isValidUUID('')).toBe(false);
  });
});

describe('WP-10 — trazabilidadLot: cálculo de resumen', () => {
  it('sin consumos: total = recibido, restante = recibido', () => {
    const summary = computeLotSummary(100, [], 'g');
    expect(summary.total_received).toBe(100);
    expect(summary.total_consumed).toBe(0);
    expect(summary.remaining).toBe(100);
    expect(summary.consumption_count).toBe(0);
  });

  it('un consumo: restante = recibido - consumido', () => {
    const summary = computeLotSummary(100, [{ quantity_consumed: 30 }], 'g');
    expect(summary.total_consumed).toBe(30);
    expect(summary.remaining).toBe(70);
  });

  it('múltiples consumos: suma correcta', () => {
    const summary = computeLotSummary(100, [
      { quantity_consumed: 20 },
      { quantity_consumed: 30 },
      { quantity_consumed: 15 },
    ], 'g');
    expect(summary.total_consumed).toBe(65);
    expect(summary.remaining).toBe(35);
    expect(summary.consumption_count).toBe(3);
  });

  it('consumo total excedido: restante se clampa a 0', () => {
    const summary = computeLotSummary(50, [{ quantity_consumed: 60 }], 'g');
    expect(summary.total_consumed).toBe(60);
    expect(summary.remaining).toBe(0);
  });

  it('consumo exacto: restante = 0', () => {
    const summary = computeLotSummary(100, [{ quantity_consumed: 100 }], 'g');
    expect(summary.remaining).toBe(0);
  });

  it('decimales se manejan correctamente', () => {
    const summary = computeLotSummary(10.5, [
      { quantity_consumed: 3.25 },
      { quantity_consumed: 1.75 },
    ], 'kg');
    expect(summary.total_consumed).toBe(5);
    expect(summary.remaining).toBe(5.5);
  });
});

describe('WP-10 — trazabilidadLot: alertas de temperatura', () => {
  it('temperatura null => sin alerta', () => {
    expect(hasTemperatureAlert(null)).toBe(false);
  });

  it('temperatura 4°C => sin alerta', () => {
    expect(hasTemperatureAlert(4)).toBe(false);
  });

  it('temperatura 8°C exacto => sin alerta (límite)', () => {
    expect(hasTemperatureAlert(8)).toBe(false);
  });

  it('temperatura 8.1°C => con alerta', () => {
    expect(hasTemperatureAlert(8.1)).toBe(true);
  });

  it('temperatura 15°C => con alerta', () => {
    expect(hasTemperatureAlert(15)).toBe(true);
  });

  it('temperatura negativa => sin alerta (congelado)', () => {
    expect(hasTemperatureAlert(-18)).toBe(false);
  });
});

describe('WP-10 — trazabilidadLot: alertas de caducidad', () => {
  it('sin fecha de caducidad => null', () => {
    expect(getExpiryAlert(null)).toBe(null);
  });

  it('caducidad en el pasado => expired', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);
    expect(getExpiryAlert(pastDate.toISOString())).toBe('expired');
  });

  it('caducidad hoy => expired', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expect(getExpiryAlert(today.toISOString())).toBe('expired');
  });

  it('caducidad en 3 días => warning', () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 3);
    expect(getExpiryAlert(soon.toISOString())).toBe('warning');
  });

  it('caducidad en 6 días => warning', () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 6);
    expect(getExpiryAlert(soon.toISOString())).toBe('warning');
  });

  it('caducidad en 8 días => null (ok)', () => {
    const future = new Date();
    future.setDate(future.getDate() + 8);
    expect(getExpiryAlert(future.toISOString())).toBe(null);
  });

  it('caducidad en 30 días => null (ok)', () => {
    const future = new Date();
    future.setDate(future.getDate() + 30);
    expect(getExpiryAlert(future.toISOString())).toBe(null);
  });
});

describe('WP-10 — trazabilidadLot: formateo de fechas', () => {
  it('fecha null => "—"', () => {
    expect(formatDateForPdf(null)).toBe('—');
  });

  it('fecha válida se formatea en es-ES', () => {
    const result = formatDateForPdf('2025-01-15T10:30:00Z');
    // El formato exacto depende del locale del sistema, pero debe contener partes de la fecha
    expect(result).not.toBe('—');
    expect(result).toMatch(/\d/);
  });

  it('fecha inválida devuelve el string original', () => {
    expect(formatDateForPdf('not-a-date')).toBe('not-a-date');
  });
});

describe('WP-10 — trazabilidadLot: integración lógica', () => {
  it('lote completo: receiving → consumo → resumen coherente', () => {
    // Simular un lote de 200g de queso recibido
    const batchQuantity = 200;
    const consumptions = [
      { quantity_consumed: 50, event: { client_name: 'Boda García' } },
      { quantity_consumed: 30, event: { client_name: 'Corporativo XYZ' } },
      { quantity_consumed: 20, event: { client_name: 'Cumpleaños López' } },
    ];

    const summary = computeLotSummary(batchQuantity, consumptions, 'g');

    expect(summary.total_received).toBe(200);
    expect(summary.total_consumed).toBe(100);
    expect(summary.remaining).toBe(100);
    expect(summary.consumption_count).toBe(3);
  });

  it('lote con alertas: temperatura + caducidad', () => {
    const temperature = 12;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 2); // Caduca en 2 días

    expect(hasTemperatureAlert(temperature)).toBe(true);
    expect(getExpiryAlert(expiryDate.toISOString())).toBe('warning');
  });

  it('lote OK: sin alertas', () => {
    const temperature = 4;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30); // Caduca en 30 días

    expect(hasTemperatureAlert(temperature)).toBe(false);
    expect(getExpiryAlert(expiryDate.toISOString())).toBe(null);
  });
});
