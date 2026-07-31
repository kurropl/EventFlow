/**
 * EventFlow — Tests TDD: Recetas API
 *
 * Verifica que el endpoint de recetas usa recipes + recipe_ingredients
 * y devuelve datos correctos con las columnas reales.
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

describe('Cocina Recetas API', () => {
  it('devuelve lista de recetas', async () => {
    const res = await fetch(`${API_BASE}/api/cocina/recetas`, {
      headers: { Cookie: `eventflow_token=${token}` },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
  });

  it('cada receta tiene campos esenciales', async () => {
    const res = await fetch(`${API_BASE}/api/cocina/recetas`, {
      headers: { Cookie: `eventflow_token=${token}` },
    });
    const json = await res.json();
    for (const r of json.data) {
      expect(r.id).toBeDefined();
      expect(r.name).toBeDefined();
      expect(r.category).toBeDefined();
      expect(typeof r.ingredient_count).toBe('number');
    }
  });

  it('filtra por categoria', async () => {
    const res = await fetch(`${API_BASE}/api/cocina/recetas?category=carne`, {
      headers: { Cookie: `eventflow_token=${token}` },
    });
    const json = await res.json();
    for (const r of json.data) {
      expect(r.category).toBe('carne');
    }
  });

  it('busca por nombre', async () => {
    const res = await fetch(`${API_BASE}/api/cocina/recetas?search=PASTA`, {
      headers: { Cookie: `eventflow_token=${token}` },
    });
    const json = await res.json();
    expect(json.data.length).toBeGreaterThan(0);
  });

  it('devuelve 401 sin token', async () => {
    const res = await fetch(`${API_BASE}/api/cocina/recetas`);
    expect(res.status).toBe(401);
  });
});
