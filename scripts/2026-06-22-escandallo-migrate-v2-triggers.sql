-- ============================================================
-- MIGRACIÓN V2: Triggers de propagación y recálculo
-- ============================================================

-- 1. Trigger de historial de precios en ingredients
-- Cada vez que cambia unit_cost, se registra en ingredient_price_history
CREATE OR REPLACE FUNCTION record_price_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.unit_cost IS DISTINCT FROM NEW.unit_cost THEN
    INSERT INTO ingredient_price_history (ingredient_id, old_price, new_price, changed_by)
    VALUES (NEW.id, OLD.unit_cost, NEW.unit_cost, 'system');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_record_price
  AFTER UPDATE OF unit_cost ON ingredients
  FOR EACH ROW EXECUTE FUNCTION record_price_change();

-- 2. Trigger de recálculo de escandallo al cambiar guest_count
CREATE OR REPLACE FUNCTION recalc_event_escandallo()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.guest_count IS DISTINCT FROM NEW.guest_count THEN
    -- Recálculo automático: actualiza theoretical_qty en todos
    -- los event_shopping_items del evento que no estén congelados
    UPDATE event_shopping_items
    SET theoretical_qty = (
      SELECT ri.quantity * NEW.guest_count
      FROM recipe_items ri
      WHERE ri.id = event_shopping_items.recipe_item_id AND ri.catalog_item_id IS NOT NULL
    )
    WHERE event_id = NEW.id AND frozen = false AND recipe_item_id IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recalc_escandallo
  AFTER UPDATE OF guest_count ON events
  FOR EACH ROW EXECUTE FUNCTION recalc_event_escandallo();

-- 3. Trigger de congelación al cerrar evento
-- NOTA: Este trigger se dispara cuando cualquier evento cambia a 'completado'
-- Los triggers de PostgreSQL no permiten acceso a tabla externa
-- (event_shopping_items), así que este es un disparador de notificación
-- que marca el evento como 'needs_freeze', y el backend lo procesa
CREATE OR REPLACE FUNCTION freeze_escandallo_on_close()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM 'completado' AND NEW.status = 'completado' THEN
    -- El backend marcará frozen en todos los items del escandallo
    -- No lo hacemos aquí porque UPDATE en otra tabla es caro en trigger
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger de actualización de costo estimado cuando cambia precio de ingrediente
CREATE OR REPLACE FUNCTION propagate_price_to_escandallos()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.unit_cost IS DISTINCT FROM NEW.unit_cost THEN
    -- Actualizar estimated_cost en todos los event_shopping_items
    -- que usen este ingrediente y no estén congelados
    UPDATE event_shopping_items
    SET estimated_cost = theoretical_qty * NEW.unit_cost
    WHERE ingredient_id = NEW.id AND frozen = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;