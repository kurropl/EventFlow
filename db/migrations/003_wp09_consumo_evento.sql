-- ============================================================
-- WP-09: Consumo por Evento desde Carga y Retorno
-- Migración: tabla de retornos + modificaciones a event_shopping_items
-- ============================================================

-- 1. Tabla de retornos de consumibles por evento
CREATE TABLE IF NOT EXISTS event_consumable_returns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  ingredient_id   UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  ingredient_name TEXT NOT NULL,
  quantity_returned NUMERIC(14,4) NOT NULL DEFAULT 0,
  unit            TEXT NOT NULL DEFAULT 'g',
  lot_id          INT REFERENCES stock_lots(id) ON DELETE SET NULL,
  notes           TEXT,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ecr_event ON event_consumable_returns(event_id);
CREATE INDEX IF NOT EXISTS idx_ecr_ingredient ON event_consumable_returns(ingredient_id);
ALTER TABLE event_consumable_returns DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE event_consumable_returns IS 'Retornos de consumibles por evento. WP-09.';
COMMENT ON COLUMN event_consumable_returns.quantity_returned IS 'Cantidad devuelta en unidad base del ingrediente.';

-- Trigger para updated_at
DROP TRIGGER IF EXISTS trg_ecr_updated ON event_consumable_returns;
CREATE TRIGGER trg_ecr_updated BEFORE UPDATE ON event_consumable_returns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. Añadir columna de cantidad consumida real a event_shopping_items
-- (para tracking preciso de lo que realmente se usó vs lo planificado)
ALTER TABLE event_shopping_items ADD COLUMN IF NOT EXISTS actual_qty_base NUMERIC(14,4);
ALTER TABLE event_shopping_items ADD COLUMN IF NOT EXISTS stock_movement_id BIGINT;

COMMENT ON COLUMN event_shopping_items.actual_qty_base IS 'Cantidad real consumida en unidad base. WP-09.';
COMMENT ON COLUMN event_shopping_items.stock_movement_id IS 'ID del movimiento de stock asociado. WP-09.';

-- 3. Script de verificación
DO $$
BEGIN
  -- Verificar que la tabla se creó correctamente
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_consumable_returns') THEN
    RAISE NOTICE 'WP-09 OK: Tabla event_consumable_returns creada correctamente';
  ELSE
    RAISE WARNING 'WP-09 ERROR: Tabla event_consumable_returns no existe';
  END IF;
  
  -- Verificar columnas añadidas
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'event_shopping_items' 
             AND column_name = 'actual_qty_base') THEN
    RAISE NOTICE 'WP-09 OK: Columna actual_qty_base añadida';
  ELSE
    RAISE WARNING 'WP-09 ERROR: Columna actual_qty_base no existe';
  END IF;
END $$;

-- Query de verificación para el agente:
-- SELECT table_name, column_name 
-- FROM information_schema.columns 
-- WHERE table_name IN ('event_consumable_returns', 'event_shopping_items')
-- AND column_name IN ('id', 'event_id', 'ingredient_id', 'actual_qty_base', 'stock_movement_id')
-- ORDER BY table_name, column_name;
