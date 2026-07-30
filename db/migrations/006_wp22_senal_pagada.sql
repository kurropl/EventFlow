-- ============================================================
-- WP-22: Automatización de Señal Pagada
-- Migración: payment_plans, payment_milestones + extensión payments
-- ============================================================
-- NOTA: payment_plans y payment_milestones son dependencias de WP-21
-- que no existían. Se crean aquí como requisito previo de WP-22.

-- 1. Tabla payment_plans (WP-21 prerequisite)
CREATE TABLE IF NOT EXISTS payment_plans (
  id          SERIAL PRIMARY KEY,
  event_id    INT NOT NULL REFERENCES events(id),
  quote_id    UUID,
  total       NUMERIC(12,2) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Evitar planes duplicados por evento
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_plans_event_id_unique'
  ) THEN
    ALTER TABLE payment_plans ADD CONSTRAINT payment_plans_event_id_unique UNIQUE (event_id);
  END IF;
END $$;

-- 2. Tabla payment_milestones (WP-21 prerequisite)
CREATE TABLE IF NOT EXISTS payment_milestones (
  id            SERIAL PRIMARY KEY,
  plan_id       INT NOT NULL REFERENCES payment_plans(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('senal', 'intermedio', 'resto', 'extra')),
  label         TEXT NOT NULL,
  amount        NUMERIC(12,2) NOT NULL,
  due_date      DATE,
  status        TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'pagado', 'vencido', 'anulado')),
  paid_at       TIMESTAMPTZ,
  payment_id    INT,  -- FK a payments se añade después de verificar
  accumulated   NUMERIC(12,2) NOT NULL DEFAULT 0,  -- acumulado parcial
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Añadir milestone_id a payments (extensión, no reemplazo)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'milestone_id'
  ) THEN
    ALTER TABLE payments ADD COLUMN milestone_id INT REFERENCES payment_milestones(id);
  END IF;
END $$;

-- 4. Añadir payment_id FK a payment_milestones (ya existe la columna, solo FK)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_milestones_payment_id_fk'
  ) THEN
    ALTER TABLE payment_milestones
      ADD CONSTRAINT payment_milestones_payment_id_fk
      FOREIGN KEY (payment_id) REFERENCES payments(id);
  END IF;
END $$;

-- 5. Script de verificación
DO $$
BEGIN
  -- Verificar payment_plans
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payment_plans') THEN
    RAISE EXCEPTION 'Tabla payment_plans no fue creada';
  END IF;

  -- Verificar payment_milestones
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payment_milestones') THEN
    RAISE EXCEPTION 'Tabla payment_milestones no fue creada';
  END IF;

  -- Verificar columna milestone_id en payments
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'milestone_id'
  ) THEN
    RAISE EXCEPTION 'Columna milestone_id no añadida a payments';
  END IF;

  RAISE NOTICE 'Migración WP-22 completada exitosamente';
END $$;
