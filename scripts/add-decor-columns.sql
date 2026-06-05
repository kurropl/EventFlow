-- Add linen_type and centerpiece columns to events table
-- Run: docker exec eventflow-postgres psql -U postgres -d eventflow -f /tmp/add-decor-columns.sql

ALTER TABLE events ADD COLUMN IF NOT EXISTS linen_type TEXT DEFAULT 'blanco';
ALTER TABLE events ADD COLUMN IF NOT EXISTS centerpiece TEXT DEFAULT 'floral';
