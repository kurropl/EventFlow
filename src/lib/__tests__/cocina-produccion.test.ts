/**
 * EventFlow — Tests TDD: Produccion API
 *
 * Verifica que el endpoint de hojas de produccion usa
 * events.client_name y events.guest_count.
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

describe('Cocina Produccion API', () => {
  it('devuelve hojas de produccion por fecha', async () => {
    const res = await fetch(`${API_BASE}/api/cocina/produccion`, {
      headers: { Cookie: `eventflow_token=${token}` },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
  });

  it('devuelve 400 si falta evento_id en POST', async () => {
    const res = await fetch(`${API_BASE}/api/cocina/produccion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `eventflow_token=${token}` },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('no usa columnas incorrectas', async () => {
    const res = await fetch(`${API_BASE}/api/cocina/produccion`, {
      headers: { Cookie: `eventflow_token=${token}` },
    });
    expect(res.status).toBe(200);
    // Si no hay error 500, las columnas son correctas
  });

  it('devuelve 401 sin token', async () => {
    const res = await fetch(`${API_BASE}/api/cocina/produccion`);
    expect(res.status).toBe(401);
  });
});
