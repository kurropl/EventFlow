-- ============================================================
-- EventFlow — 2026-08-17: Gaps de esquema detectados en cocina-v3-f1f2
--
-- Patrón repetido durante la implementación: el código consulta columnas
-- definidas en schema.sql (ALTER TABLE ... ADD COLUMN) que NUNCA se
-- aplicaron en la BD de producción. Esto rompía rutas de cocina con 500.
--
-- Esta migración consolida los ALTERs aditivos e idempotentes para que el
-- esquema de prod quede al día de forma reproducible y documentada.
-- ============================================================

-- ingredients: clasificación seca/equipamiento (usada por logística)
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS is_equipment BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS is_dry BOOLEAN NOT NULL DEFAULT false;

-- events: ubicación y plano del venue externo (usados por guía de cocina
-- y hoja de servicio)
ALTER TABLE events ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_pdf_url TEXT;

-- Verificación
SELECT column_name FROM information_schema.columns
WHERE table_name IN ('ingredients','events')
  AND column_name IN ('is_equipment','is_dry','location','venue_pdf_url')
ORDER BY table_name, column_name;
