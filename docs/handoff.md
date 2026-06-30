## Último agente: Claude Code
## Fecha: 30/06/2026
## Rama: main
## Último commit: (ver `git log -1`, tras este handoff)

### Qué se hizo (30/06 · Auditoría ERP + Sprint 1 Core Business)
- [x] **Auditoría ERP/CRM completa** → `docs/auditoria-erp-2026-06.md` (Gap
  Analysis con doble óptica operaciones+arquitectura; 5 ejes auditados en
  paralelo). Veredicto: back-office sólido, faltan los lazos del medio
  operativo (compromiso de inventario, compra auto, coste de personal en
  margen, disponibilidad de salón, lote→consumo APPCC) + la ruta del dinero.
- [x] **Rama huérfana `claude/event-venue-redesign-JAUif`**: analizada (sin
  ancestro común, superada por `main` en todo). El usuario aprobó borrarla,
  pero el push de borrado da **403 por política de red** del entorno → debe
  borrarla el usuario desde GitHub web / su CLI. Sigue existiendo en remoto.
- [x] **SPEC-Sprint1-CoreBusiness.md** (SDD): especificación de G1+G3,
  aprobada por el usuario (D1–D4) e **implementada**.
- [x] **G1 · Doble reserva de salón imposible a nivel BD.** Tres ubicaciones:
  Salón de Arriba, Salón de Abajo (exclusivos) y "fuera de los salones"
  (externo, no reserva). DDL nuevo en `schema.sql`: `CREATE EXTENSION
  btree_gist`, tabla `venues` (+seed 2 salones), `events.venue_id`, tabla
  `venue_bookings` con `EXCLUDE USING gist (venue_id WITH =, daterange(...)
  WITH &&)`. Dominio nuevo `domain/venueBooking.ts` (`reserveVenue`/
  `releaseVenue`/`resolveVenueId`, traduce 23P01 → 409). Interceptación:
  `acceptQuote` (rollback transaccional si choca), PUT `events/[id]` (bloqueo
  temprano al asignar `venue`), INV-1/INV-3 liberan (INV-2 mantiene hold, D1).
- [x] **G3 · Coste de personal en el P&L.** Dominio nuevo
  `domain/recalcEventLaborCost.ts`: mantiene 1 línea `cost_desglose('personal')`
  = Σ `worker_event_pay` **pagadas** (D4), idempotente. Invocado desde
  `staffing/pay` (POST/PUT/DELETE). `rentabilidad` recompone el margen real
  = `pvp − (total_cost + personal_pagado)` y expone `laborCostPaid`/
  `laborCostTotal`/`laborCostPending`/`totalCostFull`. **`events.total_cost`
  NO cambia** (sigue comida+extras, R2/Opción B → AC2.1 intacto).
- [x] Verificación: nuevo `scripts/verify-sprint1.sh` **26/26**; sin regresión
  (E2E 32/32 · RBAC 41/41 · Operativos 14/14 · ERP 17/17); build exit 0.

### Pendiente / próximos pasos sugeridos (del Gap Analysis)
- [ ] Borrar la rama remota `claude/event-venue-redesign-JAUif` (el usuario,
  por política de red del entorno).
- [ ] **UI de rentabilidad** (`rentabilidad/page.tsx`) y ficha de evento:
  mostrar la línea de personal y el margen real (el dato ya viaja en la API).
- [ ] Selector de salón (Arriba/Abajo/Externo) en la UI de evento (el backend
  `PUT {venue}` ya lo soporta).
- [ ] Siguientes gaps P0/P1 del Gap Analysis: G2 (compromiso inventario +
  compra auto), G5 (FEFO + lote→consumo en cierre), G6 (unificar doble ledger
  de stock), G8 (contrato/firma cliente), G9 (Facturae/Verifactu). G4/G15
  (TPV/KDS/pasarela) EXCLUIDOS por mandato del usuario.

### Histórico (28/06 · spec 001 cierre + sidebar)
- [x] **FASE 6 (R6) del spec 001 — limpieza de huérfanos** (commit `9ea9e24`):
  - T6.1: el fallback de escandallo en FWD-4 (`events/[id]/transitions.ts`)
    ya no hace su propio SQL ad-hoc contra `event_menu_items` (divergente de
    `events.selected_items`); delega en la fuente canónica
    `domain/generateEscandallo.ts` (la misma que usa `acceptQuote`).
  - T6.2: `cocinaSheets.ts` (hojas de carga/logística) usa
    `ingredients.is_dry`/`is_equipment` (columnas de schema que estaban sin
    usar) como fuente primaria de clasificación, con el heurístico por
    nombre/categoría como fallback solo si el ingrediente no resuelve.
  - T6.3: dos bugs reales corregidos — `assignments/auto/route.ts` filtraba
    por una columna `guests.status` que no existe (es `rsvp`, valores en
    español: `'confirmado'`); y el formulario público de invitados
    (`guest_forms`, JSONB) nunca sincronizaba con la tabla relacional
    `guests` que consume el mapa de mesas — ahora `guest-forms/route.ts`
    también upsert-ea `guests` en cada envío.
- [x] **CIERRE del spec 001 (TZ.1-TZ.4)** (commit `9ea9e24`):
  - Nuevas fuentes canónicas `domain/createInvoice.ts`,
    `domain/recordPayment.ts` y `domain/upsertEventOrderStaffing.ts`.
  - Consolidados sobre ellas los 7 handlers que violaban INV6 (INSERT
    directo a `event_orders`/`payments`/`invoices` fuera de
    `src/lib/domain/`): `invoices/route.ts`, `events/[id]/close`,
    `events/[id]/transitions` (fwd4/inv5), `payments/route.ts`,
    `payments/signal/route.ts`, `event-orders/route.ts` (ahora delega
    íntegramente en `domain/acceptQuote.ts`) y
    `event-flow/[eventId]/calculate/route.ts`.
  - Grep de duplicación a cero confirmado: `INSERT INTO
    {event_orders,payments,invoices}` y `UPDATE events SET status`, ambos
    0 coincidencias fuera de `src/lib/domain/`.
  - `specs/001-erp-conectado/spec.md` §Estado → "Implementada".
- [x] **Sidebar: opción Demo eliminada** (commit `4596278`): quitada la
  entrada "Demo" de `AdminLayout.tsx` y su permiso en `rbac.ts`
  (`NAV_ROLES.demo`); borrada `src/app/admin/demo/page.tsx` (scaffold de
  desarrollo, quedaba huérfana sin la entrada de nav). Revisado el resto
  del sidebar: ya seguía criterios ERP (Captación · Planificación · Evento
  · Cocina & Catering · Staffing · Stock & Proveedores · Finanzas ·
  Configuración) con iconos `lucide-react` en cada item — no requería
  reestructuración adicional. Confirmado que todas las páginas nuevas de
  FASE 4/5 (`ocupacion`, `rentabilidad`, `confirmacion`, `evento`) usan el
  mismo `AdminLayout` y el mismo lenguaje visual, sin divergencias de
  diseño que alinear.
- [x] Verificación completa tras cada bloque de cambios: `verify-erp-
  conectado.sh` 17/17 (las 6 invariantes en verde, INV6 incluida),
  `verify-e2e.sh` 32/32, `verify-rbac-cocina.sh` 41/41,
  `verify-operativos.sh` 14/14, build de producción exit 0. Todo verde,
  sin regresiones.

### En progreso
- [ ] Nada abierto por mi parte en este momento.

### Decisiones
- Rama única: `main` (todas las sesiones, todos los agentes).
- Handoff en `docs/handoff.md` (leer al empezar, escribir al terminar).
- Siempre `git fetch origin && git log --oneline -5 origin/main` antes de
  empezar a codificar.
- Antes de avanzar de fase/feature: 4 verify scripts (17/17, 32/32, 41/41,
  14/14) + build, todos en verde.
- Spec 001 (`specs/001-erp-conectado/`) queda íntegramente implementada y
  cerrada (FASE 0-6 + CIERRE); no quedan tareas abiertas en
  `tasks.md`.

### Pendiente
- [ ] Decidir destino de `claude/event-venue-redesign-JAUif` (borrar /
  documentar como obsoleta / nada) — pendiente de confirmación del usuario,
  sigue sin tocar.

### Observaciones
- El servidor dev local debe levantarse con `next dev` (no `next start`),
  variables de entorno en el .env de cada sesión; tras cualquier reinicio de
  postgres hay que volver a levantarlo y resembrar `eventflow_verify` con
  `schema.sql` + `scripts/verify-ejemplo-e2e.sql` antes de cada script E2E
  (cada script requiere reseed independiente). Si `DROP DATABASE` falla con
  "being accessed by other users", ejecutar antes:
  `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE
  datname='eventflow_verify' AND pid <> pg_backend_pid();`
- `domain/createInvoice.ts`/`domain/recordPayment.ts`/
  `domain/upsertEventOrderStaffing.ts` están tipadas para `PoolClient` (pg),
  pero varios call sites no-transaccionales solo tienen `Pool` (vía
  `getPool()` de `@/lib/db`); se pasa `getPool() as any` en esos casos
  (mismo patrón pragmático que ya existía en `acceptQuote`/T6.1). No hay
  rotura de tipos real porque `Pool` y `PoolClient` comparten la interfaz
  `.query()` que estas funciones usan.
