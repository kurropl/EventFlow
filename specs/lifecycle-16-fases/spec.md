# EventFlow — Especificación del ciclo de vida del evento (16 fases)

> **Metodología SDD (Spec-Driven Development).** Este documento es la **fuente de
> verdad**. `tasks.md` deriva de aquí. Si algo del código contradice este spec,
> gana el spec (y se corrige el código).
>
> **Estado del proyecto:** casi todas las piezas existen. El problema es de
> **coherencia**, no de features que falten. Este spec fija las decisiones
> canónicas para converger las implementaciones duplicadas.

## 0. Decisiones canónicas (bloqueadas con el cliente)

1. **Idioma de estados: ESPAÑOL en toda la app** (BD, API, zod, UI). Se elimina el
   set inglés y se migran los datos.
2. **Fórmula de operaciones (única fuente):**
   - `mesas = ceil(comensales_adultos / 10)`
   - `camareros = ceil(mesas × 1.5)`
   - (kids no cuentan para mesas de adultos; mesa infantil opcional = `ceil(kids/8)`)
3. **Pagos:** `señal = 40%` del PVP total al aceptar; `saldo = 60%` con vencimiento
   = fecha del evento.
4. **Plan de implementación intercalado por fase** (lógica + UI homogénea juntas),
   precedido de una **Fase 0 de fundamentos** (transversales que todo lo demás necesita).

## 1. Modelo de dominio (entidades y relación)

```
lead ──(crea)──> quote ──(acepta)──> event ──(1:1)──> event_order
                          │                              │
                          ├─ payments (señal 40 / saldo 60)
                          ├─ event_shopping_items (escandallo)
                          ├─ staffing_lines (personal)
                          ├─ guest_forms / guests (invitados)
                          └─ invoices (factura final)
```

## 2. Máquina de estados canónica (ESPAÑOL)

### 2.1 `events.status`
`borrador → enviado → aceptado → en_curso → completado → pagado`
+ laterales: `cancelado`, `reabierto`.

| Canónico (ES) | Inglés actual a migrar | Español viejo a migrar |
|---|---|---|
| `borrador` | draft | nuevo |
| `enviado` | sent | propuesta_enviada |
| `aceptado` | accepted | confirmado |
| `en_curso` | in_progress | en_curso |
| `completado` | completed | completado |
| `pagado` | paid | — |
| `cancelado` | cancelled | cancelado |
| `reabierto` | reopened | — |

### 2.2 Otras tablas
- `quotes.status`: `borrador, enviado, aceptado, rechazado, caducado, historico`.
- `event_orders.status`: `en_curso, completado, cancelado`.
- `payments.status`: `pendiente, pagado, vencido, cancelado`.
- `leads.status`: `nuevo, contactado, presupuestado, convertido, perdido` (ya en ES; sin cambios).

### 2.3 Transiciones (con efectos atómicos)
- **FWD‑1** `borrador→enviado`: envío de presupuesto al cliente.
- **FWD‑2** `enviado→aceptado` (**= FWD‑3 del cliente / "señal"**). **Atómica (1 transacción):**
  1. `quote.status=aceptado`, `accepted_at=now()`
  2. `event.status=aceptado`, copia `total_pvp/total_cost`
  3. crea `event_order` (`en_curso`) con `mesas`/`camareros` (§0.2)
  4. crea `payments`: señal 40% (vence +7d) + saldo 60% (vence = fecha evento)
  5. genera escandallo (§3) — congelado=false
  6. genera `staffing_lines` con la fórmula §0.2
  7. `lead.status=convertido`
  - **Idempotente**: si ya hay `event_order` para el quote, no duplica.
- **FWD‑4** `aceptado/en_curso→completado` (**cierre**). **Atómica (1 transacción):**
  1. **freeze** escandallo (`frozen=true, frozen_at=now()`)
  2. `event.status=completado`, `event_order.status=completado`
  3. **deducir stock** real (`/api/stock/deduct`, idempotente vía `stock_deducted`)
  4. **generar factura** (`invoices`) si no existe (nº secuencial, no aleatorio)
  - Si cualquier paso falla → rollback completo (hoy NO lo hace: bug raíz de "no se completan las fases").
- **FWD‑5** `completado→pagado`: al marcar el saldo (60%) como cobrado.
- **BWD/REOPEN** `completado→reabierto`: descongela escandallo, revierte factura a borrador (con auditoría).

**Invariante:** toda transición escribe en `event_audit` (from, to, actor, motivo, efectos).

## 3. Escandallo (decisión de convergencia)

Hoy coexisten **dos sistemas**:
- (A) Vista `shopping_list` + `event_shopping_items` desde `catalog_items.ingredients` (JSONB) — `/api/shopping`.
- (B) `recipe_items` + `event_shopping_items` con `recipe_item_id`, `theoretical_qty`, `actual_*`, `frozen` y triggers (migración `2026-06-22-escandallo-*`).

**Canónico = (B)** (versionable, congelable, con coste teórico vs real). (A) queda como
*fallback* solo para platos sin receta en `recipe_items`. Cálculo:
`cantidad_teórica(ingrediente) = Σ_por_plato (qty_receta × raciones_del_plato)`.
**Freeze** en FWD‑4 fija `actual_qty := theoretical_qty` y bloquea recálculos.

## 4. Las 16 fases — criterios de aceptación

> Formato: **[estado pieza]** Fase → criterio verificable.

**FASE 1 · PRE‑VENTA**
1. **[OK]** Configurador `/configurador` genera lead+quote `borrador`.
2. **[OK]** Quote `borrador` con PVP por plato calculado server‑side.
3. **[OK]** Precio automático (PVP catálogo × raciones).
4. **[REVISAR]** Edición de presupuesto en 1ª reunión: editar líneas recalcula totales y persiste versión.
5. **[ATÓMICA]** Señal 40% (`/api/payments/signal`) dispara **FWD‑2** completa (§2.3) en 1 transacción.

**FASE 2 · PRE‑EVENTO**
6. **[UNIFICAR]** Mesas/camareros con la fórmula única §0.2 en TODOS los puntos.
7. **[OK]** `/invitados/[token]` público + `/api/admin/guest-forms`.
8. **[CONVERGER]** Recalcular escandallo: endpoint canónico **`/api/escandallo/[eventId]/recalc`** (sistema B); `/api/shopping` se alinea o se deprecia.
9. **[OK]** T‑7 confirmación `/admin/confirmacion` (invitados vs mesas).
10. **[OK]** Hoja de operación `/api/hoja-operacion/[eventId]` + PDF.
11. **[OK]** Briefing camareros (`BriefingCamareros`) en ficha de evento.

**FASE 3 · EJECUCIÓN**
12. **[OK]** Checklist por áreas (`ChecklistPanel`: cocina/servicio/montaje/limpieza).
13. **[ATÓMICA]** Cierre = **FWD‑4** (§2.3) en 1 transacción. **Eliminar la ruta duplicada** (`close` vs `transitions`): una sola.

**FASE 4 · POST‑EVENTO**
14. **[OK]** Stock se deduce en FWD‑4 (idempotente).
15. **[OK]** Saldo 60% en `/admin/cobros`; al cobrar → **FWD‑5** `pagado`.
16. **[OK]** Factura final (`invoices`) con nº secuencial.

## 5. Invariantes globales (deben cumplirse siempre)
- I1. Un único set de estados (español) en BD+API+UI.
- I2. FWD‑2 y FWD‑4 son atómicas (todo o nada) e idempotentes.
- I3. Una sola fórmula de mesas/camareros (módulo compartido `src/lib/operations.ts`).
- I4. Un solo sistema de escandallo canónico (B), con freeze en cierre.
- I5. Una sola ruta de cierre y una sola de aceptación.
- I6. Toda transición deja traza en `event_audit`.
- I7. Esquema reproducible: todo lo usado por el código existe en `schema.sql` (sin deriva).
