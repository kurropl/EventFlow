-- M4: Plan de producción por zona/hora
-- Añadir zona, plato, asignado_a al event_timeline

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'event_timeline' AND column_name = 'zona') THEN
    ALTER TABLE event_timeline ADD COLUMN zona TEXT;
    COMMENT ON COLUMN event_timeline.zona IS 'Zona de producción (frio, caliente, pastelaria, etc.). M4.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'event_timeline' AND column_name = 'plato') THEN
    ALTER TABLE event_timeline ADD COLUMN plato TEXT;
    COMMENT ON COLUMN event_timeline.plato IS 'Plato asociado a esta entrada de timeline. M4.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'event_timeline' AND column_name = 'asignado_a') THEN
    ALTER TABLE event_timeline ADD COLUMN asignado_a UUID REFERENCES auth.users(id);
    COMMENT ON COLUMN event_timeline.asignado_a IS 'Responsable asignado. M4.';
  END IF;
END $$;