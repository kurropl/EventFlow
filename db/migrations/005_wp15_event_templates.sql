-- ============================================================
-- WP-15: Plantillas automáticas por tipo de venue
-- Migración: Añadir event_templates JSONB a business_settings
-- ============================================================

-- 1. Añadir columna event_templates a business_settings
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS event_templates JSONB NOT NULL DEFAULT '{
  "externo": {
    "logistics": [
      {"title": "Preparar vehicle de càtering", "description": "Verificar combustible, neveras portátiles i material de transport", "planned_time": null, "category": "logistica", "sort_order": 1},
      {"title": "Càrrega de material", "description": "Carregar vaixella, coberteria, cristalleria i material de servei", "planned_time": null, "category": "logistica", "sort_order": 2},
      {"title": "Desplaçament al venue extern", "description": "Sortida amb marge de 30 minuts respecte l''hora de muntatge", "planned_time": null, "category": "logistica", "sort_order": 3},
      {"title": "Muntatge in situ", "description": "Instal·lar taules, cadires, parament i decoració", "planned_time": null, "category": "logistica", "sort_order": 4},
      {"title": "Desmuntatge i retorn", "description": "Recollir tot el material, netejar i tornar al vehicle", "planned_time": null, "category": "logistica", "sort_order": 5}
    ],
    "timing": [
      {"title": "Arribada al venue", "description": "Muntatge inicial", "planned_time": "-3h", "category": "timing", "sort_order": 1},
      {"title": "Prova tècnica", "description": "Verificar so, llum i equipament", "planned_time": "-2h", "category": "timing", "sort_order": 2},
      {"title": "Últims preparatius", "description": "Revisió final abans de l''arribada dels convidats", "planned_time": "-30min", "category": "timing", "sort_order": 3},
      {"title": "Inici servei", "description": "Comença el servei de càtering", "planned_time": "0", "category": "timing", "sort_order": 4},
      {"title": "Final servei", "description": "Fi del servei i inici de desmuntatge", "planned_time": "+4h", "category": "timing", "sort_order": 5}
    ],
    "packs": [
      {"title": "Pack Camarers", "description": "Uniforme bàsic: camisa blanca, pantaló negre, davantal", "category": "logistica", "sort_order": 1},
      {"title": "Pack Al·lèrgens", "description": "Etiquetes d''al·lèrgens per a cada plat, bossa de emergència", "category": "logistica", "sort_order": 2},
      {"title": "Pack Supervivència", "description": "Farmaciola, carregadors, material de neteja extra", "category": "logistica", "sort_order": 3}
    ],
    "appcc_center": {
      "title": "Centro APPCC Truck Externo",
      "description": "Control de temperatures i traçabilitat per a vehicle de càtering extern",
      "area": "vehicle_extern",
      "schedule": "pre_evente"
    }
  },
  "benitez": {
    "checklist": [
      {"title": "Revisió sala principal", "description": "Verificar neteja, taules, cadires, il·luminació", "hours_before": 24, "sort_order": 1},
      {"title": "Preparar parament", "description": "Vaixella, coberteria, cristalleria per a cada lloc", "hours_before": 4, "sort_order": 2},
      {"title": "Decoració i flors", "description": "Muntar centres de taula i decoració acordada", "hours_before": 2, "sort_order": 3},
      {"title": "Revisió cuina", "description": "Verificar estat dels fogons, neveres i material de cuina", "hours_before": 4, "sort_order": 4},
      {"title": "Control temperatures", "description": "Registrar temperatures de neveres i congeladors", "hours_before": 1, "sort_order": 5}
    ],
    "table_map": {
      "description": "Mapa de taules base per a saló Benítez",
      "default_tables": [
        {"name": "Mesa Redonda 1", "seats": 10, "x": 100, "y": 100},
        {"name": "Mesa Redonda 2", "seats": 10, "x": 250, "y": 100},
        {"name": "Mesa Redonda 3", "seats": 10, "x": 400, "y": 100},
        {"name": "Mesa Redonda 4", "seats": 10, "x": 100, "y": 250},
        {"name": "Mesa Redonda 5", "seats": 10, "x": 250, "y": 250},
        {"name": "Mesa Redonda 6", "seats": 10, "x": 400, "y": 250},
        {"name": "Mesa Presidència", "seats": 12, "x": 250, "y": 400}
      ]
    }
  }
}';

-- 2. Script de verificación
DO $$
BEGIN
  -- Verificar que la columna fue creada
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'business_settings' AND column_name = 'event_templates'
  ) THEN
    RAISE EXCEPTION 'Columna event_templates no fue creada en business_settings';
  END IF;

  -- Verificar que el valor por defecto es válido JSONB
  IF NOT EXISTS (
    SELECT 1 FROM business_settings
    WHERE event_templates ? 'externo' AND event_templates ? 'benitez'
  ) THEN
    RAISE EXCEPTION 'event_templates no contiene las claves externo/benitez';
  END IF;

  RAISE NOTICE 'Migración WP-15 completada exitosamente';
END $$;
