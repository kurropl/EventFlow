-- ============================================================
-- Migración 022 — WP-21: Plan de pagos, hitos y recordatorios
-- ============================================================
-- Crea las tablas payment_plans y payment_milestones para el
-- sistema de hitos de pago configurable. Añade columnas de
-- configuración a business_settings.
-- ============================================================

-- 1. Tabla payment_plans: un plan por evento (1:1 con events)
CREATE TABLE IF NOT EXISTS payment_plans (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id    UUID NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
    quote_id    UUID NOT NULL,
    total       NUMERIC(12,2) NOT NULL DEFAULT 0,
    status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_plans_event ON payment_plans(event_id);
ALTER TABLE payment_plans DISABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_payment_plans_updated ON payment_plans;
CREATE TRIGGER trg_payment_plans_updated
    BEFORE UPDATE ON payment_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. Tabla payment_milestones: hitos individuales dentro de un plan
CREATE TABLE IF NOT EXISTS payment_milestones (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id     UUID NOT NULL REFERENCES payment_plans(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL CHECK (kind IN ('senal', 'intermedio', 'resto', 'extra')),
    label       TEXT NOT NULL,
    pct         NUMERIC(5,2) NOT NULL DEFAULT 0,       -- porcentaje del total del plan
    amount      NUMERIC(12,2) NOT NULL DEFAULT 0,      -- importe calculado del hito
    due_date    DATE,                                   -- fecha límite de pago
    status      TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'pagado', 'vencido', 'anulado')),
    paid_at     TIMESTAMPTZ,
    payment_id  UUID,                                   -- FK a payments cuando se registra el cobro
    last_reminder_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_milestones_plan ON payment_milestones(plan_id);
CREATE INDEX IF NOT EXISTS idx_payment_milestones_status ON payment_milestones(status) WHERE status IN ('pendiente', 'vencido');
CREATE INDEX IF NOT EXISTS idx_payment_milestones_due ON payment_milestones(due_date) WHERE status = 'pendiente';
ALTER TABLE payment_milestones DISABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_payment_milestones_updated ON payment_milestones;
CREATE TRIGGER trg_payment_milestones_updated
    BEFORE UPDATE ON payment_milestones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. Columnas de configuración de hitos en business_settings
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS deposit_pct NUMERIC(5,2) NOT NULL DEFAULT 40;
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS deposit_days INT NOT NULL DEFAULT 7;
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS final_days_before_event INT NOT NULL DEFAULT 7;
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS milestone_reminder_days INT NOT NULL DEFAULT 7;

-- ============================================================
-- Verificación
-- ============================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_plans')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_milestones')
    THEN
        RAISE NOTICE 'WP-21 OK: payment_plans y payment_milestones creadas';
    ELSE
        RAISE EXCEPTION 'WP-21 FALLO: tablas no creadas';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_settings' AND column_name = 'deposit_pct')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_settings' AND column_name = 'deposit_days')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_settings' AND column_name = 'final_days_before_event')
    THEN
        RAISE NOTICE 'WP-21 OK: columnas de configuración en business_settings';
    ELSE
        RAISE EXCEPTION 'WP-21 FALLO: columnas de configuración faltantes';
    END IF;
END $$;

-- Verificar que un plan por evento es único (el constraint UNIQUE ya lo garantiza)
SELECT 'payment_plans' AS tabla, count(*) AS filas FROM payment_plans;
SELECT 'payment_milestones' AS tabla, count(*) AS filas FROM payment_milestones;
