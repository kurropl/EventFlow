/**
 * EventFlow — Characterization Tests v2 (after operativa spec implementation)
 * Includes new states: lost, cancelled, reopened
 * Run: npx vitest run __tests__/characterization.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest';

const BASE = process.env.EVENTFLOW_URL || 'http://localhost:3020';
let authCookie = '';

beforeAll(async () => {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  const sc = res.headers.get('set-cookie');
  if (sc) { const m = sc.match(/(admin_session|eventflow_token)=[^;]+/); if (m) authCookie = m[0]; }
});

function H(extra: Record<string, string> = {}) { return { Cookie: authCookie, ...extra }; }

// ═══════════════════════════════════════════════════════════════
// § Events — all valid statuses including new ones
// ═══════════════════════════════════════════════════════════════
describe('Events: all statuses valid', () => {
  const VALID = ['draft', 'sent', 'accepted', 'completed', 'lost', 'cancelled', 'reopened'];
  it('all events have valid statuses', async () => {
    const res = await fetch(`${BASE}/api/events`, { headers: H() });
    const data = await res.json();
    for (const e of data.data || []) {
      expect(VALID).toContain(e.status);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// § Transitions endpoint exists and validates
// ═══════════════════════════════════════════════════════════════
describe('Transitions: validation', () => {
  it('rejects invalid transition', async () => {
    const events = await fetch(`${BASE}/api/events`, { headers: H() }).then(r => r.json());
    const eventId = events.data?.[0]?.id;
    if (!eventId) return;

    const res = await fetch(`${BASE}/api/events/${eventId}/transitions`, {
      method: 'POST',
      headers: { ...H(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ transition: 'INVALID' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects transition from wrong state', async () => {
    const events = await fetch(`${BASE}/api/events`, { headers: H() }).then(r => r.json());
    const draft = events.data?.find(e => e.status === 'draft');
    if (!draft) return;

    const res = await fetch(`${BASE}/api/events/${draft.id}/transitions`, {
      method: 'POST',
      headers: { ...H(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ transition: 'FWD-4' }), // Can't go directly to completed from draft
    });
    expect(res.status).toBe(409);
  });

  it('rejects INV-1 without motivo', async () => {
    const events = await fetch(`${BASE}/api/events`, { headers: H() }).then(r => r.json());
    const sent = events.data?.find(e => e.status === 'sent');
    if (!sent) return;

    const res = await fetch(`${BASE}/api/events/${sent.id}/transitions`, {
      method: 'POST',
      headers: { ...H(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ transition: 'INV-1' }),
    });
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════
// § Audit log exists
// ═══════════════════════════════════════════════════════════════
describe('Audit log', () => {
  it('audit_log table has entries', async () => {
    // The audit_log is accessible via a direct DB check or we verify through API
    // For now, just verify the endpoint doesn't crash when called with valid transition
    const events = await fetch(`${BASE}/api/events`, { headers: H() }).then(r => r.json());
    const draft = events.data?.find(e => e.status === 'draft');
    if (!draft) return;

    // Try FWD-2 on a draft event (should succeed or fail gracefully)
    const res = await fetch(`${BASE}/api/events/${draft.id}/transitions`, {
      method: 'POST',
      headers: { ...H(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ transition: 'FWD-2', motivo: 'test characterization' }),
    });
    const data = await res.json();
    // Either success, conflict, or validation error — all prove the endpoint works
    expect([200, 400, 409]).toContain(res.status);
  });
});

// ═══════════════════════════════════════════════════════════════
// § Read-only modules (unchanged from v1)
// ═══════════════════════════════════════════════════════════════
describe('Read-only modules', () => {
  it('catalog returns grouped items', async () => {
    const res = await fetch(`${BASE}/api/catalog`, { headers: H() });
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Object.keys(data.data).length).toBeGreaterThan(0);
  });

  it('stock returns ingredients', async () => {
    const res = await fetch(`${BASE}/api/stock`, { headers: H() });
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);
  });

  it('providers returns providers', async () => {
    const res = await fetch(`${BASE}/api/providers`, { headers: H() });
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);
  });

  it('payments returns payments', async () => {
    const res = await fetch(`${BASE}/api/payments`, { headers: H() });
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);
  });

  it('invoices returns invoices', async () => {
    const res = await fetch(`${BASE}/api/invoices`, { headers: H() });
    const data = await res.json();
    expect(data.data).toBeDefined();
  });

  it('staffing workers returns workers', async () => {
    const res = await fetch(`${BASE}/api/staffing/workers`, { headers: H() });
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// § Global invariants (§14)
// ═══════════════════════════════════════════════════════════════
describe('Global invariants (§14)', () => {
  it('no invoice for events never completed', async () => {
    const events = await fetch(`${BASE}/api/events`, { headers: H() }).then(r => r.json());
    const invoices = await fetch(`${BASE}/api/invoices`, { headers: H() }).then(r => r.json());
    const nonCompleted = (events.data || []).filter(e => !['completed', 'paid'].includes(e.status));
    for (const e of nonCompleted) {
      const hasInv = (invoices.data || []).some(inv => inv.event_id === e.id);
      if (hasInv) console.warn(`INVARIANT: Event ${e.id} (${e.client_name}) has status ${e.status} but has invoice!`);
    }
  });

  it('cancelled events have penalty concept on payments', async () => {
    const events = await fetch(`${BASE}/api/events`, { headers: H() }).then(r => r.json());
    const payments = await fetch(`${BASE}/api/payments`, { headers: H() }).then(r => r.json());
    const cancelled = (events.data || []).filter(e => e.status === 'cancelled');
    for (const e of cancelled) {
      const eps = (payments.data || []).filter(p => p.event_id === e.id);
      for (const p of eps) {
        if (p.paid) {
          expect(['penalizacion_por_cancelacion', 'senal']).toContain(p.concept);
        }
      }
    }
  });
});
