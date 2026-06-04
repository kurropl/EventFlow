-- Create waiters table
CREATE TABLE IF NOT EXISTS waiters (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'camarero',
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default waiters
INSERT INTO waiters (name, role) VALUES
    ('Juan', 'jefe-camarero'),
    ('Antonio', 'camarero'),
    ('María', 'camarero'),
    ('José', 'camarero'),
    ('Carmen', 'camarero'),
    ('Manuel', 'camarero'),
    ('Rocío', 'camarero'),
    ('David', 'camarero')
ON CONFLICT DO NOTHING;

-- Update trigger
DROP TRIGGER IF EXISTS trg_waiters_updated ON waiters;
CREATE TRIGGER trg_waiters_updated BEFORE UPDATE ON waiters FOR EACH ROW EXECUTE FUNCTION update_updated_at();
