-- EventFlow — 2026-08-17: Regularizaciones de inventario
CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id uuid REFERENCES ingredients(id),
  ajuste numeric NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('recuento','rotura','merma','caducado','sobrante','ajuste')),
  motivo text,
  responsable uuid REFERENCES admins(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inv_adj_ingredient ON inventory_adjustments(ingredient_id);