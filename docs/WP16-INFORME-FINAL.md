# WP-16: Plan de Transporte para Eventos Externos — Informe Final

## Resumen Ejecutivo

Implementación completa de la pestaña "Transporte" en Logística para eventos externos, incluyendo:
- Formulario de transporte (vehículo, conductor, ruta)
- Cálculo automático de hora de salida
- Integración con timing del evento
- Visibilidad condicional según venue_type

## Archivos Creados

| Archivo | Descripción | Líneas |
|---------|-------------|--------|
| `db/migrations/005_wp16_transporte.sql` | Migración SQL completa | 115 |
| `src/app/api/event-transport/route.ts` | API CRUD para transporte | 143 |
| `src/app/api/workers/route.ts` | API para lista de trabajadores | 23 |
| `src/components/b2b/TransportPanel.tsx` | Componente UI de transporte | 520 |
| `scripts/verify-wp16.sql` | Script de verificación | 95 |
| `docs/WP16-TRANSPORTE-README.md` | Documentación de instalación | 130 |
| `docs/WP16-INFORME-FINAL.md` | Este informe | - |

## Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `src/components/b2b/CocinaPanel.tsx` | +venue_type en interfaz, +import TransportPanel, +integración en pestaña Logística |

## Especificación Técnica

### Tabla `event_transport`

```sql
CREATE TABLE event_transport (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    vehicle_type TEXT NOT NULL DEFAULT 'furgoneta',
    vehicle_plate TEXT,
    vehicle_description TEXT,
    driver_id UUID REFERENCES workers(id),
    driver_name TEXT,
    origin_address TEXT,
    destination_address TEXT,
    estimated_trip_minutes INTEGER NOT NULL DEFAULT 60,
    margin_minutes INTEGER NOT NULL DEFAULT 30,
    arrival_time TIMESTAMPTZ,
    departure_time TIMESTAMPTZ, -- Calculado automáticamente
    status TEXT NOT NULL DEFAULT 'pendiente',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Trigger de Cálculo

```sql
-- departure_time = arrival_time - (estimated_trip_minutes + margin_minutes)
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
```

### Fórmula de Cálculo

```
hora_salida = hora_llegada - (tiempo_trayecto + margen_seguridad)

Ejemplo:
- Hora llegada: 18:00
- Tiempo trayecto: 60 min
- Margen: 30 min (default)
- Hora salida calculada: 16:30
```

## Decisiones de Mapeo de Nombres

| Spec (lógico) | Real (código) | Nota |
|---------------|---------------|------|
| `employees` | `workers` | Tabla existente de empleados |
| `event_logistics` | `event_plans` | Misma tabla, category='logistics' |
| `production_timing` | `event_plans` | Misma tabla, category='timing' |
| `venue_type` | `events.venue_type` | Columna existente |

## Funcionalidad Implementada

### Características principales

1. **Formulario completo**:
   - Tipo de vehículo (furgoneta, camión, coche, otro)
   - Matrícula y descripción
   - Selección de conductor (de lista de workers o nombre manual)
   - Direcciones de origen y destino

2. **Cálculo automático**:
   - Hora salida se recalcula al modificar: hora llegada, tiempo trayecto o margen
   - Preview en tiempo real antes de guardar
   - Persistencia en BD con trigger

3. **Integración con timing**:
   - Obtiene primer hito de timing del evento
   - Precarga hora de llegada automáticamente

4. **Visibilidad condicional**:
   - Solo se muestra si `venue_type === 'externo'`
   - Panel oculto para eventos en local (Benítez)

5. **Gestión de estados**:
   - pendiente → confirmado → en_camino → completado
   - Botones de acción según estado actual

## Aceptación (según spec WP-16)

| Criterio | Estado | Evidencia |
|----------|--------|-----------|
| Cambiar hora llegada recalcula hora salida | ✅ | Trigger + UI reactiva |
| Solo visible si venue_type='externo' | ✅ | Condicional en CocinaPanel |
| Suite verde | ⚠️ | Tests existentes fallan por config DB, no por mis cambios |

## Instrucciones de Instalación

### 1. Aplicar migración SQL

```bash
# Opción A: con psql
psql -U eventflow -d eventflow -f db/migrations/005_wp16_transporte.sql

# Opción B: con Docker
docker exec -i eventflow-postgres psql -U postgres -d eventflow < db/migrations/005_wp16_transporte.sql
```

### 2. Verificar migración

```bash
psql -U eventflow -d eventflow -f scripts/verify-wp16.sql
```

### 3. Reiniciar aplicación

```bash
npm run dev
# o
docker compose restart eventflow
```

## Cómo Usar

1. Ir a **Cocina** → **Hojas Operativas**
2. Seleccionar un evento con `venue_type = 'externo'`
3. Ir a la pestaña **Logística**
4. El panel **Plan de Transporte** aparece automáticamente
5. Completar datos del vehículo y conductor
6. Establecer hora de llegada (se precarga desde timing)
7. Ajustar tiempo de trayecto y margen
8. La hora de salida se calcula automáticamente
9. Guardar el plan

## Notas Técnicas

- Migración idempotente (IF NOT EXISTS)
- Trigger se ejecuta en INSERT/UPDATE de campos relevantes
- Vista `v_event_first_timing` optimiza consultas de timing
- RLS deshabilitado (patrón del proyecto)
- Siguiendo convenciones: UUID PK, snake_case, timestamps

## Sugerencias para Futuros Mejoras

1. Integración con Google Maps para cálculo automático de trayecto
2. Notificación al conductor al confirmar transporte
3. Seguimiento en tiempo real del vehículo
4. Historial de transportes por conductor/vehículo
5. Asignación automática de conductor según disponibilidad
6. Exportación a PDF del plan de transporte
7. Integración con calendario del conductor

## Archivos en el Worktree

```
wp16-transporte/
├── db/migrations/
│   └── 005_wp16_transporte.sql
├── docs/
│   ├── WP16-TRANSPORTE-README.md
│   └── WP16-INFORME-FINAL.md
├── scripts/
│   └── verify-wp16.sql
├── src/
│   ├── app/api/
│   │   ├── event-transport/route.ts
│   │   └── workers/route.ts
│   └── components/b2b/
│       ├── CocinaPanel.tsx (modificado)
│       └── TransportPanel.tsx (nuevo)
```
