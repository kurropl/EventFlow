/**
 * Script para ejecutar la migración WP-24
 * Ejecuta: node scripts/run-migration-wp24.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:JBenitez2026!Secure@localhost:5432/eventflow';

async function runMigration() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();
  
  try {
    console.log('🔗 Conectado a la base de datos...');
    
    // Leer la migración
    const migrationPath = path.join(__dirname, '../db/migrations/006_wp24_cierre_economico.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Ejecutando migración WP-24...');
    await client.query(sql);
    
    console.log('✅ Migración completada exitosamente');
    
    // Verificar
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'event_financial_closures'
      ) as exists
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('✅ Tabla event_financial_closures verificada');
    } else {
      console.error('❌ Tabla event_financial_closures no encontrada');
    }
    
    // Verificar constraint
    const constraintCheck = await client.query(`
      SELECT pg_get_constraintdef(oid) as def
      FROM pg_constraint
      WHERE conname = 'events_status_check' AND conrelid = 'events'::regclass
    `);
    
    if (constraintCheck.rows[0]?.def?.includes('cerrado_contable')) {
      console.log('✅ Constraint events_status_check incluye cerrado_contable');
    } else {
      console.error('❌ Constraint events_status_check no incluye cerrado_contable');
    }
    
  } catch (error) {
    console.error('❌ Error ejecutando migración:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
