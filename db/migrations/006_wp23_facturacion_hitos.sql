-- ============================================================
-- WP-23: Facturación por Hitos
-- Migración: payment_plans + payment_milestones (dependencia WP-21)
--            + columnas en invoices para anticipos y Verifactu
-- ============================================================

-- 1. payment_plans (WP-21 dependency — mínima para WP-23)
CREATE TABLE IF NOT EXISTS payment_plans (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id    UUID NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  quote_id    UUID NOT NULL,
  total       NUMERIC(12,2) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_plans_event ON payment_plans(event_id);
ALTER TABLE payment_plans DISABLE ROW LEVEL SECURITY;

-- 2. payment_milestones (WP-21 dependency — mínima para WP-23)
CREATE TABLE IF NOT EXISTS payment_milestones (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id     UUID NOT NULL REFERENCES payment_plans(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('senal','intermedio','resto','extra')),
  label       TEXT NOT NULL,
  amount      NUMERIC(12,2) NOT NULL,
  due_date    DATE,
  status      TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','pagado','vencido','anulado')),
  paid_at     TIMESTAMPTZ,
  payment_id  UUID,  -- FK a payments cuando se paga
  -- WP-23: campos de facturación
  invoiced_at TIMESTAMPTZ,
  invoice_id  UUID REFERENCES invoices(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_milestones_plan ON payment_milestones(plan_id);
CREATE INDEX IF NOT EXISTS idx_payment_milestones_status ON payment_milestones(status);
ALTER TABLE payment_milestones DISABLE ROW LEVEL SECURITY;

-- 3. Columnas nuevas en invoices para WP-23
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS milestone_id UUID REFERENCES payment_milestones(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_type TEXT NOT NULL DEFAULT 'final' CHECK (invoice_type IN ('anticipo','final'));

-- 4. Columnas preparadas para Verifactu (sin implementar, campos reservados)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS verifactu_status TEXT DEFAULT 'no_enviado' CHECK (verifactu_status IN ('no_enviado','pendiente','aceptado','rechazado','error'));
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS verifactu_id TEXT;          -- ID asignado por Verifactu
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS verifactu_sent_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS verifactu_response JSONB;   -- respuesta raw de Verifactu
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS verifactu_qr_url TEXT;      -- URL del QR de Verifactu

-- 5. Índices para las nuevas columnas
CREATE INDEX IF NOT EXISTS idx_invoices_milestone ON invoices(milestone_id);
CREATE INDEX IF NOT EXISTS idx_invoices_type ON invoices(invoice_type);

-- ============================================================
-- Verificación
-- ============================================================
DO $$
BEGIN
  -- Verificar tablas creadas
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_plans') THEN
    RAISE EXCEPTION 'WP-23: payment_plans no creada';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_milestones') THEN
    RAISE EXCEPTION 'WP-23: payment_milestones no creada';
  END IF;
  -- Verificar columnas en invoices
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'milestone_id') THEN
    RAISE EXCEPTION 'WP-23: invoices.milestone_id no creada';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'invoice_type') THEN
    RAISE EXCEPTION 'WP-23: invoices.invoice_type no creada';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'verifactu_status') THEN
    RAISE EXCEPTION 'WP-23: invoices.verifactu_status no creada';
  END IF;
  RAISE NOTICE 'WP-23: Migración verificada correctamente';
END $$;

-- Verificación final
SELECT 'payment_plans' AS tabla, count(*) AS filas FROM payment_plans
UNION ALL
SELECT 'payment_milestones', count(*) FROM payment_milestones
UNION ALL
SELECT 'invoices_milestone_id', count(*) FROM invoices WHERE milestone_id IS NOT NULL;
