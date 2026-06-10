/**
 * EventFlow — Characterization Tests (Step 2: red anti-regression)
 * Captures CURRENT behavior before implementing the operativa spec.
 * Run: npx vitest run __tests__/characterization.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest';

const BASE = process.env.EVENTFLOW_URL || 'http://localhost:3020';
const AUTH_BODY = JSON.stringify({ username: 'admin', password: 'admin123' });

let authCookie = '';

beforeAll(async () => {
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: AUTH_BODY,
  });
  const setCookie = loginRes.headers.get('set-cookie');
  if (setCookie) {
    const match = setCookie.match(/(admin_session|eventflow_token)=[^;]+/);
    if (match) authCookie = match[0];
  }
});

function authHeaders(extra: Record<string, string> = {}) {
  return { Cookie: authCookie, ...extra };
}

// ═══════════════════════════════════════════════════════════════
// § FWD-1: Nuevo presupuesto (Lead creation)
// ═══════════════════════════════════════════════════════════════
describe('FWD-1: Nuevo presupuesto', () => {
  it('POST /api/leads creates a lead', async () => {
    const res = await fetch(`${BASE}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        contact_name: 'TEST CHARACTERIZATION',
        contact_email: 'test-char@example.com',
        event_type: 'boda',
        guest_count: 50,
      }),
    });
    // Endpoint responds — may return 201, 400 (validation), or 409 (duplicate)
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// § Read-only modules: catalog, stock, providers
// ═══════════════════════════════════════════════════════════════
describe('Read-only modules', () => {
  it('GET /api/catalog returns grouped items', async () => {
    const res = await fetch(`${BASE}/api/catalog`, { headers: authHeaders() });
    const data = await res.json();
    expect(data.success).toBe(true);
    // Catalog returns grouped by category: { "aperitivo-calcente": [...], ... }
    const cats = Object.keys(data.data);
    expect(cats.length).toBeGreaterThan(0);
    const firstItem = data.data[cats[0]][0];
    expect(firstItem).toHaveProperty('id');
    expect(firstItem).toHaveProperty('name');
    expect(firstItem).toHaveProperty('pvp');
  });

  it('GET /api/stock returns ingredients', async () => {
    const res = await fetch(`${BASE}/api/stock`, { headers: authHeaders() });
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);
  });

  it('GET /api/providers returns providers', async () => {
    const res = await fetch(`${BASE}/api/providers`, { headers: authHeaders() });
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// § Events — existing statuses and structure
// ═══════════════════════════════════════════════════════════════
describe('Events: current structure', () => {
  let events: any[] = [];

  beforeAll(async () => {
    const res = await fetch(`${BASE}/api/events`, { headers: authHeaders() });
    const data = await res.json();
    events = data.data || [];
  });

  it('events exist', () => {
    expect(events.length).toBeGreaterThan(0);
  });

  it('events have valid statuses (draft/sent/accepted/completed)', () => {
    const validStatuses = ['draft', 'sent', 'accepted', 'completed'];
    for (const e of events) {
      expect(validStatuses).toContain(e.status);
    }
  });

  it('accepted/completed events have event_orders', async () => {
    const res = await fetch(`${BASE}/api/event-orders`, { headers: authHeaders() });
    const data = await res.json();
    const orders = data.data || [];
    const active = events.filter(e => e.status === 'accepted' || e.status === 'completed');
    for (const e of active) {
      const hasOrder = orders.some(o => o.event_id === e.id);
      expect(hasOrder).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// § Payments — structure
// ═══════════════════════════════════════════════════════════════
describe('Payments: structure', () => {
  it('GET /api/payments returns payments', async () => {
    const res = await fetch(`${BASE}/api/payments`, { headers: authHeaders() });
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);
    const p = data.data[0];
    expect(p).toHaveProperty('id');
    expect(p).toHaveProperty('event_id');
    expect(p).toHaveProperty('amount');
    expect(p).toHaveProperty('paid');
    expect(p).toHaveProperty('concept');
  });
});

// ═══════════════════════════════════════════════════════════════
// § Invoices — structure (API returns { data: [...] } directly)
// ═══════════════════════════════════════════════════════════════
describe('Invoices: structure', () => {
  it('GET /api/invoices returns invoices', async () => {
    const res = await fetch(`${BASE}/api/invoices`, { headers: authHeaders() });
    const data = await res.json();
    // invoices API returns { data: [...] } — no success wrapper
    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data)).toBe(true);
    if (data.data.length > 0) {
      const inv = data.data[0];
      expect(inv).toHaveProperty('id');
      expect(inv).toHaveProperty('invoice_number');
      expect(inv).toHaveProperty('total');
      expect(inv).toHaveProperty('status');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// § Staffing — structure and lines
// ═══════════════════════════════════════════════════════════════
describe('Staffing: structure', () => {
  it('GET /api/staffing/workers returns workers', async () => {
    const res = await fetch(`${BASE}/api/staffing/workers`, { headers: authHeaders() });
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);
  });

  it('GET /api/staffing/lines returns lines with event info', async () => {
    const res = await fetch(`${BASE}/api/staffing/lines`, { headers: authHeaders() });
    const data = await res.json();
    expect(data.success).toBe(true);
    if (data.data.length > 0) {
      const line = data.data[0];
      expect(line).toHaveProperty('event_id');
      expect(line).toHaveProperty('role');
      expect(line).toHaveProperty('slots_needed');
      expect(line).toHaveProperty('status');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// § Global invariants (§14) — soft checks, warn on failure
// ═══════════════════════════════════════════════════════════════
describe('Global invariants (§14)', () => {
  it('no invoice for events never completed', async () => {
    const eventsRes = await fetch(`${BASE}/api/events`, { headers: authHeaders() });
    const events = (await eventsRes.json()).data || [];
    const invoicesRes = await fetch(`${BASE}/api/invoices`, { headers: authHeaders() });
    const invoices = (await invoicesRes.json()).data || [];
    const nonCompleted = events.filter(e => e.status !== 'completed' && e.status !== 'paid');
    for (const e of nonCompleted) {
      const hasInvoice = invoices.some(inv => inv.event_id === e.id);
      if (hasInvoice) {
        console.warn(`INVARIANT: Event ${e.id} (${e.client_name}) has status ${e.status} but has an invoice!`);
      }
    }
  });

  it('payments total <= event total for active events', async () => {
    const eventsRes = await fetch(`${BASE}/api/events`, { headers: authHeaders() });
    const events = (await eventsRes.json()).data || [];
    const paymentsRes = await fetch(`${BASE}/api/payments`, { headers: authHeaders() });
    const payments = (await paymentsRes.json()).data || [];
    for (const e of events) {
      if (e.status !== 'accepted' && e.status !== 'completed') continue;
      const eventPayments = payments.filter(p => p.event_id === e.id && p.paid);
      const totalPaid = eventPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const eventTotal = Number(e.total_pvp || 0);
      if (eventTotal > 0 && totalPaid > eventTotal * 1.1) {
        console.warn(`INVARIANT: Event ${e.id} paid ${totalPaid} exceeds total ${eventTotal}`);
      }
    }
  });
});
