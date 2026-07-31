/**
 * EventFlow — Tests TDD: Dashboard Cocina
 *
 * Verifica que el Dashboard API devuelve KPIs correctos
 * con los nombres de columna reales de la BD.
 */

import { describe, it, expect, beforeAll } from 'vitest';

const API_BASE = 'http://localhost:3020';
let token = '';

beforeAll(async () => {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  const data = await res.json();
  token = data.token || '';
});

describe('Cocina Dashboard API', () => {
  it('devuelve KPIs con campos correctos', async () => {
    const res = await fetch(`${API_BASE}/api/cocina/dashboard`, {
      headers: { Cookie: `eventflow_token=${token}` },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.kpis).toBeDefined();
    expect(typeof json.data.kpis.recetas_activas).toBe('number');
    expect(typeof json.data.kpis.escandallos_activos).toBe('number');
    expect(typeof json.data.kpis.produccion_hoy).toBe('number');
    expect(typeof json.data.kpis.eventos_semana).toBe('number');
    expect(typeof json.data.kpis.pax_semana).toBe('number');
  });

  it('recetas_activas es un numero positivo', async () => {
    const res = await fetch(`${API_BASE}/api/cocina/dashboard`, {
      headers: { Cookie: `eventflow_token=${token}` },
    });
    const json = await res.json();
    expect(json.data.kpis.recetas_activas).toBeGreaterThan(0);
  });

  it('no usa columnas incorrectas (e.name, e.pax)', async () => {
    const res = await fetch(`${API_BASE}/api/cocina/dashboard`, {
      headers: { Cookie: `eventflow_token=${token}` },
    });
    expect(res.status).toBe(200);
    // Si la API no lanza error, las columnas son correctas
  });

  it('devuelve 401 sin autenticacion', async () => {
    const res = await fetch(`${API_BASE}/api/cocina/dashboard`);
    expect(res.status).toBe(401);
  });
});
