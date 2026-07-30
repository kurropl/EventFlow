-- ============================================================
-- WP-02: Movimientos de Stock y Trazabilidad Base
-- Migración: tablas stock_movements + stock_lots + backfill
-- ============================================================

-- 1. Tabla stock_lots (lotes de recepción)
CREATE TABLE IF NOT EXISTS stock_lots (
  id              SERIAL PRIMARY KEY,
  ingredient_id   UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  lot_code        TEXT,
  expiry_date     DATE,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  supplier_id     UUID,
  qty_base_initial   NUMERIC(14,4) NOT NULL,
  qty_base_remaining NUMERIC(14,4) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sl_ingredient ON stock_lots(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_sl_expiry     ON stock_lots(expiry_date) WHERE expiry_date IS NOT NULL;
ALTER TABLE stock_lots DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE stock_lots IS 'Lotes de recepción de ingredientes. WP-02.';
COMMENT ON COLUMN stock_lots.qty_base_initial IS 'Cantidad inicial en unidad base al recibir.';
COMMENT ON COLUMN stock_lots.qty_base_remaining IS 'Cantidad restante en unidad base (se decrementa con salidas).';

-- 2. Tabla stock_movements (libro mayor de movimientos)
CREATE TABLE IF NOT EXISTS stock_movements (
  id              BIGSERIAL PRIMARY KEY,
  ingredient_id   UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  movement_type   TEXT NOT NULL CHECK (movement_type IN (
                    'entrada','salida','merma','ajuste','retorno'
                  )),
  qty_base        NUMERIC(14,4) NOT NULL,
  lot_id          INT REFERENCES stock_lots(id) ON DELETE SET NULL,
  event_id        UUID REFERENCES events(id) ON DELETE SET NULL,
  purchase_order_line_id UUID,
  reason          TEXT,
  user_id         UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sm_ingredient ON stock_movements(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_sm_event      ON stock_movements(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sm_type       ON stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_sm_created    ON stock_movements(created_at);
ALTER TABLE stock_movements DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE stock_movements IS 'Libro mayor de movimientos de stock. WP-02. Stock actual = SUM(qty_base).';
COMMENT ON COLUMN stock_movements.qty_base IS 'Cantidad en unidad base. Entradas positivas, salidas negativas.';
COMMENT ON COLUMN stock_movements.movement_type IS 'entrada|salida|merma|ajuste|retorno';

-- 3. Backfill: movimiento inicial 'ajuste' por cada ingrediente con stock > 0
-- Un solo movimiento 'ajuste' con reason='Saldo inicial migración WP-02' por ingrediente
INSERT INTO stock_movements (ingredient_id, movement_type, qty_base, reason, created_at)
SELECT
  i.id,
  'ajuste',
  i.quantity,
  'Saldo inicial migración WP-02',
  now()
FROM ingredients i
WHERE i.quantity > 0
  AND NOT EXISTS (
    SELECT 1 FROM stock_movements sm
    WHERE sm.ingredient_id = i.id
      AND sm.movement_type = 'ajuste'
      AND sm.reason = 'Saldo inicial migración WP-02'
  );

-- 4. Script de verificación: SUM(qty_base) = ingredients.quantity
DO $$
DECLARE
  v_mismatches BIGINT;
BEGIN
  SELECT count(*) INTO v_mismatches
  FROM ingredients i
  LEFT JOIN (
    SELECT ingredient_id, SUM(qty_base) AS total_movements
    FROM stock_movements
    GROUP BY ingredient_id
  ) sm ON sm.ingredient_id = i.id
  WHERE COALESCE(sm.total_movements, 0) != i.quantity
    AND i.active = true;

  IF v_mismatches > 0 THEN
    RAISE WARNING 'WP-02: % ingredientes con desfase entre movimientos y cache (revisar)', v_mismatches;
  ELSE
    RAISE NOTICE 'WP-02 OK: Stock cache coherente con movimientos para todos los ingredientes activos';
  END IF;
END $$;

-- Query de verificación para el agente (ejecutar después de backfill):
-- SELECT
--   i.name,
--   i.quantity AS stock_cache,
--   COALESCE(sm.total_movements, 0) AS total_movimientos,
--   CASE WHEN COALESCE(sm.total_movements, 0) = i.quantity THEN 'OK' ELSE 'DESFASE' END AS estado
-- FROM ingredients i
-- LEFT JOIN (
--   SELECT ingredient_id, SUM(qty_base) AS total_movements
--   FROM stock_movements
--   GROUP BY ingredient_id
-- ) sm ON sm.ingredient_id = i.id
-- WHERE i.active = true
-- ORDER BY i.name;
