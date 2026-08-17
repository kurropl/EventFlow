-- ============================================================
-- EventFlow — 2026-08-17: Datos maestros proveedor × ingrediente
--
-- Precio vigente por proveedor, unidad de compra con factor de
-- conversión a la unidad de uso, pedido mínimo, plazo de entrega
-- (lead time) y proveedor preferente. Base para proponer OCs
-- agrupadas por proveedor con redondeo a unidad de compra.
-- ============================================================
CREATE TABLE IF NOT EXISTS supplier_ingredient_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  precio_vigente numeric(12,4) NOT NULL,
  unidad_compra text NOT NULL DEFAULT 'caja',
  cantidad_por_unidad numeric(12,4) NOT NULL DEFAULT 1,
  unidad_uso text NOT NULL,
  factor_conversion numeric(14,4) NOT NULL,
  pedido_minimo numeric(12,4) DEFAULT 0,
  plazo_entrega_dias int DEFAULT 0,
  dias_reparto jsonb NOT NULL DEFAULT '[]'::jsonb,
  preferente boolean NOT NULL DEFAULT false,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, ingredient_id)
);
CREATE INDEX IF NOT EXISTS idx_sip_ingredient ON supplier_ingredient_pricing(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_sip_supplier ON supplier_ingredient_pricing(supplier_id);

-- Verificación
SELECT table_name FROM information_schema.tables
WHERE table_name = 'supplier_ingredient_pricing';
