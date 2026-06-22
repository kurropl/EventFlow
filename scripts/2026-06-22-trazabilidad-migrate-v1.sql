-- ============================================================
-- MIGRACIÓN TRAZABILIDAD V1
-- ============================================================

-- 1. inventory — Stock actual por ingrediente
CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'g',
    min_stock NUMERIC(12,3) DEFAULT 0,
    last_movement_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(ingredient_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_ingredient ON inventory(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_inventory_min ON inventory(min_stock);

-- 2. inventory_movements — Historial de cada movimiento
CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('receipt','consumption','adjustment','expiry','transfer')),
    quantity NUMERIC(12,3) NOT NULL,
    unit TEXT NOT NULL DEFAULT 'g',
    reference_type TEXT,
    reference_id UUID,
    previous_stock NUMERIC(12,3) NOT NULL,
    new_stock NUMERIC(12,3) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_movements_inventory ON inventory_movements(inventory_id);
CREATE INDEX IF NOT EXISTS idx_movements_type ON inventory_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_movements_date ON inventory_movements(created_at);

-- 3. receiving_log — Recepción de mercancía con trazabilidad
CREATE TABLE IF NOT EXISTS receiving_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_order_id UUID REFERENCES supplier_orders(id) ON DELETE SET NULL,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    lot_number TEXT NOT NULL,
    batch_quantity NUMERIC(12,3) NOT NULL,
    unit TEXT NOT NULL DEFAULT 'g',
    received_date DATE NOT NULL DEFAULT CURRENT_DATE,
    received_by TEXT,
    expiry_date DATE,
    temperature NUMERIC(5,2),
    supplier TEXT,
    condition_ok BOOLEAN DEFAULT true,
    source TEXT DEFAULT 'manual' CHECK (source IN ('manual','scan','api')),
    qr_code TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receiving_lot ON receiving_log(lot_number);
CREATE INDEX IF NOT EXISTS idx_receiving_ingredient ON receiving_log(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_receiving_supplier ON receiving_log(supplier);
CREATE INDEX IF NOT EXISTS idx_receiving_date ON receiving_log(received_date);
CREATE INDEX IF NOT EXISTS idx_receiving_order ON receiving_log(supplier_order_id);

-- 4. lot_consumption — Consumo de lote por evento
CREATE TABLE IF NOT EXISTS lot_consumption (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receiving_log_id UUID NOT NULL REFERENCES receiving_log(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    quantity_consumed NUMERIC(12,3) NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'g',
    consumed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lot_consumption_event ON lot_consumption(event_id);
CREATE INDEX IF NOT EXISTS idx_lot_consumption_receiving ON lot_consumption(receiving_log_id);

-- 5. supplier_orders — añadir estado 'received' al CHECK
ALTER TABLE supplier_orders DROP CONSTRAINT IF EXISTS supplier_orders_status_check;
ALTER TABLE supplier_orders ADD CONSTRAINT supplier_orders_status_check
    CHECK (status IN ('pending','approved','delivered','received','partial','cancelled'));

-- 6. Trigger: actualizar inventory.updated_at
CREATE OR REPLACE FUNCTION update_inventory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inventory_updated
    BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION update_inventory_timestamp();