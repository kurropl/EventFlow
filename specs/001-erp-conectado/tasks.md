# Tasks — Spec 001 (ERP conectado)

Ejecutar en orden. Cada tarea: criterio de cierre + verificación. Marcar `[x]` al
completar. Tras CADA tarea de las fases P0/P1: correr los 3 scripts E2E existentes
(deben seguir 32/32, 41/41, 14/14) + build.

Convención: cada tarea referencia su requisito (Rx) y archivos. "DoD" = cómo se
demuestra hecha.

---

## FASE 0 · Red de seguridad (antes de refactorizar)
- [ ] **T0.1** Escribir `scripts/verify-erp-conectado.sh` que (sobre BD recién
  cargada + seed) acepte un quote por la ruta del CLIENTE y verifique en BD:
  1 event_order, 2 payments (40/60 = total_pvp), client_token≠null, ≥1
  event_shopping_items, `events.total_cost == Σ estimated_cost`. *Debe FALLAR hoy*
  (rojo) — fija el objetivo. **DoD:** script existe y falla en los puntos esperados.
- [ ] **T0.2** Test de invariantes `src/lib/__tests__/erp-invariants.test.ts` con
  los 6 invariantes de `spec.md §6` (consultas SQL parametrizables). **DoD:** test
  corre; documenta cuáles fallan hoy.

## FASE 1 · Capa de dominio + aceptación única (P0 · R1)
- [ ] **T1.1** Crear `src/lib/domain/generateEscandallo.ts` extrayendo la lógica de
  `quotes/[id]/route.ts:165-260` SIN cambiar comportamiento, **añadiendo**
  `recipe_item_id` al INSERT (R6.2). **DoD:** quotes/[id] usa la función; E2E verde.
- [ ] **T1.2** Crear `src/lib/domain/recalcEventCost.ts` (D2). **DoD:** unit test:
  tras generar escandallo, `events.total_cost == Σ estimated_cost`.
- [ ] **T1.3** Crear `src/lib/domain/acceptQuote.ts` (D1) reutilizando T1.1/T1.2 +
  pagos 40/60 + client_token + sugerencia staffing, **idempotente**. **DoD:** unit
  test de idempotencia (llamar 2× no duplica).
- [ ] **T1.4** `quotes/[id]/route.ts` (admin) delega en `acceptQuote`; borrar la
  lógica duplicada. **DoD:** `verify-e2e.sh` 32/32.
- [ ] **T1.5** `quotes/public/[id]/accept/route.ts` (cliente) delega en
  `acceptQuote`. **DoD:** `verify-erp-conectado.sh` empieza a pasar la parte de
  aceptación-cliente (R1.1).
- [ ] **T1.6** `events/[id]/route.ts` PUT: eliminar el bloque duplicado
  (`:287-340`) y delegar/llamar `acceptQuote` cuando proceda. **DoD:** ningún
  `INSERT INTO event_orders` fuera de `domain/` (grep en verde). Invariante #6.
- [ ] **T1.7** `events/[id]/confirm/route.ts`: reducir a "registrar pago de señal"
  vía `recordPayment` (sin re-crear order/status ad-hoc) o deprecar si redundante.
  **DoD:** confirm no duplica order/pagos; E2E verde.

## FASE 2 · Fuente única de coste — Opción B (P0 · R2)
- [ ] **T2.1** Invocar `recalcEventCost` en: aceptación (ya en T1.3), cambio de
  `guest_count` (`events/[id]` PUT y donde se edite pax), y tras `recalcEscandallo`
  (`src/lib/recalcEscandallo.ts`). **DoD:** AC2.2 (cambiar pax recalcula coste).
- [ ] **T2.2** Garantizar que **solo** `recalcEventCost` escribe `events.total_cost`
  (quitar el set desde el quote en `quotes/[id]:104-106`, dejar solo total_pvp).
  **DoD:** grep: `total_cost =` solo en `domain/recalcEventCost.ts` (+triggers schema).
- [ ] **T2.3** `rentabilidad/route.ts`: el margen ya usa `events.total_cost`
  (correcto tras T2.2); renombrar/aclarar la métrica "escandallo" a "coste real
  congelado". **DoD:** AC2.3 (coste mostrado = coste del margen).

## FASE 3 · Máquina de estados única (P1 · R3)
- [ ] **T3.1** Extraer `src/lib/domain/eventState.ts` desde
  `events/[id]/transitions/route.ts` (mapa VALID + efectos). **DoD:** transitions
  delega; `verify-operativos.sh` 14/14.
- [ ] **T3.2** Auditar los 18 `UPDATE events SET status`: reemplazar por
  `eventState.setStatus/applyTransition` o eliminar si son bypass ilegítimos.
  **DoD:** grep: `UPDATE events SET ... status` solo en `domain/eventState.ts`.
  Invariante #4.

## FASE 4 · Camino del cliente conectado (P0/P1 · R4)
- [ ] **T4.1** `events/route.ts` (configurador): crear/vincular `lead` + webhook
  `LEAD_CREATED`. **DoD:** AC4.1 (lead visible en CRM).
- [ ] **T4.2** Corregir `leads.status='confirmado'`→`'convertido'` en
  `quotes/public/[id]/accept:59` y `quotes/[id]:387` (y revisar otros). **DoD:**
  AC4.6 (sin violación de CHECK; el UPDATE ya no cae en catch).
- [ ] **T4.3** `client_token` garantizado por `acceptQuote` (T1.3) → `/invitados/
  [token]` accesible tras aceptación cliente. **DoD:** AC4.2.
- [ ] **T4.4** `POST /api/quotes/public/[id]/reject` + botón rechazar en
  `presupuesto/[id]/page.tsx`. **DoD:** AC4.3.
- [ ] **T4.5** Mostrar señal/saldo y estado de pago en `presupuesto/[id]` y/o
  `evento/[id]`. **DoD:** AC4.4.
- [ ] **T4.6** Decoración por token: ruta pública acotada (`PATCH /api/guest-forms/
  decor` por token) y `invitados/[token]/page.tsx:147` la usa. **DoD:** AC4.5 (sin 401).
- [ ] **T4.7** `ClientEventView.tsx:31-38`: mapa de labels alineado con estados
  reales; generar enlace `/evento/[id]` tras aceptación. **DoD:** AC4 (pantalla conectada).

## FASE 5 · Contratos UI cocina (P1 · R5)
- [ ] **T5.1** `GET /api/cocina/passes` forma `{success,data}` + `PUT /api/cocina/
  passes/[id]`; `PASS_OPTIONS` desde `service_passes`. **DoD:** AC5.1 (tab Pases
  lista y guarda).
- [ ] **T5.2** Alinear tab Hojas: rutas `production|loading|logistics` y forma de
  respuesta (`CocinaPanel.tsx:790-793`). **DoD:** AC5.2 (tab Hojas con datos).
- [ ] **T5.3** Unificar forma de `custom_pass_order` y consumidores
  (`cocinaSheets.ts:128-132`). **DoD:** AC5.3.

## FASE 6 · Limpieza huérfanos (P2 · R6)
- [ ] **T6.1** Eliminar/reescribir fallback escandallo FWD-4 (`transitions:163-183`).
- [ ] **T6.2** Hojas logística usan `is_equipment`/`is_dry` (`cocinaSheets.ts`).
- [ ] **T6.3** Verificar/conectar invitados→`table_assignments` o documentar gap.

## CIERRE
- [ ] **TZ.1** `verify-erp-conectado.sh` 100% verde + 6 invariantes verdes.
- [ ] **TZ.2** Los 3 E2E existentes verdes + build producción exit 0.
- [ ] **TZ.3** Grep de duplicación en cero: `INSERT INTO {event_orders,payments,
  invoices}` y `UPDATE events SET status` solo bajo `src/lib/domain/`.
- [ ] **TZ.4** Actualizar `spec.md` §Estado → "Implementada"; commit + push `main`.

---
### Orden de ejecución recomendado para sonnet
FASE 0 → 1 → 2 → 4(T4.1-T4.3) → 3 → 5 → 4(resto) → 6 → CIERRE.
Commit por fase (o por tarea en las P0). Nunca avanzar de fase con E2E en rojo.
