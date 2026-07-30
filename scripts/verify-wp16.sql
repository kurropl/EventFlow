-- ============================================================
-- Verificación WP-16: Plan de Transporte
-- ============================================================

-- 1. Verificar que la tabla existe
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_transport') 
        THEN '✅ Tabla event_transport existe'
        ELSE '❌ Tabla event_transport NO existe'
    END AS tabla_transporte;

-- 2. Verificar que la vista existe
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_event_first_timing') 
        THEN '✅ Vista v_event_first_timing existe'
        ELSE '❌ Vista v_event_first_timing NO existe'
    END AS vista_timing;

-- 3. Verificar columnas de la tabla
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'event_transport' 
ORDER BY ordinal_position;

-- 4. Verificar triggers
SELECT 
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'event_transport';

-- 5. Verificar que el trigger de cálculo funciona
-- Insertar un registro de prueba y verificar que departure_time se calcula
DO $$
DECLARE
    test_event_id UUID;
    test_transport_id UUID;
    test_arrival TIMESTAMPTZ := '2026-08-15 18:00:00+02';
    expected_departure TIMESTAMPTZ;
    actual_departure TIMESTAMPTZ;
BEGIN
    -- Obtener un evento existente para la prueba
    SELECT id INTO test_event_id FROM events LIMIT 1;
    
    IF test_event_id IS NULL THEN
        RAISE NOTICE '⚠️ No hay eventos en la BD para probar';
        RETURN;
    END IF;
    
    -- Calcular expected departure: arrival - (60 + 30) minutos = arrival - 90 min
    expected_departure := test_arrival - INTERVAL '90 minutes';
    
    -- Insertar registro de prueba
    INSERT INTO event_transport (
        event_id, vehicle_type, estimated_trip_minutes, margin_minutes, arrival_time
    ) VALUES (
        test_event_id, 'furgoneta', 60, 30, test_arrival
    ) RETURNING id, departure_time INTO test_transport_id, actual_departure;
    
    -- Verificar cálculo
    IF actual_departure = expected_departure THEN
        RAISE NOTICE '✅ Cálculo de hora de salida correcto: % = %', actual_departure, expected_departure;
    ELSE
        RAISE NOTICE '❌ Error en cálculo: esperado %, obtenido %', expected_departure, actual_departure;
    END IF;
    
    -- Limpiar registro de prueba
    DELETE FROM event_transport WHERE id = test_transport_id;
    RAISE NOTICE '🧹 Registro de prueba eliminado';
END $$;

-- 6. Verificar que la vista muestra datos
SELECT 
    event_id,
    first_timing_time
FROM v_event_first_timing
LIMIT 5;

-- 7. Contar registros (debería ser 0 o más)
SELECT 
    COUNT(*) AS total_transport_plans
FROM event_transport;

-- ============================================================
-- Resumen de verificación
-- ============================================================
SELECT 
    'WP-16: Plan de Transporte' AS work_package,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_transport')
        AND EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_event_first_timing')
        THEN '✅ MIGRACIÓN APLICADA CORRECTAMENTE'
        ELSE '❌ MIGRACIÓN INCOMPLETA'
    END AS estado;
