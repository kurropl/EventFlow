-- Migración APPCC — Análisis de Peligros y Puntos Críticos de Control
-- EventFlow ERP, J.Benitez
-- Fecha: 2026-06-22
--
-- Relaciones:
--   haccp_plans → events
--   haccp_critical_limits → haccp_plans
--   haccp_monitoring → haccp_critical_limits
--   fridge_temperature_log → events (opcional, para vinculación a evento)
--   cleaning_log → events (opcional)
--   supplier_approval → providers
--   traceability_log → events, ingredients, recipes, (lot via receiving_log)

BEGIN;

-- ===================================================================
-- 1. Planes APPCC
-- ===================================================================
CREATE TABLE IF NOT EXISTS haccp_plans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID REFERENCES events(id) ON DELETE CASCADE,
  plan_type   TEXT NOT NULL CHECK (plan_type IN ('general','catering','specific')),
  version     INT NOT NULL DEFAULT 1,
  approved_by TEXT,
  approval_date DATE,
  valid_until DATE,
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','expired','archived')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_haccp_plans_event ON haccp_plans(event_id);
CREATE INDEX idx_haccp_plans_status ON haccp_plans(status);

-- ===================================================================
-- 2. Límites críticos (temperatura, pH, tiempo)
-- ===================================================================
CREATE TABLE IF NOT EXISTS haccp_critical_limits (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id           UUID NOT NULL REFERENCES haccp_plans(id) ON DELETE CASCADE,
  parameter         TEXT NOT NULL CHECK (parameter IN (
                      'temp_fridge','temp_freezer','temp_cold_room',
                      'temp_cook','temp_reheat','temp_hold',
                      'ph','aw','time_room_temp','time_shelf_life','storage')),
  name              TEXT NOT NULL,
  description       TEXT,
  min_value         NUMERIC(6,2),
  max_value         NUMERIC(6,2),
  unit              TEXT NOT NULL DEFAULT '°C',
  corrective_action TEXT,
  frequency         TEXT CHECK (frequency IN ('cada_30min','por_lote','cada_hora','diario','semanal')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_haccp_limits_plan ON haccp_critical_limits(plan_id);

-- ===================================================================
-- 3. Monitorización APPCC (lecturas)
-- ===================================================================
CREATE TABLE IF NOT EXISTS haccp_monitoring (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  limit_id    UUID NOT NULL REFERENCES haccp_critical_limits(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by TEXT NOT NULL,
  value       NUMERIC(6,2) NOT NULL,
  unit        TEXT NOT NULL DEFAULT '°C',
  status      TEXT NOT NULL CHECK (status IN ('ok','warning','critical')),
  notes       TEXT,
  is_corrected BOOLEAN DEFAULT false,
  corrected_at TIMESTAMPTZ,
  corrected_by TEXT
);

CREATE INDEX idx_haccp_monitoring_limit ON haccp_monitoring(limit_id);
CREATE INDEX idx_haccp_monitoring_date ON haccp_monitoring(recorded_at DESC);

-- ===================================================================
-- 4. Temperaturas de neveras (registro independiente, rápido)
-- ===================================================================
CREATE TABLE IF NOT EXISTS fridge_temperature_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID REFERENCES events(id) ON DELETE SET NULL,
  fridge_name  TEXT NOT NULL,
  fridge_type  TEXT NOT NULL DEFAULT 'fridge' CHECK (fridge_type IN ('fridge','freezer','cold_room')),
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  temperature  NUMERIC(5,2) NOT NULL,
  target_min   NUMERIC(5,2),
  target_max   NUMERIC(5,2),
  status       TEXT CHECK (status IN ('ok','warning','critical')),
  recorded_by  TEXT NOT NULL,
  notes        TEXT
);

CREATE INDEX idx_fridge_temp_date ON fridge_temperature_log(recorded_at DESC);
CREATE INDEX idx_fridge_temp_name ON fridge_temperature_log(fridge_name);
CREATE INDEX idx_fridge_temp_event ON fridge_temperature_log(event_id);

-- ===================================================================
-- 5. Plan de limpieza
-- ===================================================================
CREATE TABLE IF NOT EXISTS cleaning_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID REFERENCES events(id) ON DELETE SET NULL,
  area          TEXT NOT NULL,
  schedule      TEXT NOT NULL CHECK (schedule IN ('diario','semanal','mensual','pre-evento','post-evento')),
  performed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  performed_by  TEXT NOT NULL,
  verified_by   TEXT,
  verified_at   TIMESTAMPTZ,
  products_used TEXT[],
  notes         TEXT,
  checklist     JSONB DEFAULT '[]'::jsonb -- items de limpieza checkeados
);

CREATE INDEX idx_cleaning_area ON cleaning_log(area);
CREATE INDEX idx_cleaning_date ON cleaning_log(performed_at DESC);
CREATE INDEX idx_cleaning_event ON cleaning_log(event_id);

-- ===================================================================
-- 6. Proveedores homologados (APPCC)
-- ===================================================================
CREATE TABLE IF NOT EXISTS supplier_approval (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id     UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  approved_at     DATE NOT NULL DEFAULT CURRENT_DATE,
  expires_at      DATE,
  approved_by     TEXT NOT NULL,
  criteria_met    TEXT[] DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','suspended','revoked')),
  document_url    TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_supplier_approval_provider ON supplier_approval(provider_id) WHERE status = 'active';
CREATE INDEX idx_supplier_approval_status ON supplier_approval(status);

-- ===================================================================
-- 7. Trazabilidad lote → plato
-- ===================================================================
CREATE TABLE IF NOT EXISTS traceability_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  ingredient_id   UUID REFERENCES ingredients(id) ON DELETE SET NULL,
  recipe_id       UUID REFERENCES recipes(id) ON DELETE SET NULL,
  lot_number      TEXT NOT NULL,
  receiving_id    UUID REFERENCES receiving_log(id) ON DELETE SET NULL,
  quantity_used   NUMERIC(10,3) NOT NULL,
  unit            TEXT NOT NULL DEFAULT 'g',
  used_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_by         TEXT,
  guest_served    INT,
  is_critical     BOOLEAN DEFAULT false,
  notes           TEXT
);

CREATE INDEX idx_traceability_event ON traceability_log(event_id);
CREATE INDEX idx_traceability_ingredient ON traceability_log(ingredient_id);
CREATE INDEX idx_traceability_lot ON traceability_log(lot_number);
CREATE INDEX idx_traceability_date ON traceability_log(used_at DESC);

-- ===================================================================
-- 8. Equipamiento APPCC (calibración, mantenimiento)
-- ===================================================================
CREATE TABLE IF NOT EXISTS haccp_equipment_calibration (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id    UUID REFERENCES equipment(id) ON DELETE CASCADE,
  calibration_date DATE NOT NULL DEFAULT CURRENT_DATE,
  calibrated_by   TEXT NOT NULL,
  result          TEXT NOT NULL CHECK (result IN ('pass','fail','adjusted')),
  next_calibration DATE,
  certificate_url TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_haccp_calibration_equip ON haccp_equipment_calibration(equipment_id DESC);

-- ===================================================================
-- Triggers de timestamp
-- ===================================================================
CREATE OR REPLACE FUNCTION update_haccp_timestamp()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_haccp_plans_updated ON haccp_plans;
CREATE TRIGGER trg_haccp_plans_updated BEFORE UPDATE ON haccp_plans
  FOR EACH ROW EXECUTE FUNCTION update_haccp_timestamp();

DROP TRIGGER IF EXISTS trg_supplier_approval_updated ON supplier_approval;
CREATE TRIGGER trg_supplier_approval_updated BEFORE UPDATE ON supplier_approval
  FOR EACH ROW EXECUTE FUNCTION update_haccp_timestamp();

COMMIT;