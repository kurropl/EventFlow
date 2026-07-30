# Informe WP-24: Cierre Económico del Evento

**Fecha:** 2026-08-01  
**Agente:** pi (wp24-cierre-economico)  
**Estado:** ✅ Implementación completa (pendiente de migración en BD)

---

## Archivos Tocados

### Migración SQL
- `db/migrations/006_wp24_cierre_economico.sql` — NUEVO
  - Tabla `event_financial_closures` con las columnas requeridas por spec §4
  - Constraint `events_status_check` actualizado con `cerrado_contable`

### Handler
- `src/domain/handlers/eventOperationallyClosed.ts` — NUEVO
  - Handler de `event.operationally_closed`
  - Calcula: food_cost (escandallo), staff_cost (worker_event_pay), extras_revenue (event_extras)
  - Persiste en `event_financial_closures`
  - Idempotente: no sobreescribe cierres congelados

- `src/domain/handlers/index.ts` — MODIFICADO
  - Registrado handler `event.operationally_closed`

### Transición
- `src/app/api/events/[id]/transitions/route.ts` — MODIFICADO
  - Añadida transición `OPC-5` (cerrado_operativo → cerrado_contable)
  - Congela la fila de cierre económico
  - Emite `event.financially_closed`

### API
- `src/app/api/rentabilidad/route.ts` — MODIFICADO
  - Añadidos campos `financialClosure` y `hasFinancialClosure` a la respuesta
  - Muestra datos reales cuando existen, estimados si no

### UI
- `src/app/admin/rentabilidad/page.tsx` — MODIFICADO
  - Panel de cierre económico en cada evento
  - Muestra: food cost (prev→real), staff cost (prev→real), extras, margen real
  - Badge de estado: "🔒 Contable" o "📋 Operativo"

### Tests
- `src/lib/__tests__/eventOperationallyClosed.test.ts` — NUEVO
  - 3 tests: cálculo correcto, idempotencia, margen

### Scripts
- `scripts/verify-wp24.sh` — NUEVO
  - Script de verificación del WP-24

---

## Decisiones de Mapeo de Nombres

| Spec (lógico) | Real (código) | Nota |
|---------------|---------------|------|
| `event_financial_closures` | `event_financial_closures` | Misma tabla |
| `event.operationally_closed` | `event.operationally_closed` | Mismo evento de dominio |
| `event.financially_closed` | `event.financially_closed` | Mismo evento de dominio |
| `cerrado_operativo` | `cerrado_operativo` | Estado existente en CHECK |
| `cerrado_contable` | `cerrado_contable` | Estado añadido en CHECK |
| `OPC-5` | `OPC-5` | Transición según spec |

---

## Cálculos Implementados

### food_cost (Comida)
- **Previsto:** `SUM(estimated_cost)` de `event_shopping_items`
- **Real:** `SUM(COALESCE(NULLIF(actual_cost_total, 0), estimated_cost, 0))`

### staff_cost (Personal)
- **Previsto:** `SUM(total_pay)` de `worker_event_pay`
- **Real:** `SUM(total_pay) FILTER (WHERE status = 'paid')`

### extras_revenue (Extras)
- **Real:** `SUM(price_snapshot * qty)` de `event_extras` (WP-29)
- Si la tabla no existe, retorna 0

### total_revenue (Ingresos)
- **Real:** `events.total_pvp`

### real_margin_pct (Margen)
- **Fórmula:** `(total_revenue - real_food_cost - real_staff_cost) / total_revenue * 100`

---

## Comandos de Aceptación

### 1. Migración (requiere Docker corriendo)
```bash
# Ejecutar migración
docker exec -i eventflow-postgres psql -U postgres -d eventflow < db/migrations/006_wp24_cierre_economico.sql

# Verificar tabla
docker exec -i eventflow-postgres psql -U postgres -d eventflow -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'event_financial_closures')"

# Verificar constraint
docker exec -i eventflow-postgres psql -U postgres -d eventflow -c "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'events_status_check'"
```

### 2. Tests
```bash
npx vitest run src/lib/__tests__/eventOperationallyClosed.test.ts
```

### 3. Verificación completa
```bash
BASE=http://localhost:3020 bash scripts/verify-wp24.sh
```

---

## Notas Importantes

1. **Docker no estaba corriendo** durante la implementación. La migración SQL está lista pero no se ejecutó en la BD.

2. **La tabla `event_extras`** (WP-29) puede no existir aún. El handler maneja este caso retornando `extras_revenue = 0`.

3. **La transición OPC-5** requiere que exista un cierre económico previo (creado por `event.operationally_closed`). Si no existe, retorna error 400.

4. **El cierre económico NO congela automáticamente** al cerrar operativamente. Solo se congela cuando el Gerente ejecuta `OPC-5` (cerrado_operativo → cerrado_contable).

---

## Sugerencias (fuera de alcance)

1. Añadir validación de roles en `OPC-5` (solo Gerente/Admin)
2. Notificación automática al Gerente cuando hay un cierre operativo pendiente de cierre contable
3. Dashboard de rentabilidad con filtros por rango de fechas y tipo de evento
