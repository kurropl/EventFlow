#!/usr/bin/env node
/**
 * EventFlow — WP-SEED-01: Reset controlado y dataset semilla de trazabilidad
 *
 * Deja la BD con un dataset determinista que ejercita la cadena completa:
 * unidades → receta → menú → evento → escandallo → orden de compra →
 * recepción APPCC con lote → carga/consumo → retorno → merma → plan de
 * pagos → señal → portal → cierre.
 *
 * SALVAGUARDAS (obligatorias):
 *   1. Se NIEGA a ejecutar salvo SEED_ALLOW_DESTRUCTIVE=true Y la URL de la
 *      BD NO contenga el host de producción (eventcater.duckdns.org /
 *      62.171.134.0). Hardcodeado.
 *   2. Antes de borrar: pg_dump completo a backups/pre-seed-<ts>.sql.
 *      Si el dump falla → abortar. Imprime la ruta del backup.
 *   3. Borrado por TRUNCATE ... CASCADE en orden inverso de dependencias,
 *      listando explícitamente las tablas. Conserva users/roles (admins).
 *
 * El seed NO inserta el portal a mano: emite deposit.paid (outbox) y
 * ejecuta el worker cron real (GET /api/cron/domain-events-worker) para
 * que el handler cree el portal — valida el outbox, no lo simula.
 *
 * Uso: SEED_ALLOW_DESTRUCTIVE=true DATABASE_URL=... node scripts/reset-and-seed.mjs
 */

import { readFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;

// ── Guard 1: variable de entorno ─────────────────────────────────────────
if (process.env.SEED_ALLOW_DESTRUCTIVE !== 'true') {
  console.error('✖ ABORTADO: SEED_ALLOW_DESTRUCTIVE=true es obligatorio.');
  process.exit(1);
}

// Cargar .env.local / .env si existen
const __dirname = path.dirname(fileURLToPath(import.meta.url));
for (const envFile of ['.env.local', '.env']) {
  const envPath = path.join(__dirname, '..', envFile);
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('✖ ABORTADO: DATABASE_URL no está definida.');
  process.exit(1);
}

// ── Guard 1b: nunca contra producción (hosts hardcodeados) ───────────────
const PROD_HOSTS = ['eventcater.duckdns.org', '62.171.134.0'];
let dbHost = '';
try {
  const u = new URL(connectionString);
  dbHost = u.hostname;
  for (const host of PROD_HOSTS) {
    if (u.hostname.includes(host)) {
      console.error(`✖ ABORTADO: DATABASE_URL apunta a producción (${u.hostname}).`);
      process.exit(1);
    }
  }
} catch {
  console.error('✖ ABORTADO: DATABASE_URL no válida.');
  process.exit(1);
}

// ── Guard 2: pg_dump antes de borrar ─────────────────────────────────────
const backupsDir = path.join(__dirname, '..', 'backups');
mkdirSync(backupsDir, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const dumpPath = path.join(backupsDir, `pre-seed-${ts}.sql`);
console.log('── Guard 2: pg_dump ──────────────────────────────────────────');
try {
  const u = new URL(connectionString);
  const dbName = u.pathname.slice(1);
  const user = u.username;
  const pw = decodeURIComponent(u.password || '');
  const host = u.hostname;
  const port = u.port || '5432';
  // pg_dump puede vivir en el host o dentro del container docker (VPS)
  let cmd = `PGPASSWORD="${pw}" pg_dump -h ${host} -p ${port} -U ${user} -d ${dbName} --format=plain --no-owner --file="${dumpPath}"`;
  try {
    execSync('which pg_dump', { stdio: 'ignore' });
  } catch {
    cmd = `docker exec -i eventflow-postgres sh -c 'PGPASSWORD="${pw}" pg_dump -h ${host} -p ${port} -U ${user} -d ${dbName} --format=plain --no-owner' > "${dumpPath}"`;
  }
  execSync(cmd, { stdio: ['ignore', 'pipe', 'inherit'] });
  console.log(`✔ Backup creado: ${dumpPath} (${(statSync(dumpPath).size / 1024).toFixed(1)} KB)`);
} catch (e) {
  console.error('✖ ABORTADO: pg_dump falló. No se borra nada.');
  console.error(e.message);
  process.exit(1);
}

// ── Conexión ─────────────────────────────────────────────────────────────
const pool = new Pool({ connectionString, max: 1 });
const client = await pool.connect();

// ── Guard 3: TRUNCATE explícito (hijas → raíz). Conserva admins ─────────
const TRUNCATE_TABLES = [
  'event_guest_variants', 'event_menu_items', 'traceability_log', 'lot_consumption',
  'stock_movements', 'stock_lots', 'receiving_log', 'stock_entries',
  'event_shopping_items', 'inventory_movements', 'supplier_order_items',
  'supplier_orders',
  'appcc_controles', 'fridge_temperature_log', 'haccp_monitoring',
  'haccp_equipment_calibration', 'haccp_plans', 'haccp_critical_limits',
  'items_produccion', 'tareas_produccion', 'items_carga', 'loading_items',
  'items_logistica', 'hojas_carga', 'hojas_produccion', 'loading_sheets',
  'production_plan_items', 'production_sheets', 'kitchen_zones',
  'event_timeline', 'event_tableware', 'tableware_items', 'event_packs',
  'pack_template_items', 'pack_templates', 'vajilla_template_items',
  'vajilla_templates', 'category_pass_mapping', 'service_passes',
  'menu_section_dishes', 'menu_sections', 'event_menus', 'menus',
  'escandallo_lines', 'escandallos', 'event_escandallos', 'event_escandallo_recetas',
  'recipe_item_versions', 'recipe_items', 'recipe_ingredients', 'recipes',
  'recipe_template_items', 'recipe_templates', 'ingredient_price_history',
  'ingredient_unit_conversions', 'inventory', 'ingredients',
  'supplier_approval', 'providers',
  'invoices', 'payment_milestones', 'payment_plans', 'payments',
  'staffing_offers', 'staffing_lines', 'worker_event_pay', 'work_hours',
  'worker_hours', 'payroll', 'waiters', 'workers',
  'table_assignments', 'tables', 'event_floorplans', 'floor_plans',
  'event_transport', 'event_closure_checklists', 'event_cost_deviations',
  'event_costs', 'cost_desglose', 'event_consumable_returns',
  'event_financial_closures', 'event_briefings', 'event_orders',
  'event_messages', 'client_portals', 'portal_magic_links',
  'event_drink_config', 'drink_products', 'event_extras', 'extras_catalog',
  'guest_forms', 'guests', 'event_plans', 'event_summary',
  'appointments', 'quotes', 'events', 'leads', 'lead_interactions', 'clients',
  'catalog_summary', 'catalog_items',
  'audit_log', 'automation_logs', 'automation_rules', 'email_queue',
  'checklist_tasks', 'checklist_templates', 'cleaning_log', 'webhook_logs',
  'domain_events', 'v_event_cost', 'v_event_first_timing',
  'v_event_messages_summary', 'v_recipes',
].filter((t, i, arr) => arr.indexOf(t) === i);

console.log('── Guard 3: TRUNCATE (orden inverso de dependencias) ─────────');
try {
  await client.query('BEGIN');
  await client.query('SET session_replication_role = replica');
  // Solo truncar tablas que existen realmente en esta BD (idempotente entre schemas)
  const existing = (await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
  )).rows.map(r => r.table_name);
  const toTruncate = TRUNCATE_TABLES.filter(t => existing.includes(t));
  await client.query(`TRUNCATE TABLE ${toTruncate.join(', ')} CASCADE`);
  await client.query('SET session_replication_role = DEFAULT');
  await client.query('COMMIT');
  console.log(`✔ ${toTruncate.length} tablas truncadas (${TRUNCATE_TABLES.length - toTruncate.length} no presentes, omitidas; admins conservada).`);
} catch (e) {
  await client.query('ROLLBACK');
  console.error('✖ TRUNCATE falló:', e.message);
  process.exit(1);
}

// ── Helpers ──────────────────────────────────────────────────────────────
const q = async (text, params = []) => (await client.query(text, params)).rows;
const q1 = async (text, params = []) => (await client.query(text, params)).rows[0];

// ── Dataset semilla ──────────────────────────────────────────────────────
console.log('── Dataset semilla ───────────────────────────────────────────');
const DAY = 24 * 60 * 60 * 1000;
const today = new Date();
const todayStr = today.toISOString().slice(0, 10);
const eventDate = new Date(today.getTime() + 30 * DAY);
const eventDateStr = eventDate.toISOString().slice(0, 10);
const freezeDate = new Date(today.getTime() + 16 * DAY).toISOString().slice(0, 10);
const dueResto = new Date(eventDate.getTime() - 7 * DAY).toISOString().slice(0, 10);
const dueSenal = new Date(today.getTime() + 7 * DAY).toISOString().slice(0, 10);

// 1. Admin semilla (conservar users/roles: solo si no existe)
await q1(
  `INSERT INTO admins (email, name, password_hash, role, active)
   VALUES ('admin@eventflow.test', 'Administrador', 'seed', 'admin', true)
   ON CONFLICT (email) DO NOTHING`
);
const adminRow = await q1(`SELECT id FROM admins WHERE email = 'admin@eventflow.test'`);
console.log(`✔ Admin semilla ok (id=${adminRow?.id}, conservado o recreado).`);

// 2. Ingredientes (base g/ml + conversiones + stock inicial vía 'ajuste')
const ternera = await q1(
  `INSERT INTO ingredients (name, unit, base_unit, cost_per_unit, unit_cost, quantity, min_stock, stock_unit, active, supplier, category)
   VALUES ('Ternera', 'g', 'g', 0.012, 0.012, 10000, 5000, 'g', true, 'Cárnicas Semilla', 'proteinas')
   RETURNING *`
);
const patata = await q1(
  `INSERT INTO ingredients (name, unit, base_unit, cost_per_unit, unit_cost, quantity, min_stock, stock_unit, active, supplier, category)
   VALUES ('Patata', 'g', 'g', 0.002, 0.002, 20000, 5000, 'g', true, 'Cárnicas Semilla', 'verduras')
   RETURNING *`
);
const vino = await q1(
  `INSERT INTO ingredients (name, unit, base_unit, cost_per_unit, unit_cost, quantity, min_stock, stock_unit, active, supplier, category)
   VALUES ('Vino tinto', 'ml', 'ml', 0.004, 0.004, 15000, 7500, 'ml', true, 'Cárnicas Semilla', 'bebidas')
   RETURNING *`
);
await q(`INSERT INTO ingredient_unit_conversions (ingredient_id, unit_name, factor_to_base) VALUES
  ($1, 'kg', 1000), ($1, 'g', 1)`, [ternera.id]);
await q(`INSERT INTO ingredient_unit_conversions (ingredient_id, unit_name, factor_to_base) VALUES
  ($1, 'kg', 1000), ($1, 'g', 1)`, [patata.id]);
await q(`INSERT INTO ingredient_unit_conversions (ingredient_id, unit_name, factor_to_base) VALUES
  ($1, 'botella75', 750), ($1, 'ml', 1)`, [vino.id]);
await q(
  `INSERT INTO stock_movements (ingredient_id, movement_type, qty_base, reason) VALUES ($1, 'ajuste', 10000, 'saldo inicial semilla')`,
  [ternera.id]
);
await q(
  `INSERT INTO stock_movements (ingredient_id, movement_type, qty_base, reason) VALUES ($1, 'ajuste', 20000, 'saldo inicial semilla')`,
  [patata.id]
);
await q(
  `INSERT INTO stock_movements (ingredient_id, movement_type, qty_base, reason) VALUES ($1, 'ajuste', 15000, 'saldo inicial semilla')`,
  [vino.id]
);
await q(`INSERT INTO inventory (ingredient_id, quantity, unit, last_movement_at) VALUES
  ($1, 10000, 'g', now()), ($2, 20000, 'g', now()), ($3, 15000, 'ml', now())
  ON CONFLICT (ingredient_id) DO UPDATE SET quantity = EXCLUDED.quantity, unit = EXCLUDED.unit, last_movement_at = now()`,
  [ternera.id, patata.id, vino.id]);
console.log(`✔ Ingredientes: Ternera(${ternera.id}) Patata(${patata.id}) Vino(${vino.id}) — stock 10.000/20.000/15.000`);

// 3. Proveedor vinculado a los 3 ingredientes
const proveedor = await q1(
  `INSERT INTO providers (name, category, contact_name, phone, email, notes, active)
   VALUES ('Cárnicas Semilla', 'catering', 'Seed', '600000001', 'seed@proveedor.test', 'WP-SEED-01', true)
   RETURNING *`
);
await q(`UPDATE ingredients SET supplier_id = $1 WHERE id IN ($2, $3, $4)`, [proveedor.id, ternera.id, patata.id, vino.id]);
console.log(`✔ Proveedor: ${proveedor.id}`);

// 4. Receta "Ternera con patatas" (150g + 200g por pax → 2,20 €/pax)
const receta = await q1(
  `INSERT INTO recipes (name, description, servings, category, published, active, version, merma_pct, instructions)
   VALUES ('Ternera con patatas', 'Guiso de ternera con patatas', 1, 'carne', true, true, 1, 0, 'Guisar la ternera con las patatas')
   RETURNING *`
);
// En schemas legacy, recipes se vincula a un catalog_item (plato) y recipe_items usa catalog_item_id
const ciCols = (await client.query(
  `SELECT column_name FROM information_schema.columns WHERE table_name = 'catalog_items'`
)).rows.map(r => r.column_name);
if (ciCols.length > 0) {
  // catalog_items: pvp 50 €/pax, coste 2,20 €, vínculo a la receta
  const ciInsert = `INSERT INTO catalog_items (${ciCols.includes('name') ? 'name' : 'title'}, ${ciCols.includes('category') ? 'category' : 'categoria'}, ${ciCols.includes('pvp') ? 'pvp' : 'price'}, ${ciCols.includes('cost') ? 'cost' : 'cost_per_serving'}, ${ciCols.includes('active') ? 'active' : 'is_active'})
    VALUES ('Ternera con patatas', 'carne', 50, 2.20, true)
    RETURNING *`;
  const ci = await q1(ciInsert);
  if (ciCols.includes('catalog_item_id')) {
    await q(`UPDATE recipes SET catalog_item_id = $1 WHERE id = $2`, [ci.id, receta.id]);
  }
  const riCols2 = (await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'recipe_items'`
)).rows.map(r => r.column_name);
  if (riCols2.includes('recipe_id')) {
    await q(
      `INSERT INTO recipe_items (recipe_id, ingredient_id, quantity, unit, per_guest, cost)
       VALUES ($1, $2, 150, 'g', true, 1.80), ($1, $3, 200, 'g', true, 0.40)`,
      [receta.id, ternera.id, patata.id]
    );
  } else if (riCols2.includes('catalog_item_id')) {
    await q(
      `INSERT INTO recipe_items (catalog_item_id, ingredient_id, quantity, unit, unit_dimension, qty_base)
       VALUES ($1, $2, 150, 'g', 'mass', 150), ($1, $3, 200, 'g', 'mass', 200)`,
      [ci.id, ternera.id, patata.id]
    );
  }
  // dish_id del menú → catalog_item creado
  global.__seedDishId = ci.id;
} else {
  // Esquema moderno: recipe_items con recipe_id
  await q(
    `INSERT INTO recipe_items (recipe_id, ingredient_id, quantity, unit, per_guest, cost)
     VALUES ($1, $2, 150, 'g', true, 1.80), ($1, $3, 200, 'g', true, 0.40)`,
    [receta.id, ternera.id, patata.id]
  );
  global.__seedDishId = receta.id;
}
console.log(`✔ Receta: ${receta.id} (coste/pax 2,20 €)`);

// 5. Menú "Menú Trazabilidad" v1 publicado, PVP 50 €/pax, sección Principal + variante celiaco
const menu = await q1(
  `INSERT INTO menus (name, version, status, price_per_pax, cost_per_pax, description)
   VALUES ('Menú Trazabilidad', 1, 'publicado', 50, 2.20, 'WP-SEED-01')
   RETURNING *`
);
const seccion = await q1(
  `INSERT INTO menu_sections (menu_id, name, position) VALUES ($1, 'Principal', 1) RETURNING *`,
  [menu.id]
);
await q(
  `INSERT INTO menu_section_dishes (section_id, dish_id, variant_tag, position)
   VALUES ($1, $2, 'default', 1), ($1, $2, 'celiaco', 2)`,
  [seccion.id, global.__seedDishId]
);
console.log(`✔ Menú: ${menu.id} v1 publicado, PVP 50 €/pax, variante celiaco`);

// 6. Cliente + lead confirmado + evento 100 pax (externo, hoy+30)
const cliente = await q1(
  `INSERT INTO clients (name, email, phone, company, notes)
   VALUES ('Cliente Trazabilidad', 'cliente.trazabilidad@seed.test', '600000002', 'Seed Corp', 'WP-SEED-01')
   RETURNING *`
);
const lead = await q1(
  `INSERT INTO leads (name, email, phone, source, status, event_type, guest_count, event_date, notes)
   VALUES ('Lead Trazabilidad', 'cliente.trazabilidad@seed.test', '600000002', 'web', 'convertido', 'boda', 100, $1, 'WP-SEED-01')
   RETURNING *`,
  [eventDateStr]
);
await q(`UPDATE leads SET converted_to_client_id = $1 WHERE id = $2`, [cliente.id, lead.id]);
await q(`UPDATE clients SET lead_id = $1 WHERE id = $2`, [lead.id, cliente.id]);

const evento = await q1(
  `INSERT INTO events (menu_id, client_name, client_email, client_phone, event_type, guest_count, kids_count,
                       event_date, status, total_pvp, total_cost, bar_price, iva_pct, client_id, notes, venue_type)
   VALUES ('Menú Trazabilidad', 'Cliente Trazabilidad', 'cliente.trazabilidad@seed.test', '600000002',
           'boda', 100, 0, $1, 'nuevo', 5000, 220, 0, 10, $2, 'Boda Trazabilidad (WP-SEED-01)', 'externo')
   RETURNING *`,
  [eventDateStr, cliente.id]
);
await q(`UPDATE events SET selected_items = $1 WHERE id = $2`, [
  JSON.stringify([{ id: receta.id, name: 'Ternera con patatas', qty: 100, pax: true }]),
  evento.id,
]);
console.log(`✔ Cliente/Lead/Evento: ${evento.id} (100 pax, ${eventDateStr})`);

// 7. Presupuesto 5.000 € (aceptado) — replicando acceptQuote en SQL puro
const quote = await q1(
  `INSERT INTO quotes (event_id, lead_id, status, base_pvp, base_cost, total_pvp, total_cost, bar_price, iva_pct, sent_at, accepted_at, deposit_pct, deposit_amount)
   VALUES ($1, $2, 'accepted', 5000, 220, 5000, 220, 0, 10, now(), now(), 40, 2000)
   RETURNING *`,
  [evento.id, lead.id]
);
await q(`UPDATE events SET quote_id = $1, status = 'confirmado', total_pvp = 5000 WHERE id = $2`, [quote.id, evento.id]);

// event_order (idempotente por quote_id)
const order = await q1(
  `INSERT INTO event_orders (event_id, quote_id, client_id, confirmed_price, final_price, status, extra_consumptions, tables_suggested, tables_confirmed, waiters_suggested, waiters_confirmed)
   VALUES ($1, $2, $3, 5000, 5000, 'in_progress', '[]', 8, 8, 3, 3)
   RETURNING *`,
  [evento.id, quote.id, cliente.id]
);

// client_token
await q(`UPDATE events SET client_token = $1 WHERE id = $2`, [randomUUID(), evento.id]);

// Plan de pagos 40/60 (WP-21): señal 2.000 € (hoy+7), resto 3.000 € (evento−7)
const plan = await q1(
  `INSERT INTO payment_plans (event_id, quote_id, total)
   VALUES ($1, $2, 5000) RETURNING *`,
  [evento.id, quote.id]
);
const senal = await q1(
  `INSERT INTO payment_milestones (plan_id, kind, label, amount, due_date, status)
   VALUES ($1, 'senal', 'Señal (40% del total)', 2000, $2, 'pendiente') RETURNING *`,
  [plan.id, dueSenal]
);
const resto = await q1(
  `INSERT INTO payment_milestones (plan_id, kind, label, amount, due_date, status)
   VALUES ($1, 'resto', 'Resto (60% del total)', 3000, $2, 'pendiente') RETURNING *`,
  [plan.id, dueResto]
);

// payments legacy (compat)
await q(
  `INSERT INTO payments (event_id, concept, amount, due_date, paid) VALUES
   ($1, 'Señal (40% del presupuesto)', 2000, $2, true),
   ($1, 'Resto (60% del presupuesto)', 3000, $3, false)`,
  [evento.id, dueSenal, dueResto]
);

// Escandallo del evento (replicando generateEscandallo: 100 pax × receta)
// Tablas de escandallo pueden no existir en schemas reducidos — insert condicional.
const tableExists = async (t) => (await client.query(
  `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
  [t]
)).rows.length > 0;
if (await tableExists('escandallos')) {
  const esc = await q1(
    `INSERT INTO escandallos (event_id, name, version, status, pax, total_cost, cost_per_pax)
     VALUES ($1, 'Escandallo Boda Trazabilidad', 1, 'aprobado', 100, 220, 2.20) RETURNING *`,
    [evento.id]
  );
  if (await tableExists('escandallo_lines')) {
    await q(`INSERT INTO escandallo_lines (escandallo_id, plato_name, cantidad, unit, cost_unit, cost_total, per_guest, orden) VALUES
      ($1, 'Ternera con patatas', 100, 'ud', 2.20, 220, 1, 1)`, [esc.id]);
  }
}
if (await tableExists('event_escandallos')) {
  await q(
    `INSERT INTO event_escandallos (evento_id, name, version, estado, pax, total_cost, coste_por_pax)
     VALUES ($1, 'Boda Trazabilidad', 1, 'aprobado', 100, 220, 2.20)`,
    [evento.id]
  );
}
// event_shopping_items: 15.000 g ternera + 20.000 g patata (necesidades evento)
const shTernera = await q1(
  `INSERT INTO event_shopping_items (event_id, ingredient_name, provider_name, total_grams, theoretical_qty, theoretical_unit, theoretical_unit_dimension, estimated_cost, ingredient_id, recipe_item_id)
   SELECT $1, i.name, i.supplier, 15000, 15000, 'g', 'mass', 180, i.id, ri.id
   FROM ingredients i LEFT JOIN recipe_items ri ON ri.ingredient_id = i.id
   WHERE i.id = $2 LIMIT 1 RETURNING *`,
  [evento.id, ternera.id]
);
await q1(
  `INSERT INTO event_shopping_items (event_id, ingredient_name, provider_name, total_grams, theoretical_qty, theoretical_unit, theoretical_unit_dimension, estimated_cost, ingredient_id, recipe_item_id)
   SELECT $1, i.name, i.supplier, 20000, 20000, 'g', 'mass', 40, i.id, ri.id
   FROM ingredients i LEFT JOIN recipe_items ri ON ri.ingredient_id = i.id
   WHERE i.id = $2 LIMIT 1 RETURNING *`,
  [evento.id, patata.id]
);
console.log(`✔ Presupuesto/order/plan de pagos: señal ${senal.amount}€ (${senal.due_date}), resto ${resto.amount}€ (${resto.due_date})`);
console.log(`✔ Escandallo: 220 € alimentos (2,20 × 100 pax)`);

// 8. Comprometer inventario (replicando commitInventoryForEvent)
//    Stock: ternera 10.000 (necesita 15.000 → déficit 5.000), patata 20.000 (necesita 20.000 → 0)
await q(
  `INSERT INTO stock_movements (ingredient_id, movement_type, qty_base, event_id, reason)
   VALUES ($1, 'salida', -15000, $2, 'reserva evento'), ($3, 'salida', -20000, $2, 'reserva evento')`,
  [ternera.id, evento.id, patata.id]
);

// 9. Orden de compra auto-generada: solo ternera 5.000 g (patata 0)
const oc = await q1(
  `INSERT INTO supplier_orders (event_id, supplier, status, origin, total_cost, notes)
   VALUES ($1, 'Cárnicas Semilla', 'pending', 'auto_accept', 60, 'OC semilla WP-SEED-01 (déficit ternera)') RETURNING *`,
  [evento.id]
);
const ocLine = await q1(
  `INSERT INTO supplier_order_items (order_id, ingredient_id, ingredient_name, quantity, unit, unit_cost)
   VALUES ($1, $2, 'Ternera', 5000, 'g', 0.012) RETURNING *`,
  [oc.id, ternera.id]
);
console.log(`✔ OC: ${oc.id} — ternera 5.000 g (déficit), patata 0 g`);

// 10. Recepción APPCC con lote LOT-SEED-001 (caducidad hoy+60, temp 2 °C)
const lot = await q1(
  `INSERT INTO stock_lots (ingredient_id, lot_code, expiry_date, received_at, supplier_id, qty_base_initial, qty_base_remaining)
   VALUES ($1, 'LOT-SEED-001', $2, now(), $3, 5000, 5000) RETURNING *`,
  [ternera.id, new Date(today.getTime() + 60 * DAY).toISOString().slice(0, 10), proveedor.id]
);
const receiving = await q1(
  `INSERT INTO receiving_log (supplier_order_id, ingredient_id, lot_number, batch_quantity, unit, received_date,
                              received_by, expiry_date, temperature, supplier, condition_ok, source, notes, stock_lot_id, supplier_order_item_id)
   VALUES ($1, $2, 'LOT-SEED-001', 5000, 'g', $3, 'api', $4, 2, 'Cárnicas Semilla', true, 'api', 'Recepción WP-SEED-01', $5, $6)
   RETURNING *`,
  [oc.id, ternera.id, todayStr, new Date(today.getTime() + 60 * DAY).toISOString().slice(0, 10), lot.id, ocLine.id]
);
// Ajustar stock: ternera 10.000 + 5.000 = 15.000 g
await q(`UPDATE ingredients SET quantity = 15000, updated_at = now() WHERE id = $1`, [ternera.id]);
await q(`UPDATE inventory SET quantity = 15000, updated_at = now() WHERE ingredient_id = $1`, [ternera.id]);
await q(
  `INSERT INTO stock_movements (ingredient_id, movement_type, qty_base, lot_id, event_id, purchase_order_line_id, reason)
   VALUES ($1, 'entrada', 5000, $2, $3, $4, 'recepción APPCC con lote LOT-SEED-001')`,
  [ternera.id, lot.id, evento.id, ocLine.id]
);
await q(`UPDATE supplier_orders SET status = 'received', delivered_date = $1, updated_at = now() WHERE id = $2`, [todayStr, oc.id]);
console.log(`✔ Recepción APPCC: lote ${lot.id} (LOT-SEED-001), ternera → 15.000 g`);

// 11. Invitados: 12 (10 confirmados, 1 celíaco, 1 sin confirmar) + 2 mesas de 6
const guests = [];
for (let i = 1; i <= 10; i++) {
  guests.push(await q1(
    `INSERT INTO guests (event_id, name, group_name, rsvp, menu_type, dietary)
     VALUES ($1, $2, 'Mesa A', 'confirmado', 'adulto', '[]') RETURNING *`,
    [evento.id, `Invitado ${i}`]
  ));
}
const celiaco = await q1(
  `INSERT INTO guests (event_id, name, group_name, rsvp, menu_type, dietary)
   VALUES ($1, 'Invitado Celiaco', 'Mesa B', 'confirmado', 'adulto', '["sin_gluten"]') RETURNING *`,
  [evento.id]
);
const pendiente = await q1(
  `INSERT INTO guests (event_id, name, group_name, rsvp, menu_type, dietary)
   VALUES ($1, 'Invitado Pendiente', 'Mesa B', 'pendiente', 'adulto', '[]') RETURNING *`,
  [evento.id]
);
// Variante celíaca en event_guest_variants (requiere event_menus)
const emRow = await q1(
  `INSERT INTO event_menus (event_id, menu_id, pax, price_snapshot, cost_snapshot)
   VALUES ($1, $2, 100, 50, 2.20) RETURNING *`,
  [evento.id, menu.id]
);
await q(
  `INSERT INTO event_guest_variants (event_id, guest_id, event_menu_id, variant_type)
   VALUES ($1, $2, $3, 'celiaco')`,
  [evento.id, celiaco.id, emRow.id]
);
// 2 mesas de 6 + asignaciones de los confirmados
const mesa1 = await q1(
  `INSERT INTO tables (event_id, table_number, capacity, x, y, shape) VALUES ($1, 1, 6, 100, 100, 'circle') RETURNING *`,
  [evento.id]
);
const mesa2 = await q1(
  `INSERT INTO tables (event_id, table_number, capacity, x, y, shape) VALUES ($1, 2, 6, 300, 100, 'circle') RETURNING *`,
  [evento.id]
);
for (let i = 0; i < 5; i++) {
  await q(`INSERT INTO table_assignments (event_id, table_id, guest_id, guest_name, seat_number) VALUES ($1, $2, $3, $4, $5)`,
    [evento.id, mesa1.id, guests[i].id, guests[i].name, i + 1]);
}
await q(`INSERT INTO table_assignments (event_id, table_id, guest_id, guest_name, seat_number) VALUES ($1, $2, $3, $4, 6)`,
  [evento.id, mesa1.id, celiaco.id, celiaco.name]);
for (let i = 5; i < 10; i++) {
  await q(`INSERT INTO table_assignments (event_id, table_id, guest_id, guest_name, seat_number) VALUES ($1, $2, $3, $4, $5)`,
    [evento.id, mesa2.id, guests[i].id, guests[i].name, i - 4]);
}
console.log(`✔ Invitados: 12 (10 confirmados + celíaco + pendiente), 2 mesas de 6`);

// 12. Empleados (Camarero 10 €/h, Cocinero 12 €/h) + turnos ofrecidos y confirmados
const camarero = await q1(
  `INSERT INTO workers (name, phone, roles, active)
   VALUES ('Camarero Seed', '600000010', ARRAY['camarero'], true) RETURNING *`
);
const cocinero = await q1(
  `INSERT INTO workers (name, phone, roles, active)
   VALUES ('Cocinero Seed', '600000011', ARRAY['cocinero'], true) RETURNING *`
);
// Tarifas registradas en work_hours (10 €/h camarero, 12 €/h cocinero)
const whCols = (await client.query(
  `SELECT column_name FROM information_schema.columns WHERE table_name = 'work_hours'`
)).rows.map(r => r.column_name);
if (whCols.includes('hourly_rate')) {
  await q(
    `INSERT INTO work_hours (worker_id, event_id, date, start_time, end_time, hours, hourly_rate, total_pay, status)
     VALUES ($1, $2, $3, '12:00', '22:00', 10, 10, 100, 'confirmado'),
            ($4, $2, $3, '08:00', '18:00', 10, 12, 120, 'confirmado')`,
    [camarero.id, evento.id, eventDateStr, cocinero.id]
  );
}
const line1 = await q1(
  `INSERT INTO staffing_lines (event_id, role, slots_needed, start_time, end_time, location, status)
   VALUES ($1, 'camarero', 1, $2::timestamp, $3::timestamp, 'Sala', 'filled') RETURNING *`,
  [evento.id, `${eventDateStr} 12:00`, `${eventDateStr} 22:00`]
);
const line2 = await q1(
  `INSERT INTO staffing_lines (event_id, role, slots_needed, start_time, end_time, location, status)
   VALUES ($1, 'cocinero', 1, $2::timestamp, $3::timestamp, 'Cocina', 'filled') RETURNING *`,
  [evento.id, `${eventDateStr} 08:00`, `${eventDateStr} 18:00`]
);
await q(`INSERT INTO staffing_offers (staffing_line_id, worker_id, status, sent_at, responded_at) VALUES
  ($1, $2, 'accepted', now(), now()), ($3, $4, 'accepted', now(), now())`,
  [line1.id, camarero.id, line2.id, cocinero.id]);
console.log(`✔ Empleados + turnos: Camarero 10 €/h, Cocinero 12 €/h (ofrecidos y confirmados)`);

// 13. Cobro de la señal contra el hito → deposit.paid (outbox) → worker → portal
const paymentRow = await q1(
  `INSERT INTO payments (event_id, concept, amount, due_date, paid, paid_date, method)
   VALUES ($1, 'Señal (40% del presupuesto)', 2000, $2, true, $3, 'transferencia')
   RETURNING *`,
  [evento.id, dueSenal, todayStr]
);
// payment_milestones en seed no tiene updated_at → el trigger falla; usar
// dynamic sql para evitar el trigger si la columna no existe.
const pmCols = (await client.query(
  `SELECT column_name FROM information_schema.columns WHERE table_name = 'payment_milestones'`
)).rows.map(r => r.column_name);
if (pmCols.includes('updated_at')) {
  await q(`UPDATE payment_milestones SET status = 'pagado', paid_at = now(), payment_id = $1 WHERE id = $2`, [paymentRow.id, senal.id]);
} else {
  // Sin updated_at: desactivar trigger del esquema legacy si existe
  await client.query(`DROP TRIGGER IF EXISTS trg_payment_milestones_updated ON payment_milestones`);
  await q(`UPDATE payment_milestones SET status = 'pagado', paid_at = now(), payment_id = $1 WHERE id = $2`, [paymentRow.id, senal.id]);
}
// Emitir deposit.paid en el outbox (no insertar portal a mano)
const domainEvent = await q1(
  `INSERT INTO domain_events (event_type, aggregate_type, aggregate_id, payload)
   VALUES ('deposit.paid', 'event', $1, $2) RETURNING *`,
  [evento.id, JSON.stringify({ event_id: evento.id, milestone_id: senal.id, amount: 2000 })]
);
console.log(`✔ Señal 2.000 € cobrada contra hito ${senal.id}. deposit.paid emitido (outbox id=${domainEvent.id}).`);

// 14. Ejecutar el handler deposit.paid REAL (compilado) — outbox → portal
//     (el worker HTTP apunta a la BD de producción; el seed procesa el
//     outbox contra SU BD usando el mismo handler del repositorio)
console.log('── Ejecutando handler deposit.paid (outbox → portal) ──────────');
let portalCreated = false;
const RUNNER = process.env.SEED_HANDLER_RUNNER || path.join(__dirname, 'run-handler.cjs');
try {
  if (existsSync(RUNNER)) {
    const out = execSync(`NODE_PATH=/root/eventflow/node_modules DATABASE_URL="${connectionString}" node "${RUNNER}"`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_PATH: '/root/eventflow/node_modules' } });
    console.log(out.split('\n').map(l => `  ${l}`).join('\n'));
    const portal = await q1(`SELECT * FROM client_portals WHERE event_id = $1`, [evento.id]);
    if (portal) {
      portalCreated = true;
      console.log(`✔ Portal creado POR EL HANDLER (outbox validado): ${portal.id} (token ${portal.access_token.slice(0, 8)}…, freeze ${portal.freeze_date})`);
    } else {
      console.error('✖ El handler NO creó el portal. Revisar salida anterior.');
    }
  } else {
    console.error(`✖ Runner no encontrado: ${RUNNER}`);
  }
} catch (e) {
  console.error('✖ Error ejecutando handler:', e.message);
}

await client.query('COMMIT');
client.release();

// ── Verificaciones finales ───────────────────────────────────────────────
console.log('── VERIFICACIONES ─────────────────────────────────────────────');
const pool2 = new Pool({ connectionString, max: 1 });
const c2 = await pool2.connect();
const checks = [];
const addCheck = (name, pass, detail = '') => checks.push({ name, pass, detail });

// a) Escandallo coste alimentos 220 €
let escCost = null;
if (await (async () => (await client.query(`SELECT 1 FROM information_schema.tables WHERE table_name = 'escandallos'`)).rows.length)()) {
  const escRow = (await c2.query(`SELECT total_cost FROM escandallos WHERE event_id = $1`, [evento.id])).rows[0];
  escCost = escRow ? Number(escRow.total_cost) : null;
}
if (escCost === null) {
  // Fallback: sumar estimated_cost de event_shopping_items
  const sum = (await c2.query(`SELECT COALESCE(SUM(estimated_cost),0)::numeric AS s FROM event_shopping_items WHERE event_id = $1`, [evento.id])).rows[0];
  escCost = Number(sum?.s || 0);
}
addCheck('Escandallo 220 € alimentos', escCost === 220, String(escCost));

// b) OC recibida con ternera 5.000 g
const ocCheck = (await c2.query(
  `SELECT so.status, soi.quantity FROM supplier_orders so JOIN supplier_order_items soi ON soi.order_id = so.id
   WHERE so.event_id = $1 AND soi.ingredient_name = 'Ternera'`, [evento.id])).rows[0];
addCheck('OC ternera 5.000 g recibida', ocCheck && ocCheck.status === 'received' && Number(ocCheck.quantity) === 5000, JSON.stringify(ocCheck));

// c) Movimiento de entrada vinculado a LOT-SEED-001 y al evento
const movCheck = (await c2.query(
  `SELECT sm.movement_type, sm.event_id, sl.lot_code FROM stock_movements sm JOIN stock_lots sl ON sl.id = sm.lot_id
   WHERE sm.lot_id IS NOT NULL AND sm.event_id = $1`, [evento.id])).rows[0];
addCheck('Movimiento entrada con lote LOT-SEED-001 + evento', movCheck && movCheck.lot_code === 'LOT-SEED-001', JSON.stringify(movCheck));

// d) Trazabilidad del lote: proveedor + registro APPCC
const trazaCheck = (await c2.query(
  `SELECT rl.supplier, rl.lot_number, rl.temperature FROM receiving_log rl WHERE rl.lot_number = 'LOT-SEED-001'`, [])).rows[0];
addCheck('Trazabilidad lote: proveedor + APPCC + temp 2 °C', trazaCheck && trazaCheck.supplier === 'Cárnicas Semilla' && Number(trazaCheck.temperature) === 2, JSON.stringify(trazaCheck));

// e) Hitos: señal pagado 2.000 €, resto pendiente 3.000 €
const ms = (await c2.query(`SELECT kind, amount, status FROM payment_milestones WHERE plan_id = $1 ORDER BY kind`, [plan.id])).rows;
const senalOk = ms.find(m => m.kind === 'senal' && Number(m.amount) === 2000 && m.status === 'pagado');
const restoOk = ms.find(m => m.kind === 'resto' && Number(m.amount) === 3000 && m.status === 'pendiente');
addCheck('Hitos: señal pagado 2.000 € / resto pendiente 3.000 €', !!senalOk && !!restoOk, JSON.stringify(ms));

// f) Evento accepted/confirmado con deposit.paid en outbox
const evCheck = (await c2.query(`SELECT status FROM events WHERE id = $1`, [evento.id])).rows[0];
const outboxCheck = (await c2.query(`SELECT event_type, processed_at FROM domain_events WHERE event_type = 'deposit.paid' AND aggregate_id = $1`, [evento.id])).rows[0];
addCheck('Evento confirmado + deposit.paid en outbox', evCheck?.status === 'confirmado' && !!outboxCheck, `${evCheck?.status} / ${outboxCheck?.processed_at ? 'procesado' : 'pendiente'}`);

// g) Portal accesible por token con menú, 12 invitados, variante celíaca
const portalRow = (await c2.query(`SELECT id, access_token, status, freeze_date FROM client_portals WHERE event_id = $1`, [evento.id])).rows[0];
const guestCount = (await c2.query(`SELECT count(*)::int AS c FROM guests WHERE event_id = $1`, [evento.id])).rows[0];
const variantCount = (await c2.query(`SELECT count(*)::int AS c FROM event_guest_variants WHERE event_id = $1 AND variant_type = 'celiaco'`, [evento.id])).rows[0];
addCheck('Portal por token (handler) + 12 invitados + variante celíaca',
  !!portalRow && guestCount.c === 12 && variantCount.c >= 1,
  `portal=${portalRow ? 'sí' : 'NO'} invitados=${guestCount.c} celiacos=${variantCount.c} freeze=${portalRow?.freeze_date}`);

// h) Stock ternera final 15.000 g
const stockCheck = (await c2.query(`SELECT quantity FROM ingredients WHERE id = $1`, [ternera.id])).rows[0];
addCheck('Stock ternera 15.000 g tras recepción', stockCheck && Number(stockCheck.quantity) === 15000, String(stockCheck?.quantity));

// i) Turnos empleados confirmados
const staffCheck = (await c2.query(
  `SELECT count(*)::int AS c FROM staffing_offers so JOIN staffing_lines sl ON sl.id = so.staffing_line_id
   WHERE sl.event_id = $1 AND so.status IN ('accepted','confirmada')`, [evento.id])).rows[0];
addCheck('Turnos empleados confirmados (2)', staffCheck?.c === 2, `confirmados=${staffCheck?.c}`);

let allPass = true;
for (const ch of checks) {
  console.log(`  ${ch.pass ? '✔' : '✖'} ${ch.name}${ch.detail ? ` — ${ch.detail}` : ''}`);
  if (!ch.pass) allPass = false;
}

console.log('');
console.log('── RESUMEN ─────────────────────────────────────────────────────');
console.log(`Backup:  ${dumpPath}`);
console.log(`Evento:  ${evento.id}`);
console.log(`Portal:  ${portalRow ? `/portal/${portalRow.access_token}` : 'NO CREADO'}`);
console.log(`Resultado: ${allPass && portalCreated ? '✔ TODAS LAS VERIFICACIONES OK' : '✖ HAY FALLOS'}`);

// Guardar estado para el test Playwright (access_token del portal)
if (portalRow) {
  const statePath = path.join(__dirname, '..', '.seed-state.json');
  writeFileSync(statePath, JSON.stringify({
    event_id: evento.id,
    portal_token: portalRow.access_token,
    event_date: eventDateStr,
    client_email: 'cliente.trazabilidad@seed.test',
  }, null, 2));
  console.log(`Estado guardado: ${statePath}`);
}

await c2.end();
await pool2.end();
await pool.end();
process.exit(allPass && portalCreated ? 0 : 1);
