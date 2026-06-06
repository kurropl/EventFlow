/**
 * EventFlow — Catalog Seed Script
 * 
 * Ensures the catalog_items table is populated from the canonical
 * menus.ts source. Run on first startup or after DB reset.
 * 
 * Usage: npx tsx scripts/seed-catalog.ts
 * Or called automatically from the catalog API when empty.
 */

import { Pool } from 'pg';
import { CATALOG_ITEMS, CATALOG_CATEGORIES } from '../src/data/menus';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:JBenitez2026!Secure@localhost:5432/eventflow',
});

interface SeedResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export async function seedCatalog(): Promise<SeedResult> {
  const client = await pool.connect();
  const result: SeedResult = { inserted: 0, updated: 0, skipped: 0, errors: [] };

  try {
    await client.query('BEGIN');

    for (const [category, items] of Object.entries(CATALOG_ITEMS)) {
      const catDef = CATALOG_CATEGORIES.find(c => c.id === category);
      const label = catDef?.label || category;

      for (const itemName of items) {
        const name = itemName.trim();
        if (!name) continue;

        // Check if item already exists
        const existing = await client.query(
          'SELECT id, active FROM catalog_items WHERE name = $1 LIMIT 1',
          [name]
        );

        if (existing.rows.length > 0) {
          // Item exists — ensure it's active and in the right category
          const row = existing.rows[0];
          if (!row.active) {
            await client.query(
              'UPDATE catalog_items SET active = true, category = $1 WHERE id = $2',
              [category, row.id]
            );
            result.updated++;
          } else {
            result.skipped++;
          }
        } else {
          // Insert new item
          await client.query(
            `INSERT INTO catalog_items (name, category, active, pvp_price, cost_price, unit)
             VALUES ($1, $2, true, 0, 0, 'portion')`,
            [name, category]
          );
          result.inserted++;
        }
      }
    }

    await client.query('COMMIT');
    console.log(`[seed-catalog] Inserted: ${result.inserted}, Updated: ${result.updated}, Skipped: ${result.skipped}`);
  } catch (error) {
    await client.query('ROLLBACK');
    const msg = error instanceof Error ? error.message : String(error);
    result.errors.push(msg);
    console.error('[seed-catalog] Error:', msg);
  } finally {
    client.release();
    await pool.end();
  }

  return result;
}

// Run if called directly
if (require.main === module) {
  seedCatalog().then(r => {
    console.log('Result:', r);
    process.exit(r.errors.length > 0 ? 1 : 0);
  });
}
