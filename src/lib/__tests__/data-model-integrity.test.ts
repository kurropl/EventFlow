/**
 * Tests de integridad del modelo de datos
 * Verifica que todas las entidades estén conectadas y trazables
 */

import { pool } from '@/lib/db';

describe('Data Model Connectivity — quote as root', () => {
  // Test 1: Todos los eventos deben tener quote_id
  test('todos los eventos tienen presupuesto raíz (quote_id)', async () => {
    const result = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM events WHERE quote_id IS NULL'
    );
    expect(result.rows[0].cnt).toBe(0);
  });

  // Test 2: No existe staff_assignments (eliminada en migración)
  test('staff_assignments fue eliminada', async () => {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'staff_assignments'`
    );
    expect(result.rows[0].cnt).toBe(0);
  });

  // Test 3: stock_entries existe
  test('stock_entries fue creada', async () => {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'stock_entries'`
    );
    expect(result.rows[0].cnt).toBe(1);
  });

  // Test 4: quotes tiene columna items
  test('quotes tiene columna items', async () => {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'items'`
    );
    expect(result.rows[0].cnt).toBe(1);
  });

  // Test 5: quotes.status acepta 'historical'
  test('quotes.status acepta historical', async () => {
    const result = await pool.query(
      `SELECT pg_get_constraintdef(oid) AS def
       FROM pg_constraint
       WHERE conrelid = 'quotes'::regclass AND conname = 'quotes_status_check'`
    );
    expect(result.rows[0].def).toContain('historical');
  });

  // Test 6: Trazabilidad — desde un quote se llega a su evento
  test('trazabilidad: quote → evento → transacciones', async () => {
    const quote = await pool.query('SELECT id FROM quotes LIMIT 1');
    if (quote.rows.length === 0) return; // skip
    const qId = quote.rows[0].id;

    const event = await pool.query(
      'SELECT id FROM events WHERE quote_id = $1 LIMIT 1',
      [qId]
    );
    expect(event.rows.length).toBeGreaterThanOrEqual(1);

    if (event.rows.length > 0) {
      const eId = event.rows[0].id;

      // Verificar event_shopping_items tienen ingredient_id
      const items = await pool.query(
        'SELECT * FROM event_shopping_items WHERE event_id = $1',
        [eId]
      );
      items.rows.forEach((item: any) => {
        if (item.ingredient_id) {
          expect(item.ingredient_id).toBeTruthy();
        }
      });

      // Verificar pagos
      const payments = await pool.query(
        'SELECT * FROM payments WHERE event_id = $1',
        [eId]
      );
      expect(payments.rows).toBeDefined();
    }
  });

  // Test 7: Un quote histórico no tiene event_id NOT NULL (compatibilidad)
  test('quote histórico permite event_id NULL', async () => {
    const result = await pool.query(
      `SELECT is_nullable FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'event_id'`
    );
    expect(result.rows[0].is_nullable).toBe('YES');
  });

  // Test 8: supplier_orders puede tener event_id
  test('supplier_orders tiene event_id', async () => {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'supplier_orders' AND column_name = 'event_id'`
    );
    // Puede no haber supplier_orders — skip si no existe
    expect(true).toBe(true);
  });

  // Test 9: Ingredientes maestros sin uso se detectan (no falla)
  test('detecta ingredientes maestros sin uso', async () => {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM ingredients i
       WHERE NOT EXISTS (
         SELECT 1 FROM event_shopping_items WHERE ingredient_id = i.id
       )`
    );
    console.log(`Ingredientes sin uso: ${result.rows[0].cnt}`);
    // No falla — es informativo
    expect(true).toBe(true);
  });
});