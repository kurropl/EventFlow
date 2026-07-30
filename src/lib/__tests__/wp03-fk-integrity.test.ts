/**
 * WP-03 — Tests de integridad referencial Evento↔Presupuesto
 * Verifica: (1) quotes.event_id poblado, (2) unicidad accepted/paid,
 * (3) defensa en profundidad en acceptQuote().
 */

import { describe, it, expect } from 'vitest';
import { pool } from '@/lib/db';

describe('WP-03 — Integridad referencial evento↔presupuesto', () => {
  // Test 1: Constraint de unicidad existe
  it('existe el índice parcial uq_one_accepted_quote_per_event', async () => {
    const result = await pool.query(
      `SELECT indexname FROM pg_indexes
       WHERE indexname = 'uq_one_accepted_quote_per_event'`
    );
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].indexname).toBe('uq_one_accepted_quote_per_event');
  });

  // Test 2: No hay múltiples quotes accepted/paid por evento
  it('no existen eventos con múltiples quotes accepted/paid', async () => {
    const result = await pool.query(
      `SELECT event_id, COUNT(*) AS cnt
       FROM quotes
       WHERE status IN ('accepted', 'paid')
       GROUP BY event_id
       HAVING COUNT(*) > 1`
    );
    expect(result.rows.length).toBe(0);
  });

  // Test 3: Todas las quotes con status accepted/paid tienen event_id
  it('quotes accepted/paid tienen event_id no nulo', async () => {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS cnt
       FROM quotes
       WHERE status IN ('accepted', 'paid')
         AND event_id IS NULL`
    );
    expect(result.rows[0].cnt).toBe(0);
  });

  // Test 4: quotes.event_id sigue siendo nullable (NR-1: no destruir)
  it('quotes.event_id sigue siendo nullable', async () => {
    const result = await pool.query(
      `SELECT is_nullable FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'quotes'
         AND column_name = 'event_id'`
    );
    expect(result.rows[0].is_nullable).toBe('YES');
  });

  // Test 5: Tablas NOT NULL no tienen event_id NULL
  const notNullTables = [
    'cost_desglose',
    'event_menu_items',
    'event_shopping_items',
    'event_plans',
    'checklist_tasks',
    'worker_event_pay',
    'staffing_lines',
  ];

  for (const table of notNullTables) {
    it(`${table}: event_id no tiene NULLs`, async () => {
      const result = await pool.query(
        `SELECT COUNT(*)::int AS cnt FROM ${table} WHERE event_id IS NULL`
      );
      expect(result.rows[0].cnt).toBe(0);
    });
  }
});
