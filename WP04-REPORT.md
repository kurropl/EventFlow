# Informe WP-04: Outbox, Worker y Máquina de Estados

**Fecha:** 2026-07-30  
**Agente:** Ejecutor WP-04  
**Estado:** Implementación completada (pendiente de verificación con BD)

---

## Archivos creados/modificados

### Nuevos archivos
1. **db/migrations/001_wp04_domain_events.sql** - Migración SQL para tabla domain_events y ampliación de estados
2. **db/migrations/verify_wp04.sql** - Script de verificación post-migración
3. **src/domain/events.ts** - Funciones de emisión y consumo de eventos de dominio
4. **src/domain/eventStateMachine.ts** - Máquina de estados ampliada (única fuente de verdad)
5. **src/domain/handlers/index.ts** - Registro de handlers por tipo de evento
6. **src/domain/handlers/eventConfirmed.ts** - Handler para evento confirmado
7. **src/app/api/cron/domain-events-worker/route.ts** - Worker consumidor de eventos
8. **src/app/api/events/[id]/domain-events/route.ts** - API para timeline de eventos
9. **src/components/b2b/EventTimeline.tsx** - Componente de timeline para ficha de evento
10. **src/lib/__tests__/eventStateMachine.test.ts** - Tests unitarios para máquina de estados
11. **src/lib/__tests__/domainEventsWorker.test.ts** - Tests de integración para worker (requiere BD)
12. **src/lib/__tests__/domainEventsWorkerUnit.test.ts** - Tests unitarios para worker (sin BD)

### Archivos modificados
1. **src/lib/domain/eventState.ts** - Actualizado para importar máquina de estados ampliada
2. **src/components/b2b/EventDetail.tsx** - Agregadas pestañas General/Timeline

---

## Decisiones de mapeo de nombres

### Estados de evento
- **Legados conservados:** `draft`, `sent`, `accepted`, `in_progress`, `completed`, `paid`, `cancelled`, `lost`, `reopened`, `presupuestado`
- **Nuevos estados WP-04:** `en_preparacion`, `cerrado_operativo`, `cerrado_contable`
- **Nota:** `completado` se conserva como alias legado de `cerrado_operativo` para datos históricos

### Transiciones
- **Legadas:** Se mantienen los códigos FWD-2, FWD-3, FWD-4, INV-1 a INV-5, PAY-1, PAY-2
- **Nuevas:** OPC-1 a OPC-5 para nuevas transiciones, INV-6 e INV-7 para cancelación/reapertura

### Tabla domain_events
- **PK:** `BIGSERIAL` (secuencial, no UUID) para mejor rendimiento en índices
- **aggregate_type:** 'event', 'purchase_order', 'menu', etc. (siguiendo convención existente)
- **payload:** JSONB con datos del evento
- **processed_at:** NULL = pendiente, timestamp = procesado

---

## Comandos de aceptación

### 1. Migración SQL
```bash
# Aplicar migración (cuando Docker esté disponible)
docker exec -i eventflow-postgres psql -U postgres -d eventflow < db/migrations/001_wp04_domain_events.sql

# Verificar
docker exec -i eventflow-postgres psql -U postgres -d eventflow < db/migrations/verify_wp04.sql
```

### 2. Tests unitarios (máquina de estados)
```bash
npx vitest run src/lib/__tests__/eventStateMachine.test.ts
```
**Resultado:** 13 tests pasados ✅

### 3. Tests unitarios (worker)
```bash
npx vitest run src/lib/__tests__/domainEventsWorkerUnit.test.ts
```
**Resultado:** 11 tests pasados ✅

### 4. Tests de integración (worker con BD)
```bash
npx vitest run src/lib/__tests__/domainEventsWorker.test.ts
```
**Nota:** Requiere base de datos PostgreSQL ejecutándose

### 5. Suite completa (tests sin BD)
```bash
npx vitest run src/lib/__tests__/eventStateMachine.test.ts src/lib/__tests__/domainEventsWorkerUnit.test.ts
```
**Resultado:** 24 tests pasados ✅

### 6. Suite completa (con BD)
```bash
npm run test:unit
```
**Nota:** Requiere Docker con PostgreSQL

### 5. Verificación manual
```bash
# Verificar que la API de timeline funciona
curl -X GET "http://localhost:3020/api/events/[event-id]/domain-events"

# Verificar que el worker procesa eventos
curl -X GET "http://localhost:3020/api/cron/domain-events-worker"
```

---

## Implementación según spec

### ✅ Tabla domain_events (§4 del modelo)
- Creada con todos los campos especificados
- Índice para eventos pendientes
- Constraint de estados ampliado

### ✅ emitDomainEvent() (recibe tx activa)
- Implementada en `src/domain/events.ts`
- Requiere PoolClient con transacción activa
- Versión standalone para casos sin transacción externa

### ✅ Máquina de estados (src/domain/eventStateMachine.ts)
- Única fuente de verdad para transiciones
- Estados nuevos: en_preparacion, cerrado_operativo, cerrado_contable
- Transiciones validadas con códigos (OPC-1 a OPC-5)

### ✅ Worker consumidor
- Montado sobre runner existente de cron routes
- Procesa eventos pendientes con reintentos
- Máximo 5 intentos, luego last_error
- Intervalo recomendado: 30 segundos

### ✅ Estados nuevos
- Añadidos al CHECK constraint de events
- Transiciones válidas documentadas
- Compatibilidad con datos históricos

### ✅ Timeline en ficha de evento
- Nueva pestaña "Timeline" en ficha de evento
- Muestra eventos de dominio en orden cronológico inverso
- Estados visuales: procesado, pendiente, reintentando, fallido

---

## Pendiente (requiere Docker/BD)

1. **Aplicar migración SQL** - Pendiente de ejecutar en entorno con Docker
2. **Ejecutar tests de integración** - Requieren PostgreSQL
3. **Verificar transiciones en UI** - Probar flujo completo en navegador
4. **Documentar en SCHEMA-MAP.md** - Actualizar tabla domain_events

---

## Notas para el coordinador

1. **Compatibilidad:** La migración es aditiva, no destructiva. Los datos históricos se mantienen.
2. **Estados:** El CHECK constraint incluye tanto estados legados como nuevos.
3. **Worker:** Está configurado para procesar eventos en lotes de 10, con reintentos exponenciales.
4. **Timeline:** Muestra solo eventos de dominio; se puede extender para incluir interacciones CRM.
5. **Handlers:** Solo hay un handler implementado (event.confirmed). Los demás se implementarán en WPs posteriores.

---

## Sugerencias (no implementadas en este WP)

1. **Manejo de errores en UI:** Mostrar errores de transición de forma más amigable.
2. **Notificaciones:** Enviar notificaciones cuando un evento falle multiple veces.
3. **Dashboard de eventos:** Panel que muestre eventos pendientes de procesar.
4. **Métricas:** Contador de eventos procesados/fallidos por hora/día.