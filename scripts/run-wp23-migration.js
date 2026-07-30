/**
 * Script para ejecutar la migración WP-23 desde Node.js
 * Uso: node scripts/run-wp23-migration.js
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('ERROR: DATABASE_URL no configurada');
    process.exit(1);
  }

  const pool = new Pool({ connectionString, max: 5 });
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'db', 'migrations', '006_wp23_facturacion_hitos.sql'),
    'utf-8'
  );

  try {
    console.log('Ejecutando migración WP-23...');
    await pool.query(sql);
    console.log('✓ Migración WP-23 ejecutada correctamente');
    
    // Verificar
    const checks = await pool.query(`
      SELECT 'payment_plans' AS tabla, count(*) AS filas FROM payment_plans
      UNION ALL SELECT 'payment_milestones', count(*) FROM payment_milestones
      UNION ALL SELECT 'invoices_milestone', count(*) FROM invoices WHERE milestone_id IS NOT NULL
    `);
    console.log('\nVerificación:');
    for (const row of checks.rows) {
      console.log(`  ${row.tabla}: ${row.filas} filas`);
    }
  } catch (err) {
    console.error('Error ejecutando migración:', err.message || err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
