-- ============================================================
-- MIGRACIÓN V1: Presupuesto como raíz del modelo de datos
-- ============================================================
-- Ejecutar con: cat /path/file | ssh host "docker exec -i postgres psql -d eventflow"
-- ============================================================

BEGIN;

-- 1. Añadir 'historical' a quotes status CHECK
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_status_check;
ALTER TABLE quotes ADD CONSTRAINT quotes_status_check
  CHECK (status = ANY (ARRAY['draft', 'sent', 'accepted', 'rejected', 'expired', 'historical']));

-- 2. Añadir quote_id a events
ALTER TABLE events ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL;

-- 3. Poblar quote_id para eventos con quote existente
UPDATE events e SET quote_id = q.id
FROM quotes q
WHERE q.event_id = e.id;

-- 4. Crear quotes implícitos para eventos huérfanos
INSERT INTO quotes (id, event_id, status, base_pvp, base_cost, total_pvp, total_cost, notes)
SELECT uuid_generate_v4(), e.id, 'historical', 0, 0, 0, 0,
  'Presupuesto implícito generado en migración 2026-06-21'
FROM events e
LEFT JOIN quotes q ON q.event_id = e.id
WHERE q.id IS NULL;

-- 5. Asignar los nuevos quotes a los eventos
UPDATE events e SET quote_id = q.id
FROM quotes q
WHERE q.event_id = e.id AND e.quote_id IS NULL;

-- 6. Verificar (falla si hay eventos sin quote)
DO $$
DECLARE
  missing_count INT;
BEGIN
  SELECT COUNT(*) INTO missing_count FROM events WHERE quote_id IS NULL;
  IF missing_count > 0 THEN
    RAISE EXCEPTION '% eventos sin quote', missing_count;
  END IF;
END $$;

-- 7. Hacer event_id nullable en quotes
ALTER TABLE quotes ALTER COLUMN event_id DROP NOT NULL;

-- 8. Añadir event_id a supplier_orders
ALTER TABLE supplier_orders ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE SET NULL;
ALTER TABLE supplier_orders ADD COLUMN IF NOT EXISTS origin TEXT;

-- 9. Añadir items column a quotes
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;

-- 10. Eliminar staff_assignments
DROP TABLE IF EXISTS staff_assignments CASCADE;

-- 11. Crear stock_entries
CREATE TABLE IF NOT EXISTS stock_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'g',
  movement_reason TEXT NOT NULL DEFAULT 'operativo'
    CHECK (movement_reason IN ('operativo', 'compra_prevision', 'merma', 'ajuste_inventario', 'inventario_inicial')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMIT;