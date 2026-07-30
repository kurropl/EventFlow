# WP-16: Plan de Transporte para Eventos Externos

## Resumen de Implementación

### Archivos Creados

1. **Migración SQL**: `db/migrations/005_wp16_transporte.sql`
   - Tabla `event_transport` con campos para vehículo, conductor, ruta y cálculo de horarios
   - Vista `v_event_first_timing` para obtener el primer hito de timing
   - Trigger `calculate_transport_departure()` para calcular automáticamente la hora de salida

2. **API Routes**:
   - `src/app/api/event-transport/route.ts` - CRUD para planes de transporte
   - `src/app/api/workers/route.ts` - Lista de trabajadores (para selección de conductor)

3. **Componente UI**:
   - `src/components/b2b/TransportPanel.tsx` - Panel de transporte con formulario y cálculo automático

4. **Script de Verificación**:
   - `scripts/verify-wp16.sql` - Queries para verificar la migración

### Archivos Modificados

1. **CocinaPanel.tsx**:
   - Agregado `venue_type` a interfaz `AppEvent`
   - Import de `TransportPanel`
   - Integración del panel en la pestaña de Logística

## Funcionalidad Implementada

### Características principales

1. **Formulario de transporte**:
   - Tipo de vehículo (furgoneta, camión, coche, otro)
   - Matrícula y descripción
   - Selección de conductor (de lista de trabajadores o nombre manual)
   - Direcciones de origen y destino

2. **Cálculo automático de hora de salida**:
   - `hora_salida = hora_llegada - trayecto_estimado - margen`
   - Margen configurable (default 30 minutos según spec)
   - Actualización en tiempo real al modificar campos

3. **Integración con timing**:
   - Obtiene el primer hito de timing del evento
   - Precarga hora de llegada desde timing

4. **Solo visible para eventos externos**:
   - Panel no se muestra si `venue_type !== 'externo'`

5. **Estados del transporte**:
   - pendiente → confirmado → en_camino → completado
   - Botones de acción según estado actual

## Instrucciones de Instalación

### 1. Aplicar migración SQL

```bash
# Conectar a la base de datos y ejecutar la migración
psql -U eventflow -d eventflow -f db/migrations/005_wp16_transporte.sql
```

O usando Docker:
```bash
docker exec -i eventflow-postgres psql -U postgres -d eventflow < db/migrations/005_wp16_transporte.sql
```

### 2. Verificar migración

```bash
psql -U eventflow -d eventflow -f scripts/verify-wp16.sql
```

### 3. Reiniciar la aplicación

```bash
npm run dev
# o
docker compose restart eventflow
```

## Cómo usar

1. Ir a **Cocina** → **Hojas Operativas**
2. Seleccionar un evento con `venue_type = 'externo'`
3. Ir a la pestaña **Logística**
4. El panel de **Plan de Transporte** aparecerá automáticamente
5. Completar los datos del vehículo y conductor
6. Establecer la hora de llegada (se precarga desde timing)
7. Ajustar tiempo de trayecto y margen
8. La hora de salida se calcula automáticamente
9. Guardar el plan

## Fórmula de Cálculo

```
hora_salida = hora_llegada - (tiempo_trayecto + margen_seguridad)

Ejemplo:
- Hora llegada: 18:00
- Tiempo trayecto: 60 min
- Margen: 30 min
- Hora salida calculada: 16:30
```

## Notas Técnicas

- La migración es idempotente (usa IF NOT EXISTS)
- El trigger se ejecuta automáticamente al INSERT o UPDATE de arrival_time, estimated_trip_minutes o margin_minutes
- La vista `v_event_first_timing` optimiza la consulta del primer hito de timing
- RLS deshabilitado (auth en capa API, patrón del proyecto)

## Aceptación (según spec)

- [x] Cambiar la hora de llegada del timing recalcula la hora de salida
- [x] Solo visible si `venue_type='externo'`
- [ ] Suite verde (requiere ejecutar tests)

## Sugerencias para futuros mejoras

1. Agregar mapa de ruta (integración con Google Maps API)
2. Notificación al conductor cuando se confirma el transporte
3. Seguimiento en tiempo real del vehículo
4. Historial de transportes por conductor
5. Cálculo automático de trayecto desde direcciones (API de mapas)
