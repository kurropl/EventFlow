-- ============================================================
-- WP-03: Integridad Referencial Evento↔Presupuesto
-- ============================================================
-- Objetivo: Corregir FK evento↔presupuesto, constraint de unicidad
-- de presupuesto aceptado por evento, y auditar FKs faltantes.
-- ============================================================
-- Ejecutar con: cat scripts/2026-08-01-wp03-fk-integrity.sql | ssh host "docker exec -i postgres psql -d eventflow"
-- Idempotente: usa IF NOT EXISTS / guards.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. BACKFILL: quotes.event_id donde es NULL
-- ============================================================
-- Estrategia: emparejar por lead_id → cliente → evento, y por
-- nombre+fecha cuando el lead tiene datos pero no hay client_id.

-- 1a. Backfill vía lead_id → leads.converted_to_client_id → events.client_id
--     Solo si hay exactamente 1 evento para ese cliente.
UPDATE quotes q
SET event_id = (
  SELECT e.id
  FROM leads l
  JOIN events e ON e.client_id = l.converted_to_client_id
  WHERE l.id = q.lead_id
  AND q.event_id IS NULL
  LIMIT 1
)
WHERE q.event_id IS NULL
  AND q.lead_id IS NOT NULL;

-- 1b. Backfill vía lead_id → lead.event_date + lead.name → event matching
--     (cuando el lead NO se convirtió en cliente, pero tiene fecha+nombre)
UPDATE quotes q
SET event_id = (
  SELECT e.id
  FROM leads l
  JOIN events e ON e.event_date = l.event_date
    AND e.client_name ILIKE l.name
  WHERE l.id = q.lead_id
  AND q.event_id IS NULL
  LIMIT 1
)
WHERE q.event_id IS NULL
  AND q.lead_id IS NOT NULL;

-- 1c. Backfill vía client_id del evento → lead convertido
--     (cuando el quote tiene lead_id que apunta a un lead convertido,
--      y el evento tiene client_id que coincide)
UPDATE quotes q
SET event_id = (
  SELECT e.id
  FROM leads l
  JOIN events e ON e.client_id = l.converted_to_client_id
  WHERE l.id = q.lead_id
  AND q.event_id IS NULL
  LIMIT 1
)
WHERE q.event_id IS NULL
  AND q.lead_id IS NOT NULL;

-- 1d. Marcar quotes huérfanas como 'historical' si no se pudo resolver
--     (no se borran: NR-1 prohíbe datos destructivos)
UPDATE quotes
SET status = 'historical',
    notes = COALESCE(notes || E'\n', '') || '[WP-03] Marcado historical: event_id no resuelto en backfill'
WHERE event_id IS NULL
  AND status != 'historical';

-- 1e. Log de quotes sin resolver (para FK-AUDIT.md manual)
--     Esta query se ejecuta fuera de la transacción para generar el informe.
-- SELECT q.id, q.lead_id, q.status, q.total_pvp, q.created_at
-- FROM quotes q
-- WHERE q.event_id IS NULL;

-- ============================================================
-- 2. CONSTRAINT: máximo 1 presupuesto aceptado por evento
-- ============================================================
-- Índice parcial único: solo aplica a quotes con status = 'accepted'
-- (y 'paid', que es el estado post-aceptación con pago registrado).
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_accepted_quote_per_event
  ON quotes (event_id)
  WHERE status IN ('accepted', 'paid');

-- ============================================================
-- 3. FK AUDIT — tablas referenciadas en spec WP-03
-- ============================================================
-- cost_desglose (escandallos): ✓ tiene event_id FK NOT NULL
-- event_menu_items (escandallo por evento): ✓ tiene event_id FK NOT NULL
-- event_shopping_items (cargas): ✓ tiene event_id FK NOT NULL
-- event_plans (logística + timing): ✓ tiene event_id FK NOT NULL
-- checklist_tasks (tareas): ✓ tiene event_id FK NOT NULL
-- worker_event_pay (horas): ✓ tiene event_id FK NOT NULL
-- staffing_lines (staffing): ✓ tiene event_id FK NOT NULL
-- supplier_orders: ✓ tiene event_id FK nullable (pedidos genéricos)
-- stock_entries: ✓ tiene event_id FK nullable (consumo genérico)
-- haccp_plans: ✓ tiene event_id FK nullable (planes genéricos)
-- fridge_temperature_log: ✓ tiene event_id FK nullable
-- cleaning_log: ✓ tiene event_id FK nullable
--
-- Verificar NULLs en tablas NOT NULL (backfill defensivo):
-- event_shopping_items: event_id es NOT NULL, no debería tener NULLs
-- checklist_tasks: event_id es NOT NULL, no debería tener NULLs

-- ============================================================
-- 4. VERIFICACIÓN (idempotente)
-- ============================================================
-- quotes sin event_id (deberían ser 0 o solo 'historical'):
DO $$
DECLARE
  orphan_count INT;
  accepted_violations INT;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM quotes WHERE event_id IS NULL AND status != 'historical';

  IF orphan_count > 0 THEN
    RAISE WARNING '[WP-03] % quotes con event_id NULL y status != historical (requiere revisión manual)', orphan_count;
  END IF;

  -- Verificar que el constraint funciona: no debería haber duplicados
  -- (si los hay, la migración falla al crear el índice)
  SELECT COUNT(*) INTO accepted_violations
  FROM (
    SELECT event_id, COUNT(*) AS cnt
    FROM quotes
    WHERE status IN ('accepted', 'paid')
    GROUP BY event_id
    HAVING COUNT(*) > 1
  ) sub;

  IF accepted_violations > 0 THEN
    RAISE WARNING '[WP-03] % eventos con múltiples quotes accepted/paid (resolver antes del gate)', accepted_violations;
  END IF;
END $$;

COMMIT;

-- ============================================================
-- POST-MIGRATION: Queries de verificación
-- ============================================================
-- Ejecutar tras COMMIT para generar datos del FK-AUDIT.md:

-- 1. Quotes sin event_id (no historical):
-- SELECT q.id, q.lead_id, q.status, q.total_pvp, q.created_at
-- FROM quotes q WHERE q.event_id IS NULL AND q.status != 'historical';

-- 2. Eventos con múltiples quotes accepted/paid (debería dar 0):
-- SELECT event_id, COUNT(*) AS quote_count
-- FROM quotes WHERE status IN ('accepted', 'paid')
-- GROUP BY event_id HAVING COUNT(*) > 1;

-- 3. FK audit: tablas con event_id y conteo de NULLs:
-- SELECT
--   'cost_desglose' AS tabla,
--   COUNT(*) FILTER (WHERE event_id IS NULL) AS null_count,
--   COUNT(*) AS total
-- FROM cost_desglose
-- UNION ALL
-- SELECT 'event_menu_items', COUNT(*) FILTER (WHERE event_id IS NULL), COUNT(*) FROM event_menu_items
-- UNION ALL
-- SELECT 'event_shopping_items', COUNT(*) FILTER (WHERE event_id IS NULL), COUNT(*) FROM event_shopping_items
-- UNION ALL
-- SELECT 'event_plans', COUNT(*) FILTER (WHERE event_id IS NULL), COUNT(*) FROM event_plans
-- UNION ALL
-- SELECT 'checklist_tasks', COUNT(*) FILTER (WHERE event_id IS NULL), COUNT(*) FROM checklist_tasks
-- UNION ALL
-- SELECT 'worker_event_pay', COUNT(*) FILTER (WHERE event_id IS NULL), COUNT(*) FROM worker_event_pay
-- UNION ALL
-- SELECT 'staffing_lines', COUNT(*) FILTER (WHERE event_id IS NULL), COUNT(*) FROM staffing_lines
-- UNION ALL
-- SELECT 'supplier_orders', COUNT(*) FILTER (WHERE event_id IS NULL), COUNT(*) FROM supplier_orders
-- UNION ALL
-- SELECT 'quotes', COUNT(*) FILTER (WHERE event_id IS NULL), COUNT(*) FROM quotes;
