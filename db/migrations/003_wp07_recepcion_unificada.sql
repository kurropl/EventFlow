-- ============================================================
-- WP-07: Recepción Unificada APPCC ↔ Stock ↔ OC
-- Migración: FKs, columnas de enlace, vistas auxiliares
-- ============================================================

-- 1. FK: stock_movements.purchase_order_line_id → supplier_order_items(id)
--    La columna ya existe (WP-02), pero sin FK. La añadimos.
ALTER TABLE stock_movements
  ADD CONSTRAINT fk_sm_pol
  FOREIGN KEY (purchase_order_line_id)
  REFERENCES supplier_order_items(id)
  ON DELETE SET NULL;

-- 2. Añadir columna stock_lot_id a receiving_log para trazar el lote creado
ALTER TABLE receiving_log
  ADD COLUMN IF NOT EXISTS stock_lot_id INT REFERENCES stock_lots(id) ON DELETE SET NULL;

-- 3. Añadir columna supplier_order_item_id a receiving_log para trazar la línea OC específica
ALTER TABLE receiving_log
  ADD COLUMN IF NOT EXISTS supplier_order_item_id UUID REFERENCES supplier_order_items(id) ON DELETE SET NULL;

-- 4. Índices para las nuevas columnas
CREATE INDEX IF NOT EXISTS idx_rl_stock_lot ON receiving_log(stock_lot_id) WHERE stock_lot_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rl_supplier_order_item ON receiving_log(supplier_order_item_id) WHERE supplier_order_item_id IS NOT NULL;

-- 5. Vista auxiliar: líneas OC pendientes (para el selector del formulario)
CREATE OR REPLACE VIEW v_pending_order_lines AS
SELECT
  soi.id AS line_id,
  soi.order_id,
  so.id AS supplier_order_id,
  so.supplier,
  so.status AS order_status,
  soi.ingredient_id,
  i.name AS ingredient_name,
  soi.quantity AS qty_ordered,
  soi.received_quantity AS qty_received,
  soi.quantity - COALESCE(soi.received_quantity, 0) AS qty_pending,
  soi.unit,
  soi.unit_cost,
  soi.cost_per_unit,
  so.expected_date
FROM supplier_order_items soi
JOIN supplier_orders so ON so.id = soi.order_id
JOIN ingredients i ON i.id = soi.ingredient_id
WHERE so.status IN ('pending', 'approved', 'delivered', 'partial')
  AND soi.quantity > COALESCE(soi.received_quantity, 0)
ORDER BY so.expected_date ASC NULLS LAST, so.created_at DESC;

-- 6. Script de verificación
DO $$
BEGIN
  -- Verificar FK creada
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sm_pol'
  ) THEN
    RAISE WARNING 'WP-07: FK fk_sm_pol no se creó correctamente';
  ELSE
    RAISE NOTICE 'WP-07 OK: FK stock_movements→supplier_order_items creada';
  END IF;

  -- Verificar columnas nuevas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'receiving_log' AND column_name = 'stock_lot_id'
  ) THEN
    RAISE WARNING 'WP-07: Columna receiving_log.stock_lot_id no existe';
  ELSE
    RAISE NOTICE 'WP-07 OK: receiving_log.stock_lot_id creada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'receiving_log' AND column_name = 'supplier_order_item_id'
  ) THEN
    RAISE WARNING 'WP-07: Columna receiving_log.supplier_order_item_id no existe';
  ELSE
    RAISE NOTICE 'WP-07 OK: receiving_log.supplier_order_item_id creada';
  END IF;

  -- Verificar vista
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.views WHERE table_name = 'v_pending_order_lines'
  ) THEN
    RAISE WARNING 'WP-07: Vista v_pending_order_lines no existe';
  ELSE
    RAISE NOTICE 'WP-07 OK: Vista v_pending_order_lines creada';
  END IF;
END $$;
