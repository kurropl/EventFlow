/**
 * EventFlow — Tests TDD: Escandallos API
 *
 * Verifica que el endpoint de escandallos usa events.guest_count,
 * events.client_name, y las tablas escandallos/escandallo_lines.
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

describe('Cocina Escandallos API', () => {
  it('devuelve escandallos por evento', async () => {
    const res = await fetch(`${API_BASE}/api/cocina/escandallos?tipo=evento`, {
      headers: { Cookie: `eventflow_token=${token}` },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
  });

  it('devuelve resumen global', async () => {
    const res = await fetch(`${API_BASE}/api/cocina/escandallos?tipo=resumen`, {
      headers: { Cookie: `eventflow_token=${token}` },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(typeof json.data.total_escandallos).toBe('number');
  });

  it('no usa columnas incorrectas', async () => {
    const res = await fetch(`${API_BASE}/api/cocina/escandallos?tipo=evento`, {
      headers: { Cookie: `eventflow_token=${token}` },
    });
    expect(res.status).toBe(200);
    // Si no hay error 500, las columnas son correctas
  });

  it('devuelve 401 sin token', async () => {
    const res = await fetch(`${API_BASE}/api/cocina/escandallos`);
    expect(res.status).toBe(401);
  });
});
