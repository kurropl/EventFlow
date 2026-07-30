# WP-04: Outbox, Worker y Máquina de Estados - RESUMEN

## ✅ Implementación Completada

### 1. Tabla domain_events (Outbox)
- **Archivo:** `db/migrations/001_wp04_domain_events.sql`
- **Campos:** id, event_type, aggregate_type, aggregate_id, payload (JSONB), created_at, processed_at, attempts, last_error
- **Índice:** Para eventos pendientes (processed_at IS NULL)

### 2. emitDomainEvent() 
- **Archivo:** `src/domain/events.ts`
- **Función principal:** `emitDomainEvent(client, eventType, aggregateType, aggregateId, payload)`
- **Requiere:** PoolClient con transacción activa
- **Versión standalone:** `emitDomainEventStandalone()` para casos sin transacción externa

### 3. Máquina de Estados Ampliada
- **Archivo:** `src/domain/eventStateMachine.ts`
- **Estados nuevos:** en_preparacion, cerrado_operativo, cerrado_contable
- **Transiciones:** OPC-1 a OPC-5 para nuevos flujos
- **Compatibilidad:** Conserva estados legados (draft, sent, accepted, completed, etc.)

### 4. Worker Consumidor
- **Archivo:** `src/app/api/cron/domain-events-worker/route.ts`
- **Endpoint:** GET /api/cron/domain-events-worker
- **Configuración:** Máximo 5 reintentos, lote de 10 eventos
- **Reutiliza:** Estructura de cron routes existente

### 5. Timeline en Ficha de Evento
- **Componente:** `src/components/b2b/EventTimeline.tsx`
- **API:** `src/app/api/events/[id]/domain-events/route.ts`
- **UI:** Pestaña "Timeline" en EventDetail
- **Muestra:** Eventos de dominio en orden cronológico inverso

### 6. Tests
- **Unitarios máquina de estados:** 13 tests ✅
- **Unitarios worker:** 11 tests ✅
- **Total:** 24 tests pasados

## 📁 Archivos Creados/Modificados

### Nuevos (12 archivos)
1. `db/migrations/001_wp04_domain_events.sql`
2. `db/migrations/verify_wp04.sql`
3. `src/domain/events.ts`
4. `src/domain/eventStateMachine.ts`
5. `src/domain/handlers/index.ts`
6. `src/domain/handlers/eventConfirmed.ts`
7. `src/app/api/cron/domain-events-worker/route.ts`
8. `src/app/api/events/[id]/domain-events/route.ts`
9. `src/components/b2b/EventTimeline.tsx`
10. `src/lib/__tests__/eventStateMachine.test.ts`
11. `src/lib/__tests__/domainEventsWorker.test.ts`
12. `src/lib/__tests__/domainEventsWorkerUnit.test.ts`

### Modificados (2 archivos)
1. `src/lib/domain/eventState.ts` - Importa máquina de estados ampliada
2. `src/components/b2b/EventDetail.tsx` - Agregada pestaña Timeline

## 🧪 Verificación

### Tests Unitarios (sin BD)
```bash
npx vitest run src/lib/__tests__/eventStateMachine.test.ts src/lib/__tests__/domainEventsWorkerUnit.test.ts
```
**Resultado:** 24 tests pasados ✅

### Verificación de Migración (requiere BD)
```bash
docker exec -i eventflow-postgres psql -U postgres -d eventflow < db/migrations/001_wp04_domain_events.sql
docker exec -i eventflow-postgres psql -U postgres -d eventflow < db/migrations/verify_wp04.sql
```

## 🔧 Decisiones de Implementación

1. **PK BIGSERIAL** para domain_events (mejor rendimiento en índices que UUID)
2. **Estados legados conservados** para compatibilidad con datos históricos
3. **Worker sobre cron routes existente** (reutiliza infraestructura)
4. **Timeline solo muestra domain_events** (se puede extender a interacciones CRM)
5. **Handlers con registro centralizado** (mapa en src/domain/handlers/index.ts)

## ⚠️ Pendiente (Requiere Docker/BD)

1. Aplicar migración SQL en entorno con Docker
2. Ejecutar tests de integración con base de datos
3. Verificar transiciones en UI (navegador)
4. Documentar tabla domain_events en SCHEMA-MAP.md

## 📋 Siguiente WP

Los handlers para otros eventos de dominio se implementarán en WPs posteriores:
- WP-06: purchase_order.received
- WP-12: menu.published, menu.price_changed
- WP-15: event.confirmed (extensión)
- WP-17: shift.offered, shift.confirmed
- WP-21: payment.milestone_due
- WP-22: deposit.paid
- WP-25: portal.frozen, portal.updated