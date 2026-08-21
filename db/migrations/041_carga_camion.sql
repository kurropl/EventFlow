-- M-Carga: columnas para orden de carga del camión (backload)
-- items_carga necesita pass_number y load_order para clasificar el orden real del camión

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items_carga' AND column_name = 'pass_number') THEN
    ALTER TABLE items_carga ADD COLUMN pass_number INTEGER;
    COMMENT ON COLUMN items_carga.pass_number IS 'Pase de servicio al que pertenece este item. NULL si no se asigna.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items_carga' AND column_name = 'load_order') THEN
    ALTER TABLE items_carga ADD COLUMN load_order INTEGER DEFAULT 999;
    COMMENT ON COLUMN items_carga.load_order IS 'Orden de carga del camión: menor = primero en cargar (backload)';
  END IF;
END $$;