# Plan técnico — Spec 001 (ERP conectado)

Implementa la spec respetando la constitución. Estrategia: **introducir una capa
de dominio** y reducir los route handlers a controladores finos, eliminando la
duplicación incrementalmente sin romper lo que ya pasa verde.

## Arquitectura objetivo

```
src/lib/domain/                 ← NUEVA capa: una función por transacción
  acceptQuote.ts                  acceptQuote(quoteId, {actor}) → fan-out atómico
  recordPayment.ts                recordPayment / markPaid (idempotente)
  closeEvent.ts                   closeEvent(eventId) (mueve la lógica de close)
  recalcEventCost.ts              recalcEventCost(eventId) = Σ escandallo estimado
  generateEscandallo.ts           a partir de selected_items (única copia)
  generateInvoice.ts              factura secuencial idempotente (única copia)
  eventState.ts                   máquina de estados: única que escribe events.status
  suggestStaffing.ts              calcMesas/calcCamareros (reusa src/lib/operations.ts)

src/app/api/**/route.ts         ← controladores finos: auth + zod + delegan a domain/
```

Regla de oro: **todo `INSERT INTO event_orders|payments|invoices` y todo
`UPDATE events SET status` vive solo dentro de `src/lib/domain/`.**

## Decisiones de diseño

### D1 · `acceptQuote(quoteId, ctx)` — el corazón
Transacción única (BEGIN/COMMIT) que:
1. Marca quote `accepted`, proyecta totals a `events` (`total_pvp`; `total_cost` lo fija `recalcEventCost` al final).
2. Crea `event_order` (idempotente: si existe, no duplica).
3. Crea pagos 40/60 (idempotente por concepto+evento).
4. Genera `client_token` si falta.
5. Llama `generateEscandallo(eventId)` (que setea `recipe_item_id`, `category`, `estimated_cost`).
6. Llama `recalcEventCost(eventId)` → fija `events.total_cost`.
7. Calcula sugerencia mesas/camareros en el order.
8. Transición de estado a `accepted` vía `eventState`.
9. (Factura se difiere al cierre; no en aceptación.)
Idempotencia: cada paso comprueba existencia antes de insertar. Repetir = no-op.

Los 4 handlers de aceptación pasan a:
```ts
const result = await acceptQuote(quoteId, { actor });
return NextResponse.json({ success: true, data: result });
```

### D2 · `recalcEventCost(eventId)` — Opción B
`UPDATE events SET total_cost = (SELECT COALESCE(SUM(estimated_cost),0)
   FROM event_shopping_items WHERE event_id=$1 AND frozen=false)`.
Se invoca en: aceptación, cambio de `guest_count`, regeneración de escandallo,
y tras `recalcEscandallo`. `rentabilidad` ya lee `events.total_cost` → queda
correcto sin tocar la UI. Quitar de `rentabilidad` la columna "escandallo aparte"
o renombrarla a "coste real (congelado)" para evitar confusión.

### D3 · `eventState.ts` — máquina única
Extraer el mapa `VALID` y los efectos de `events/[id]/transitions/route.ts` a un
módulo de dominio. Exponer `applyTransition(eventId, code, ctx)` y
`setStatus(eventId, status, ctx)` interno. Sustituir los 18 `UPDATE events SET
status` por llamadas a este módulo (los que sean transiciones legítimas) o
eliminarlos (los que son bypass).

### D4 · Camino del cliente
- `quotes/public/[id]/accept` → delega en `acceptQuote` (queda completo). 
- Configurador (`events/route.ts`): tras crear el evento, crear/vincular `lead`
  (status `nuevo`) y emitir webhook `LEAD_CREATED`.
- Añadir `POST /api/quotes/public/[id]/reject` + botón en `/presupuesto/[id]`.
- Exponer guardado de decoración por token: `PATCH /api/guest-forms/decor` (o
  ampliar `isPublicMethod` a una sub-ruta acotada), nunca abrir `PUT /api/events/[id]` entero.
- Corregir `leads.status='confirmado'` → `'convertido'` (2 sitios) y revisar el
  resto de mapeos contra el CHECK.
- `/evento/[id]`: generar y entregar el enlace (email post-aceptación) y arreglar
  el mapa de labels de estado (`ClientEventView.tsx:31-38`).

### D5 · Contratos UI cocina
- Crear `GET /api/cocina/passes` con forma `{success,data}` y `PUT
  /api/cocina/passes/[id]` para editar mapeos; `PASS_OPTIONS` desde
  `service_passes` reales (no `pass_a..d`).
- Alinear nombres: la UI pide `production|loading|logistics` (inglés) o se crean
  alias ES; unificar a inglés y arreglar `CocinaPanel.tsx:790`.
- `custom_pass_order`: fijar forma `{[item_name]: pass_number}` y adaptar
  `cocinaSheets.ts:128-132` a esa forma.

### D6 · Limpieza huérfanos
- Eliminar/repintar el fallback de escandallo en FWD-4 (`transitions:163-183`) que
  referencia columnas inexistentes.
- `generateEscandallo` setea `recipe_item_id` (R6.2).
- Hojas logística: usar `ingredients.is_equipment`/`is_dry` en `cocinaSheets.ts`.

## Estrategia de migración (sin romper verde)
1. Crear capa de dominio extrayendo la lógica **ya correcta** de `quotes/[id]`.
2. Redirigir un handler a la vez a la capa; correr los 3 scripts E2E tras cada uno.
3. Borrar la lógica duplicada del handler solo cuando su E2E pasa vía dominio.
4. Añadir E2E nuevos (cliente acepta; coste=escandallo; cocina tabs) antes de
   tocar cada área, para fijar el comportamiento esperado.

## Verificación (cómo se demuestra "conectado")
- `scripts/verify-e2e.sh`, `verify-rbac-cocina.sh`, `verify-operativos.sh` siguen verde.
- **Nuevo** `scripts/verify-erp-conectado.sh`: recorre cliente acepta →
  comprueba order+pagos+token+escandallo+coste; cambia pax → coste se recalcula;
  cierra → factura + desviación; cocina lista pases y hojas. Sobre BD recién
  cargada desde `schema.sql`.
- Test de invariantes en `src/lib/__tests__/` (los 6 invariantes de la spec).

## Riesgos
- Refactor amplio de handlers → mitigado por migración incremental + E2E por paso.
- Idempotencia: revisar constraints (factura única por evento, pagos por concepto).
- No introducir regresiones en RBAC: los handlers siguen autenticando antes de delegar.
