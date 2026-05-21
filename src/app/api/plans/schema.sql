-- ============================================================
-- EventFlow — Additional Tables (apply after main schema.sql)
-- Run: psql -d eventflow -f src/app/api/plans/schema.sql
-- ============================================================

-- Table plans — saves editor state per event
CREATE TABLE IF NOT EXISTS table_plans (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name          TEXT NOT NULL DEFAULT 'Plano principal',
    tables_data   JSONB NOT NULL DEFAULT '[]'::jsonb,
    elements_data JSONB NOT NULL DEFAULT '[]'::jsonb,
    budget_data   JSONB NOT NULL DEFAULT '{}'::jsonb,
    canvas_width  NUMERIC(10,2) NOT NULL DEFAULT 2400,
    canvas_height NUMERIC(10,2) NOT NULL DEFAULT 1800,
    zoom          NUMERIC(5,2) NOT NULL DEFAULT 1,
    pan_x         NUMERIC(10,2) NOT NULL DEFAULT 100,
    pan_y         NUMERIC(10,2) NOT NULL DEFAULT 100,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_table_plans_event ON table_plans(event_id);