-- ============================================================
-- WP-31: Congelación y Disparo de la Cadena Operativa
-- Migración: ajustes a client_portals + verificación
-- ============================================================
-- Idempotente: usa IF NOT EXISTS / IF NOT EXISTS

-- 1. Añadir token_hash a client_portals (usado por portal.ts para lookup rápido)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_portals' AND column_name = 'token_hash'
  ) THEN
    ALTER TABLE client_portals ADD COLUMN token_hash TEXT;
    -- Backfill: generar hash SHA-256 del access_token existente
    UPDATE client_portals
      SET token_hash = encode(digest(access_token, 'sha256'), 'hex')
      WHERE token_hash IS NULL;
    -- Hacer NOT NULL tras backfill
    ALTER TABLE client_portals ALTER COLUMN token_hash SET NOT NULL;
    -- Constraint de unicidad
    ALTER TABLE client_portals ADD CONSTRAINT uq_client_portals_token_hash
      UNIQUE (token_hash);
    RAISE NOTICE 'WP-31: token_hash añadido a client_portals';
  ELSE
    RAISE NOTICE 'WP-31: token_hash ya existe en client_portals';
  END IF;
END $$;

-- 2. Index para lookup por token_hash
CREATE INDEX IF NOT EXISTS idx_client_portals_token_hash
  ON client_portals (token_hash);

-- 3. Añadir frozen_by_job_at para rastrear cuándo el job diario congeló
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_portals' AND column_name = 'frozen_by_job_at'
  ) THEN
    ALTER TABLE client_portals ADD COLUMN frozen_by_job_at TIMESTAMPTZ;
    RAISE NOTICE 'WP-31: frozen_by_job_at añadido a client_portals';
  ELSE
    RAISE NOTICE 'WP-31: frozen_by_job_at ya existe en client_portals';
  END IF;
END $$;

-- 4. Añadir frozen_event_payload a domain_events para tracking del payload completo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'domain_events' AND column_name = 'frozen_event_payload'
  ) THEN
    -- No añadimos columna extra, el payload JSONB ya existe en domain_events
    RAISE NOTICE 'WP-31: domain_events.payload ya existe para tracking';
  END IF;
END $$;

-- 5. Verificación final
DO $$
DECLARE
  v_cp_columns INT;
  v_has_token_hash BOOLEAN;
  v_has_frozen_by_job BOOLEAN;
BEGIN
  SELECT count(*) INTO v_cp_columns
  FROM information_schema.columns
  WHERE table_name = 'client_portals';

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_portals' AND column_name = 'token_hash'
  ) INTO v_has_token_hash;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_portals' AND column_name = 'frozen_by_job_at'
  ) INTO v_has_frozen_by_job;

  IF v_has_token_hash AND v_has_frozen_by_job THEN
    RAISE NOTICE 'WP-31 OK: Migración completada. client_portals tiene % columnas', v_cp_columns;
  ELSE
    RAISE EXCEPTION 'WP-31 FAIL: token_hash=%, frozen_by_job_at=%', v_has_token_hash, v_has_frozen_by_job;
  END IF;
END $$;

-- Query de verificación:
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'client_portals'
-- ORDER BY ordinal_position;
