# Spec 001 — EventFlow como ERP conectado

**Estado:** Draft para ejecución · **Autor:** auditoría (opus) · **Fecha:** 2026-06-28
**Metodología:** SDD (Spec-Driven Development). Este documento describe el QUÉ y el
PORQUÉ. El CÓMO está en `plan.md`; el desglose ejecutable en `tasks.md`.

## 1. Problema (por qué existe esta spec)

EventFlow tiene todas las piezas de un ERP de catering (comercial, cocina, sala,
finanzas) pero **no están conectadas como un ERP**. Un grilleo sistemático del
código revela la causa raíz: **la misma operación de negocio está implementada
varias veces, en route handlers distintos, de forma divergente** ("sesiones
duplicadas"). Según qué camino tome el usuario, ocurren efectos distintos, y los
datos no se propagan entre roles. Además hay **múltiples fuentes de verdad** para
el coste y el estado.

### Evidencia del grilleo (file:line)
- **Aceptación duplicada (≥4 copias divergentes):**
  - `src/app/api/quotes/[id]/route.ts:100-219` — completa (order+pagos+token+escandallo).
  - `src/app/api/quotes/public/[id]/accept/route.ts:43-65` — **incompleta** (solo status). Es el camino del **cliente final** → deja el evento huérfano.
  - `src/app/api/events/[id]/route.ts:300-340` — **tercera copia** (crea quote+order+pagos+factura).
  - `src/app/api/events/[id]/confirm/route.ts:50-87` — cuarta variante (pago + status).
- **Creación de `event_order` en 4 sitios; `payments` en 7; factura en 4; escandallo en 5.**
- **Bypass de máquina de estados:** 18 endpoints hacen `UPDATE events SET status=...`; solo `transitions/route.ts` debería.
- **Coste con doble fuente:** `events.total_cost` se setea desde el quote (`quotes/[id]:104-106`), mientras el escandallo (Σ `event_shopping_items.estimated_cost`) se calcula aparte y `rentabilidad` lo muestra sin usarlo para el margen (`rentabilidad/route.ts:44-58`). El cierre nunca sincroniza `total_cost` desde el escandallo (`close/route.ts:72`).
- **Camino cliente roto:** configurador no crea `lead`; aceptación pública no crea `client_token` → `/invitados/[token]` inaccesible; decoración da 401; `leads.status='confirmado'` viola el CHECK (`schema.sql:529`).
- **Contratos UI rotos (cocina):** tabs Pases y Hojas llaman rutas inexistentes / esperan otra forma (`CocinaPanel.tsx:627-669,790-793`).

## 2. Objetivo

Convertir EventFlow en un ERP **conectado y sin duplicación**: un único camino
canónico por transacción, una única fuente de verdad por dato, y propagación
automática entre las 4 perspectivas. Medible con verificaciones E2E que recorren
un evento de punta a punta cruzando roles.

## 3. Alcance

**Dentro:** consolidación de la lógica de dominio (aceptar/confirmar/pagar/cerrar/
recalcular coste/facturar), máquina de estados como único guardián del estado,
fuente única de coste (escandallo estimado), reparación del camino del cliente,
reparación de contratos UI↔API de cocina, y E2E cross-rol.

**Fuera (por ahora):** rediseño visual, nuevas features de negocio, integración
WhatsApp real (sigue en modo `mock`), multi-tenant.

## 4. Actores / perspectivas
- **Usuario/cliente final** (sin login, por token): configura, ve y acepta presupuesto, paga señal, rellena invitados.
- **Administrador** (`admin`): orquesta todo el ciclo; ve rentabilidad real.
- **Comercial** (`clientes`): leads → presupuesto → seguimiento.
- **Cocinero** (`cocina`): escandallo, guía, hojas, stock, APPCC.
- **Camarero/Maître** (`camareros`): staffing, ofertas, mesas, briefing, nóminas.

## 5. Requisitos (con criterios de aceptación)

> Formato Given/When/Then. Cada criterio debe ser verificable automáticamente.

### R1 · Aceptación única y completa (P0)
**US:** Como cliente o admin, cuando se acepta un presupuesto, el evento queda
listo para todas las áreas, sin importar el camino.
- **AC1.1** Given un quote `sent`, When se acepta por la ruta del cliente
  (`/api/quotes/public/[id]/accept`) **o** por la del admin (`/api/quotes/[id]`),
  Then en ambos casos se crean: 1 `event_order`, pagos 40/60, `client_token`,
  escandallo (≥1 `event_shopping_items`), y `events.status='accepted'`.
- **AC1.2** Given una aceptación ya realizada, When se repite la llamada, Then no
  se duplican order/pagos/escandallo (idempotente).
- **AC1.3** Then existe **una sola** función de dominio que lo hace; los handlers
  `quotes/[id]`, `quotes/public/[id]/accept`, `events/[id]` (PUT) y
  `events/[id]/confirm` delegan en ella y no contienen `INSERT INTO event_orders`.

### R2 · Fuente única de coste — Opción B (P0)
**US:** Como admin, el margen y la factura reflejan el coste real del escandallo.
- **AC2.1** `events.total_cost` se escribe **solo** por `recalcEventCost(eventId)`
  = Σ `event_shopping_items.estimated_cost`.
- **AC2.2** When cambia `guest_count` o se regenera el escandallo, Then
  `recalcEventCost` se ejecuta y `events.total_cost` queda consistente con el escandallo.
- **AC2.3** `rentabilidad` calcula el margen con esa fuente; el coste mostrado y el
  usado para el margen coinciden.
- **AC2.4** El coste **real** sigue derivándose al congelar (`freezeEscandallo`)
  como desviación; no sustituye al estimado como fuente de planificación.

### R3 · Estado gobernado por la máquina de estados (P1)
- **AC3.1** `events.status` solo se modifica vía la máquina de transiciones
  (módulo único). Ningún otro handler hace `UPDATE events SET status`.
- **AC3.2** Las transiciones rechazan saltos inválidos y registran en `audit_log`.

### R4 · Camino del cliente conectado (P0/P1)
- **AC4.1** El configurador crea (o vincula) un `lead` y el evento; el comercial lo
  ve en el CRM de leads.
- **AC4.2** Tras aceptación del cliente, `/invitados/[token]` es accesible (token creado).
- **AC4.3** El cliente puede **rechazar** el presupuesto (endpoint + UI).
- **AC4.4** El cliente ve señal/saldo (40/60) y su estado de pago.
- **AC4.5** La decoración (`linen_type`/`centerpiece`) se guarda desde invitados sin 401 (ruta pública acotada por token).
- **AC4.6** `leads.status` usa valores válidos del CHECK (`convertido`, no `confirmado`).

### R5 · Contratos UI↔API de cocina reparados (P1)
- **AC5.1** Tab Pases lista pases reales (`service_passes`) y guarda mapeos sin 404.
- **AC5.2** Tab Hojas muestra producción/carga/logística (rutas y forma de respuesta alineadas).
- **AC5.3** `custom_pass_order` tiene una única forma JSON consumida igual por todos.

### R6 · Sin huérfanos ni efectos muertos (P2)
- **AC6.1** El fallback de escandallo en FWD-4 no referencia columnas inexistentes (o se elimina).
- **AC6.2** El escandallo generado al aceptar setea `recipe_item_id` → `recalcEscandallo` lo re-escala al cambiar pax.
- **AC6.3** Las hojas de logística usan `ingredients.is_equipment`/`is_dry`.
- **AC6.4** Invitados→mesas (`table_assignments`) conectado o documentado como pendiente.

## 6. Invariantes (verificables en cualquier momento)
1. Exactamente **1** `event_order` por evento aceptado.
2. Σ pagos del evento = `events.total_pvp` (±0,01) tras aceptación.
3. `events.total_cost` == Σ `event_shopping_items.estimated_cost` del evento (no congelado).
4. `events.status` ∈ valores del CHECK y alcanzable por la máquina de estados.
5. Cada evento `accepted` tiene `client_token` no nulo.
6. Ningún handler fuera de la capa de dominio contiene `INSERT INTO {event_orders,payments,invoices}`.

## 7. Fuera de criterio / decisiones tomadas
- Fuente de verdad del coste = **escandallo estimado** (decisión del usuario).
- WhatsApp permanece en `mock` (no bloquea la conexión del ERP).
- No se rehace el modelo de datos: `schema.sql` ya es la fuente reproducible (Spec previa, Opción A, cerrada).
