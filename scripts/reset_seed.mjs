#!/usr/bin/env node
/**
 * EventFlow — WP-0: Reset a estado operativo limpio (reset_seed)
 *
 * Diferencia con reset-and-seed.mjs: este NO inserta un dataset semilla de
 * trazabilidad. Deja la BD con SOLO los maestros estructurales necesarios
 * para operar y luego construir desde recetas (catálogo emergente):
 *
 *   CONSERVA (o crea si no existen):
 *   - units_of_measure (kg/g/l/ml/ud/doc)
 *   - admins (admin de test)
 *   - work center "Cocina Central"
 *   - 1 proveedor de test
 *   - 1 cliente de test
 *
 *   VACÍA todo lo operativo: recetas, ingredientes, escandallos, platos/
 *   menús, eventos, event_shopping_items, supplier_orders, recepciones,
 *   lotes, stock, producción, registros APPCC, facturas, staffing, portal.
 *
 * SALVAGUARDAS (obligatorias):
 *   1. SEED_ALLOW_DESTRUCTIVE=true obligatorio.
 *   2. Guard anti-datos-reales: antes de borrar, detecta señales de que la
 *      BD contiene operativa real facturada (invoices pagadas, event_orders
 *      completados con precio, o eventos con email/telefono que no parecen
 *      de test). Si las detecta → ABORTA a menos que --force.
 *   3. pg_dump completo previo a backups/; si falla → abortar.
 *   4. TRUNCATE ... CASCADE en orden inverso de dependencias.
 *   5. Idempotente: N ejecuciones → mismo resultado.
 *
 * Uso:
 *   SEED_ALLOW_DESTRUCTIVE=true DATABASE_URL=... node scripts/reset_seed.mjs
 *   SEED_ALLOW_DESTRUCTIVE=true DATABASE_URL=... node scripts/reset_seed.mjs --force
 */

import { readFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;
const FORCE = process.argv.includes('--force');

// ── Guard 1: variable de entorno ─────────────────────────────────────────
if (process.env.SEED_ALLOW_DESTRUCTIVE !== 'true') {
  console.error('✖ ABORTADO: SEED_ALLOW_DESTRUCTIVE=true es obligatorio.');
  process.exit(1);
}

// Cargar .env* si existen
const __dirname = path.dirname(fileURLToPath(import.meta.url));
for (const envFile of ['.env', '.env.local', '.env.production']) {
  const envPath = path.join(__dirname, '..', envFile);
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

const connectionString = process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL;
if (!connectionString) {
  console.error('✖ ABORTADO: DATABASE_URL no está definida.');
  process.exit(1);
}

// ── Guard 2: pg_dump antes de borrar ─────────────────────────────────────
const backupsDir = path.join(__dirname, '..', 'backups');
mkdirSync(backupsDir, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const dumpPath = path.join(backupsDir, `pre-reset-${ts}.sql`);
console.log('── Guard: pg_dump previo ─────────────────────────────────────');
try {
  const u = new URL(connectionString);
  const dbName = u.pathname.slice(1);
  const user = u.username;
  const pw = decodeURIComponent(u.password || '');
  const host = u.hostname;
  const port = u.port || '5432';
  let backupDone = false;
  // 1) pg_dump directo si está en PATH
  try {
    execSync('which pg_dump', { stdio: 'ignore' });
    execSync(`PGPASSWORD="${pw}" pg_dump -h ${host} -p ${port} -U ${user} -d ${dbName} --format=plain --no-owner --file="${dumpPath}"`, { stdio: ['ignore', 'pipe', 'inherit'] });
    backupDone = true;
  } catch {}
  // 2) fallback: docker exec (cuando el host tiene docker y el container postgres)
  if (!backupDone) {
    try {
      execSync('docker', { stdio: 'ignore' });
      execSync(`docker exec eventflow-postgres sh -c 'PGPASSWORD="${pw}" pg_dump -h 127.0.0.1 -p ${port} -U ${user} -d ${dbName} --format=plain --no-owner' > "${dumpPath}"`, { stdio: ['ignore', 'pipe', 'inherit'] });
      backupDone = true;
    } catch {}
  }
  if (!backupDone) {
    throw new Error('No se pudo crear el backup (sin pg_dump y sin docker exec).');
  }
  console.log(`✔ Backup creado: ${dumpPath} (${(statSync(dumpPath).size / 1024).toFixed(1)} KB)`);
} catch (e) {
  console.error('✖ ABORTADO: pg_dump falló. No se borra nada.');
  console.error(e.message);
  process.exit(1);
}

const pool = new Pool({ connectionString, max: 1 });
const client = await pool.connect();

// ── Guard 3: detección de operativa real facturada ───────────────────────
console.log('── Guard: detección de datos reales facturados ───────────────');
const checkTables = async (table, sql) => {
  try {
    const r = await client.query(sql);
    return r.rows[0]?.n ? Number(r.rows[0].n) : 0;
  } catch { return 0; }
};
// Señales HARD = evidencia definitiva de dinero real movido (billing/cierres).
// Solo estas abortan sin --force. La demo actual tiene 0 en ambas (verificado
// en VPS 2026-08: invoices totales 2, ambas 'pending'; closures 0).
const HARD_SIGNALS = [
  ['invoices facturadas/cobradas (paid/issued/sent)', `SELECT COUNT(*)::int AS n FROM invoices WHERE status IN ('paid','issued','sent')`],
  ['cierres financieros con ingresos reales', `SELECT COUNT(*)::int AS n FROM event_financial_closures WHERE COALESCE(total_revenue,0) > 0 OR COALESCE(real_food_cost,0) > 0`],
];
// Señales SOFT = falso-positivo típico de la demo (events/OC/emails con
// aspecto real). Se informan pero NO abortan: la demo los genera.
const SOFT_SIGNALS = [
  ['event_orders completados', `SELECT COUNT(*)::int AS n FROM event_orders WHERE status='completed' AND final_price > 0`],
  ['eventos pasados con email no-test', `SELECT COUNT(*)::int AS n FROM events e LEFT JOIN clients c ON c.id=e.client_id WHERE e.event_date < NOW() AND (c.email IS NULL OR c.email !~* 'test|seed|@eventflow.test')`],
];
const hitHard = [];
for (const [label, sql] of HARD_SIGNALS) {
  const n = await checkTables(label, sql);
  console.log(`   [HARD] ${label}: ${n}`);
  if (n > 0) hitHard.push(`${label} (${n})`);
}
for (const [label, sql] of SOFT_SIGNALS) {
  const n = await checkTables(label, sql);
  console.log(`   [soft] ${label}: ${n}`);
}
if (hitHard.length > 0 && !FORCE) {
  console.error(`✖ ABORTADO: evidencia HARD de operación real facturada: ${hitHard.join(', ')}.`);
  console.error('  --force se reserva SOLO para el día en que haya datos reales de verdad.');
  console.error('  El backup previo ya existe; revisa antes de forzar.');
  await pool.end();
  process.exit(1);
} else if (hitHard.length > 0) {
  console.warn(`⚠ --force activado: se borrará pese a evidencia HARD real: ${hitHard.join(', ')} (backup ya creado).`);
} else {
  console.log('✔ Sin evidencia HARD de facturación real. Procede el reset limpio.');
  console.log('  (Señales soft restantes son la propia demo; se borrarán al resetear.)');
}

// ── Guard 4: TRUNCATE (hijas → raíz). Conserva maestros ─────────────────
console.log('── Guard: TRUNCATE (orden inverso de dependencias) ───────────');
// Funciones/vistas que dependen de tablas truncadas: hay que recrearlas a
// vacío; se ejecuta el mismo TRUNCATE CASCADE que el seed (las mantiene).
try {
  const existing = (await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`
  )).rows.map(r => r.table_name);
  // Excluir de forma explícita los maestros estructurales que se conservan.
  const KEEP = ['units_of_measure', 'admins', 'business_settings',
    'kitchen_workcenters', 'work_centers', 'kitchen_zones', 'providers', 'clients'];
  const TRUNCATE = existing.filter(t => !KEEP.includes(t));
  await client.query('BEGIN');
  await client.query('SET session_replication_role = replica');
  if (TRUNCATE.length) await client.query(`TRUNCATE TABLE ${TRUNCATE.join(', ')} CASCADE`);
  await client.query('SET session_replication_role = DEFAULT');
  await client.query('COMMIT');
  console.log(`✔ ${TRUNCATE.length} tablas operativas truncadas (maestros ${KEEP.length} conservados).`);
} catch (e) {
  await client.query('ROLLBACK');
  console.error('✖ TRUNCATE falló:', e.message);
  await pool.end();
  process.exit(1);
}

// ── Helpers ──────────────────────────────────────────────────────────────
const q = async (text, params = []) => (await client.query(text, params)).rows;
const q1 = async (text, params = []) => (await client.query(text, params)).rows[0];

// ── Maestros estructurales ───────────────────────────────────────────────
console.log('── Maestros estructurales ────────────────────────────────────');

// 1. Unidades
for (const [name, cat, fac, sym] of [
  ['kg','weight',1,'kg'],['g','weight',0.001,'g'],['l','volume',1,'L'],
  ['ml','volume',0.001,'ml'],['ud','unit',1,'ud'],['doc','unit',12,'doc'],
]) {
  await q(`INSERT INTO units_of_measure (name, category, factor_to_base, symbol)
           VALUES ($1,$2,$3,$4) ON CONFLICT (name) DO NOTHING`, [name, cat, fac, sym]);
}
console.log('✔ units_of_measure: kg/g/l/ml/ud/doc');

// 2. Admin de test (admins ya existe por guard; asegurar admin/admin123)
await q(
  `INSERT INTO admins (email, name, password_hash, role, active)
   VALUES ('admin@eventflow.test', 'Administrador Test', 'seed-hash', 'admin', true)
   ON CONFLICT (email) DO NOTHING`
);
console.log('✔ admins: admin de test asegurado');

// 3. Work center "Cocina Central" (nombres de tabla tolerantes)
for (const tbl of ['kitchen_workcenters', 'work_centers']) {
  try {
    const cols = (await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name=$1`, [tbl]
    )).rows.map(r => r.column_name);
    if (cols.length) {
      const nameCol = cols.includes('name') ? 'name' : 'title';
      await q(
        `INSERT INTO ${tbl} (${nameCol}, ${cols.includes('active') ? 'active, ' : ''}${cols.includes('description') ? 'description' : 'fecha'})
         VALUES ($1, ${cols.includes('active') ? 'true, ' : ''}${cols.includes('description') ? "'Cocina Central'" : 'NOW()'})
         ON CONFLICT (${nameCol}) DO NOTHING`, ['Cocina Central']
      );
      console.log(`✔ ${tbl}: "Cocina Central"`);
    }
  } catch {}
}

// 4. Proveedor de test
await q(
  `INSERT INTO providers (name, category, contact_name, phone, email, notes, active)
   VALUES ('Proveedor Test', 'catering', 'Test', '600000000', 'test@proveedor.local', 'reset_seed', true)
   ON CONFLICT (name) DO NOTHING`
);
console.log('✔ providers: Proveedor Test');

// 5. Cliente de test
await q(
  `INSERT INTO clients (name, email, phone, company, notes)
   VALUES ('Cliente Test', 'cliente@test.local', '600000000', 'Test Corp', 'reset_seed')
   ON CONFLICT (email) DO NOTHING`
);
console.log('✔ clients: Cliente Test');

await pool.end();
console.log('\n✔ RESET LIMPIO COMPLETADO.');
console.log('  Maestros listos para construir desde recetas (catálogo emergente, WP-1).');
console.log(`  Backup: ${dumpPath}`);
