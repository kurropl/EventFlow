-- ============================================================
-- EventFlow — RBAC roles (FR-R01/R04)  [idempotente]
--   psql "$DATABASE_URL" -f scripts/2026-rbac-roles.sql
--
-- 4 perfiles: admin (todo), cocina, camareros (maître/sala), clientes (comercial).
-- ============================================================

UPDATE admins SET role = 'admin'
  WHERE role IS NULL OR role NOT IN ('admin','cocina','camareros','clientes');

ALTER TABLE admins DROP CONSTRAINT IF EXISTS admins_role_check;
ALTER TABLE admins ADD CONSTRAINT admins_role_check
  CHECK (role IN ('admin','cocina','camareros','clientes'));

-- Vínculo opcional usuario↔trabajador (cocinero/maître con login propio)
ALTER TABLE admins ADD COLUMN IF NOT EXISTS worker_id UUID;

SELECT 'rbac-roles OK' AS status, count(*) AS admins FROM admins;
