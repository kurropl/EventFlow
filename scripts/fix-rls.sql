-- ============================================================
-- Migration: neutralise Supabase-style RLS for self-hosted Postgres
-- ============================================================
-- Run this against an EXISTING database (the docker init script only runs on a
-- fresh volume, so already-deployed DBs need this applied manually):
--
--   psql "$DATABASE_URL" -f scripts/fix-rls.sql
--
-- Why: the original schema enabled RLS with policies based on `auth.jwt()`, a
-- Supabase-only function. On plain Postgres that function does not exist, so any
-- non-superuser connection gets "Database query failed" on every events insert
-- (the configurador "Enviar presupuesto" bug). Authn/authz is enforced in the
-- application layer (middleware + auth.ts), so we drop the broken policies and
-- disable RLS.

DROP POLICY IF EXISTS catalog_public_read   ON catalog_items;
DROP POLICY IF EXISTS catalog_admin_write   ON catalog_items;
DROP POLICY IF EXISTS menus_public_read     ON proposed_menus;
DROP POLICY IF EXISTS events_own_read       ON events;
DROP POLICY IF EXISTS events_admin_all      ON events;
DROP POLICY IF EXISTS cost_desglose_event_read ON cost_desglose;
DROP POLICY IF EXISTS webhook_logs_admin    ON webhook_logs;
DROP POLICY IF EXISTS bar_config_read       ON bar_config;

ALTER TABLE catalog_items  DISABLE ROW LEVEL SECURITY;
ALTER TABLE proposed_menus DISABLE ROW LEVEL SECURITY;
ALTER TABLE events         DISABLE ROW LEVEL SECURITY;
ALTER TABLE cost_desglose  DISABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs   DISABLE ROW LEVEL SECURITY;
ALTER TABLE bar_config     DISABLE ROW LEVEL SECURITY;
