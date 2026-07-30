-- ============================================================
-- Verificación WP-23: Facturación por Hitos
-- Ejecutar después de 006_wp23_facturacion_hitos.sql
-- ============================================================

-- 1. Verificar tablas creadas
DO $$
BEGIN
  -- payment_plans
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_plans') THEN
    RAISE EXCEPTION 'FAIL: payment_plans no existe';
  END IF;
  RAISE NOTICE 'OK: payment_plans existe';

  -- payment_milestones
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_milestones') THEN
    RAISE EXCEPTION 'FAIL: payment_milestones no existe';
  END IF;
  RAISE NOTICE 'OK: payment_milestones existe';
END $$;

-- 2. Verificar columnas en invoices
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'invoices'
  AND column_name IN ('milestone_id', 'invoice_type', 'verifactu_status', 'verifactu_id', 'verifactu_sent_at', 'verifactu_response', 'verifactu_qr_url')
ORDER BY ordinal_position;

-- 3. Verificar CHECK constraints
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'invoices'::regclass
  AND contype = 'c'
  AND pg_get_constraintdef(oid) LIKE '%invoice_type%';

SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'invoices'::regclass
  AND contype = 'c'
  AND pg_get_constraintdef(oid) LIKE '%verifactu%';

-- 4. Verificar índices
SELECT indexname
FROM pg_indexes
WHERE tablename = 'invoices'
  AND indexname LIKE 'idx_invoices_%'
ORDER BY indexname;

-- 5. Verificar numeración existente (debe ser intacta)
SELECT invoice_number, count(*) AS cnt
FROM invoices
WHERE invoice_number LIKE 'F-%-%'
GROUP BY invoice_number
ORDER BY invoice_number;

-- 6. Conteo final
SELECT
  (SELECT count(*) FROM payment_plans) AS payment_plans,
  (SELECT count(*) FROM payment_milestones) AS payment_milestones,
  (SELECT count(*) FROM invoices WHERE milestone_id IS NOT NULL) AS invoices_with_milestone,
  (SELECT count(*) FROM invoices WHERE invoice_type = 'anticipo') AS advance_invoices,
  (SELECT count(*) FROM invoices WHERE invoice_type = 'final') AS final_invoices;
