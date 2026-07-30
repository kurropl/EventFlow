# FK-AUDIT.md — Auditoría de Integridad Referencial Evento↔Presupuesto

**Generado por:** WP-03 Integridad Referencial  
**Fecha:** 2026-08-01  
**Migración:** `scripts/2026-08-01-wp03-fk-integrity.sql`

---

## 1. Estado de la FK quotes → events

| Aspecto | Antes (WP-00) | Después (WP-03) |
|---------|---------------|-----------------|
| Columna `quotes.event_id` | EXISTS, nullable, sin backfill | EXISTS, nullable, backfillado |
| FK constraint | `REFERENCES events(id) ON DELETE CASCADE` | Sin cambios (correcto) |
| Unicidad accepted/paid | **NO EXISTÍA** | `uq_one_accepted_quote_per_event` (índice parcial) |
| Defensa en servicio | **NO EXISTÍA** | Check en `acceptQuote()` → 409 si duplicado |

### 1.1 Quotes sin event_id (post-backfill)

Tras ejecutar la migración, las quotes huérfanas se clasifican así:

| Categoría | Acción | Resultado esperado |
|-----------|--------|-------------------|
| lead_id → cliente → evento | Backfill automático (§1a) | event_id poblado |
| lead_id → lead event_date + name → evento | Backfill automático (§1b) | event_id poblado |
| Sin match posible | Status → 'historical' | Requiere revisión humana |

**Query de verificación:**
```sql
SELECT q.id, q.lead_id, q.status, q.total_pvp, q.created_at
FROM quotes q
WHERE q.event_id IS NULL AND q.status != 'historical';
-- Esperado: 0 filas tras backfill completo
```

### 1.2 Unicidad de presupuesto aceptado

**Constraint:** `CREATE UNIQUE INDEX uq_one_accepted_quote_per_event ON quotes(event_id) WHERE status IN ('accepted', 'paid')`

**Defensa en servicio** (`src/lib/domain/acceptQuote.ts`):
```typescript
// WP-03: antes de marcar accepted, verificar que no hay otro
const existingAccepted = await client.query(
  `SELECT id FROM quotes
   WHERE event_id = $1 AND status IN ('accepted', 'paid') AND id != $2
   LIMIT 1`, [eventId, quoteId]
);
if (existingAccepted) {
  throw new AcceptQuoteError('Ya existe un presupuesto aceptado...', 409);
}
```

**Test de aceptación:**
```sql
-- Intentar aceptar dos quotes para el mismo evento → debe fallar
-- (test unitario en src/lib/domain/__tests__/acceptQuote.test.ts)
```

---

## 2. Auditoría de FKs event_id en tablas del dominio

### 2.1 Tablas con event_id NOT NULL (obligatorio)

| Tabla | FK existente | Constraint | NULLs permitidos | Estado |
|-------|-------------|-----------|-----------------|--------|
| `cost_desglose` | ✓ `REFERENCES events(id) ON DELETE CASCADE` | NOT NULL | No | ✅ OK |
| `event_menu_items` | ✓ `REFERENCES events(id) ON DELETE CASCADE` | NOT NULL | No | ✅ OK |
| `event_shopping_items` | ✓ `REFERENCES events(id) ON DELETE CASCADE` | NOT NULL | No | ✅ OK |
| `event_plans` | ✓ `REFERENCES events(id) ON DELETE CASCADE` | NOT NULL | No | ✅ OK |
| `checklist_tasks` | ✓ `REFERENCES events(id) ON DELETE CASCADE` | NOT NULL | No | ✅ OK |
| `worker_event_pay` | ✓ `REFERENCES events(id) ON DELETE CASCADE` | NOT NULL | No | ✅ OK |
| `staffing_lines` | ✓ `REFERENCES events(id) ON DELETE CASCADE` | NOT NULL | No | ✅ OK |
| `event_orders` | ✓ `REFERENCES events(id) ON DELETE CASCADE` | NOT NULL | No | ✅ OK |
| `invoices` | ✓ `REFERENCES events(id) ON DELETE RESTRICT` | NOT NULL | No | ✅ OK |
| `payments` | ✓ `REFERENCES events(id) ON DELETE CASCADE` | NOT NULL | No | ✅ OK |
| `guests` | ✓ `REFERENCES events(id) ON DELETE CASCADE` | NOT NULL | No | ✅ OK |
| `tables` | ✓ `REFERENCES events(id) ON DELETE CASCADE` | NOT NULL | No | ✅ OK |
| `event_floorplans` | ✓ `REFERENCES events(id) ON DELETE CASCADE` | NOT NULL | No | ✅ OK |
| `table_assignments` | ✓ `REFERENCES events(id) ON DELETE CASCADE` | NOT NULL | No | ✅ OK |
| `event_briefings` | ✓ `REFERENCES events(id) ON DELETE CASCADE` | NOT NULL | No | ✅ OK |
| `event_cost_deviations` | ✓ `REFERENCES events(id) ON DELETE CASCADE` | NOT NULL | No | ✅ OK |

### 2.2 Tablas con event_id nullable (genéricos sin evento)

| Tabla | FK existente | Nullable por diseño | Estado |
|-------|-------------|-------------------|--------|
| `quotes` | ✓ `REFERENCES events(id) ON DELETE CASCADE` | Sí (backfill WP-03) | ✅ OK |
| `webhook_logs` | ✓ `REFERENCES events(id)` | Sí (logs genéricos) | ✅ OK |
| `appointments` | ✓ `REFERENCES events(id) ON DELETE SET NULL` | Sí (citas no vinculadas) | ✅ OK |
| `supplier_orders` | ✓ `REFERENCES events(id) ON DELETE SET NULL` | Sí (pedidos reposición) | ✅ OK |
| `stock_entries` | ✓ `REFERENCES events(id) ON DELETE SET NULL` | Sí (movimientos genéricos) | ✅ OK |
| `audit_log` | ✓ `REFERENCES events(id) ON DELETE SET NULL` | Sí (log transversal) | ✅ OK |
| `automation_logs` | ✓ `REFERENCES events(id)` | Sí (logs de reglas) | ✅ OK |
| `haccp_plans` | ✓ `REFERENCES events(id) ON DELETE CASCADE` | Sí (planes genéricos) | ✅ OK |
| `fridge_temperature_log` | ✓ `REFERENCES events(id) ON DELETE SET NULL` | Sí (temperatura diaria) | ✅ OK |
| `cleaning_log` | ✓ `REFERENCES events(id) ON DELETE SET NULL` | Sí (limpieza diaria) | ✅ OK |

### 2.3 Tablas que NO necesitan event_id

| Tabla | Motivo |
|-------|--------|
| `catalog_items` | Catálogo global de platos |
| `proposed_menus` | Menús predefinidos |
| `recipe_items` | Relación plato-ingrediente |
| `recipe_templates` | Plantillas de receta |
| `units_of_measure` | Catálogo de unidades |
| `equipment` | Equipamiento general |
| `equipment_rules` | Reglas de equipamiento |
| `providers` | Proveedores |
| `workers` | Empleados |
| `admins` | Usuarios del sistema |
| `business_settings` | Configuración del negocio |
| `ingredients` | Ingredientes globales |

---

## 3. Tablas que necesitan FK faltante (WP futuro)

| Tabla | Columna faltante | Motivo | WP sugerido |
|-------|-----------------|--------|-------------|
| `event_shopping_items` | `ingredient_id` FK | Ya existe la columna pero sin FK constraint | WP-09 |
| `stock_entries` | `purchase_order_line_id` | Columna planeada en spec | WP-06 |

---

## 4. Resumen de cambios realizados

| Archivo | Cambio |
|---------|--------|
| `scripts/2026-08-01-wp03-fk-integrity.sql` | Migración: backfill + constraint + verificación |
| `src/lib/domain/acceptQuote.ts` | Defensa en profundidad: check duplicado → 409 |
| `docs/FK-AUDIT.md` | Este documento |

---

## 5. Aceptación (comandos de verificación)

```sql
-- 5.1 Quotes sin event_id (debería dar 0 para status != historical)
SELECT COUNT(*) AS orphans
FROM quotes WHERE event_id IS NULL AND status != 'historical';
-- Esperado: 0

-- 5.2 Eventos con múltiples quotes accepted/paid (debería dar 0)
SELECT event_id, COUNT(*) AS cnt
FROM quotes WHERE status IN ('accepted', 'paid')
GROUP BY event_id HAVING COUNT(*) > 1;
-- Esperado: 0 rows

-- 5.3 Constraint creado
SELECT indexname FROM pg_indexes
WHERE indexname = 'uq_one_accepted_quote_per_event';
-- Esperado: 1 row

-- 5.4 FK audit: NULLs en tablas NOT NULL
SELECT
  'cost_desglose' AS tabla,
  COUNT(*) FILTER (WHERE event_id IS NULL) AS null_count,
  COUNT(*) AS total
FROM cost_desglose
UNION ALL SELECT 'event_menu_items', COUNT(*) FILTER (WHERE event_id IS NULL), COUNT(*) FROM event_menu_items
UNION ALL SELECT 'event_shopping_items', COUNT(*) FILTER (WHERE event_id IS NULL), COUNT(*) FROM event_shopping_items
UNION ALL SELECT 'event_plans', COUNT(*) FILTER (WHERE event_id IS NULL), COUNT(*) FROM event_plans
UNION ALL SELECT 'checklist_tasks', COUNT(*) FILTER (WHERE event_id IS NULL), COUNT(*) FROM checklist_tasks
UNION ALL SELECT 'worker_event_pay', COUNT(*) FILTER (WHERE event_id IS NULL), COUNT(*) FROM worker_event_pay
UNION ALL SELECT 'staffing_lines', COUNT(*) FILTER (WHERE event_id IS NULL), COUNT(*) FROM staffing_lines;
-- Esperado: null_count = 0 en todas las tablas NOT NULL
```
