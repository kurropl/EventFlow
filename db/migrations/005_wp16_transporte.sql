-- ============================================================
-- WP-16: Plan de Transporte para Eventos Externos
-- Tabla event_transport: vehículos, conductor, cálculo de hora salida
-- ============================================================

CREATE TABLE IF NOT EXISTS event_transport (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    
    -- Datos del vehículo
    vehicle_type TEXT NOT NULL DEFAULT 'furgoneta' CHECK (vehicle_type IN (
        'furgoneta', 'camion', 'coche', 'otro'
    )),
    vehicle_plate TEXT,
    vehicle_description TEXT,
    
    -- Conductor (empleado/worker)
    driver_id UUID REFERENCES workers(id) ON DELETE SET NULL,
    driver_name TEXT, -- Nombre del conductor (fallback si no está en workers)
    
    -- Ruta y tiempos
    origin_address TEXT,
    destination_address TEXT,
    estimated_trip_minutes INTEGER NOT NULL DEFAULT 60, -- Tiempo estimado del trayecto en minutos
    margin_minutes INTEGER NOT NULL DEFAULT 30, -- Margen de seguridad en minutos (default 30min según spec)
    
    -- Horarios calculados
    arrival_time TIMESTAMPTZ, -- Hora de llegada (del timing del evento)
    departure_time TIMESTAMPTZ, -- Hora de salida calculada: arrival - trip - margin
    
    -- Estado
    status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN (
        'pendiente', 'confirmado', 'en_camino', 'completado', 'cancelado'
    )),
    
    -- Notas
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_event_transport_event ON event_transport(event_id);
CREATE INDEX IF NOT EXISTS idx_event_transport_driver ON event_transport(driver_id);

-- RLS deshabilitado (auth en capa API)
ALTER TABLE event_transport DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- Función para calcular hora de salida automáticamente
-- departure_time = arrival_time - (estimated_trip_minutes + margin_minutes) minutos
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_transport_departure()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.arrival_time IS NOT NULL THEN
        NEW.departure_time = NEW.arrival_time - 
            ((NEW.estimated_trip_minutes + NEW.margin_minutes) || ' minutes')::INTERVAL;
    END IF;
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para calcular automáticamente la hora de salida
DROP TRIGGER IF EXISTS trg_calculate_departure ON event_transport;
CREATE TRIGGER trg_calculate_departure
    BEFORE INSERT OR UPDATE OF arrival_time, estimated_trip_minutes, margin_minutes
    ON event_transport
    FOR EACH ROW
    EXECUTE FUNCTION calculate_transport_departure();

-- ============================================================
-- Vista para obtener el primer hito de timing de un evento
-- (para integración con timing)
-- ============================================================
CREATE OR REPLACE VIEW v_event_first_timing AS
SELECT 
    event_id,
    MIN(planned_time::TIMESTAMPTZ) AS first_timing_time
FROM event_plans 
WHERE category = 'timing' 
    AND planned_time IS NOT NULL
    AND planned_time != ''
GROUP BY event_id;

-- ============================================================
-- Verificación
-- ============================================================
DO $$
BEGIN
    -- Verificar que la tabla se creó correctamente
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_transport') THEN
        RAISE NOTICE 'WP-16: Tabla event_transport creada correctamente';
    ELSE
        RAISE EXCEPTION 'WP-16: Error al crear tabla event_transport';
    END IF;
    
    -- Verificar que la vista se creó correctamente
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_event_first_timing') THEN
        RAISE NOTICE 'WP-16: Vista v_event_first_timing creada correctamente';
    ELSE
        RAISE EXCEPTION 'WP-16: Error al crear vista v_event_first_timing';
    END IF;
END $$;

-- ============================================================
-- Query de verificación para el agente
-- ============================================================
-- SELECT COUNT(*) AS table_exists FROM information_schema.tables WHERE table_name = 'event_transport';
-- SELECT COUNT(*) AS view_exists FROM information_schema.views WHERE table_name = 'v_event_first_timing';
