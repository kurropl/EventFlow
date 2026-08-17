# CHANGELOG — Olas de implementación (EventFlow)

Registro de Work Packages merged y su estado de aceptación.
Fuente de verdad del proceso: `docs/EventFlow-Spec-Agentes.md`.

---

## Ola 7 — Portal de Cliente y cierre (WPs 25–31)

| WP | Descripción | Estado | Aceptación |
|----|-------------|--------|------------|
| WP-25 | Portal infraestructura (token auth) | ✅ merged | build + tests |
| WP-26 | Invitados/RSVP (CRUD, CSV, UI) | ✅ merged | build + tests |
| WP-27 | Distribución de mesas | ✅ merged | build + tests |
| WP-28 | Menú y variantes por invitado | ⚠️ API + tests merged; UI portal menú completada en WP-SEED-01 | build |
| WP-29 | Extras y decoración | ✅ merged | build + tests |
| WP-30 | Mensajería CRM | ✅ merged | build + tests |
| WP-31 | Congelación y cadena operativa | ✅ merged | build + tests |

## Ola 6 — Finanzas por hitos (WPs 21–24)

| WP | Descripción | Estado | Aceptación |
|----|-------------|--------|------------|
| WP-21 | Planes de pago | ✅ merged | build + tests |
| WP-22 | Señal pagada (deposit.paid) | ✅ migración + handler merged | outbox validado en WP-SEED-01 |
| WP-23 | Facturación por hitos | ✅ merged | build + tests |
| WP-24 | Cierre económico | ✅ merged | build + tests |

## WPs de infraestructura (WPs 01–20)

| WP | Descripción | Estado |
|----|-------------|--------|
| WP-01..05 | Modelo sanitizado (unidades, stock, FK, outbox, escandallo) | ✅ merged |
| WP-06..10 | Ciclo de compras + trazabilidad | ✅ merged |
| WP-11..14 | Catálogo de menús | ✅ merged |
| WP-15..20 | Orquestación de eventos | ✅ merged |

## Fixes estructurales

### WP-FIX-01 — Restaurar integración del módulo Cocina (2026-08-01)
- **Problema**: `src/app/admin/cocina/layout.tsx` (introducido en merge WP-28)
  renderizaba pills propias sin `<AdminLayout>` → /admin/cocina/* perdía el
  sidebar global.
- **Fix**: layout reducido a wrapper de AdminLayout; subapartados de Cocina
  (Panel, Recetas, Escandallos, Producción, Carga, Logística, APPCC, Compras)
  como children del sidebar; rbac.ts restaurado a la matriz de 7 roles (NR-3)
  que se perdió en los merges (44 tests RBAC, antes 38 fallaban).
- **Nuevo**: página `/admin/cocina/compras` (WP-06 órdenes de compra).
- **Test**: `tests/cocina-navigation.spec.ts` — 9/9 verdes.
- **Extra build**: fixes de ruta `[eventId]`→`[id]`, firma params Route
  Handlers, `QueryResult.rows`, `setFont` jspdf, `guests.name`,
  `units-pure.ts` (sin pg en cliente).

### WP-SEED-01 — Reset controlado y dataset semilla de trazabilidad (2026-08-01)
- **Script**: `scripts/reset-and-seed.mjs` — salvaguardas (variable de
  entorno + bloqueo host producción + pg_dump a `backups/` + TRUNCATE
  explícito conservando admins).
- **Dataset determinista** que ejercita la cadena completa:
  unidades → receta → menú → evento → escandallo → OC → recepción APPCC
  con lote → plan de pagos → señal → portal → cierre.
- **Outbox validado**: el portal lo crea el handler `deposit.paid` REAL
  (el seed emite el evento y ejecuta el handler compilado; no simula).
- **Verificaciones**: escandallo 220 €, OC ternera 5.000 g recibida,
  lote LOT-SEED-001 con proveedor/APPCC/evento, hitos 2.000/3.000,
  evento confirmado + deposit.paid, portal con 12 invitados y variante
  celíaca, stock ternera 15.000 g, turnos confirmados.
- **Idempotencia**: 2 ejecuciones seguidas dejan el mismo estado.
- **Test**: `tests/traceability-seed.spec.ts` — 3/3 verdes.
- **Extra**: UI del portal menu implementada (WP-28 quedó con placeholder).

### COCINA-V3-F1F2 — Estabilización + modelo stock/cierre (2026-08-17)
- Fixes 500: production/logistics/service-sheet (esi.category → catalog_items),
  guia (service_type → event_type). Eliminada dependencia de service_type en
  7 archivos (acceptQuote, cocinaGuia, serviceSheet, briefingMemo, packs,
  portal-freeze, event-flow, generate-operations).
- ALTERs de esquema faltantes en prod: location, venue_pdf_url, is_dry,
  is_equipment. Migración consolidada 033.
- Seed kitchen_zones (9 zonas, iconos Phosphor), migración 034.
- API y panel informativo de disponibilidad por escandallo (necesario vs
  stock vs comprometido, con margen seguridad). FROZEN intacto.
- Datos maestros proveedor×ingrediente (migración 035 + API CRUD) con
  redondeo a unidad de compra.
- Propuesta de OC con HITL: API necesidades, propuesta-oc, transiciones
  de estado (enviar/confirmar/recibir/cancelar).
- Regularizaciones de inventario (migración 036 + API).
- Decisión técnica: enum supplier_orders conservado
  (pending/approved/delivered/received/partial/cancelled) — no se renombra
  por compatibilidad; mapeo documentado en la UI.
- 17/17 rutas cocina 200, 16/19 E2E (3 seed con túnel local caído).
- 12 commits en rama kurropl/cocina-v3-f1f2.

- **Método**: aplicadas las skills instaladas (verification-before-completion,
  diagnosing-bugs, code-review) a todo el código mergeado de los worktrees.
- **Smoke test de 70 rutas API contra prod**: 6 errores 500 → 0 corregidos.
- **Migración 2026-08-04-audit-tablas-faltantes.sql** (aditiva, idempotente):
  crea las 6 tablas que el código usaba pero NO existían en prod
  (venues + seed de 2 salones, venue_bookings, inventory_commitments,
  event_contracts, briefing_send_log, menu_cost_alerts, provider_invoices)
  + extension btree_gist + events.venue_id + events.venue_type.
- **ALTERs aditivos en prod**: payment_plans.status/updated_at,
  payment_milestones.pct/last_reminder_at, admins.worker_id.
- **Fixes de query**: workers 'role'→'roles'; event-orders
  'e.service_type'→'e.venue_type'.
- **Fixes de UI (React 423)**: toFixed() sobre strings de pg en
  TrazabilidadPanel (formatTemp), CatalogCRUD (avgMargin), MenusManager
  (price/cost/margin), OCRScanner (item.cost), StockManager
  (old/new_price) → Number() defensivo.
- **WP-06 no mergeable tal cual**: crea purchase_orders paralelo a
  supplier_orders ya integrado en main (la UI /admin/cocina/compras usa
  supplier_orders). Se documenta sin mergear.
- **Verificación final**: 18/18 tests E2E, 51/51 unitarios, 0 errores 500
  en smoke, dashboard seed sin errores de consola.

### ESCANDALLOS-CONGELADO — Módulo de escandallos FROZEN (2026-08-04)
- **Decisión de usuario**: la parte de escandallos queda EDITABLE y se
  declara CONGELADA — no se tocará más en ninguna iteración.
- **Funcionalidad final (cerrada)**:
  - Página `/admin/cocina/escandallos`: selección de evento, KPIs,
    tabla de ingredientes × pax, motor de bebidas, panel Margen/PVP.
  - **Edición inline**: botón Editar → inputs de cantidad, unidad
    (kg/g/l/ml/ud/doc) y coste unitario con previsualización de coste
    total (cantidad × coste unitario) y total de líneas; Guardar/Cancelar.
  - PUT `/api/cocina/escandallos/[escandalloId]/lines`: actualiza líneas
    en transacción y recalcula `cost_total` por línea + `total_cost` y
    `cost_per_pax` del escandallo (pax del evento).
  - Cantidades humanizadas (g→kg, ml→l) solo en presentación.
- **Verificación**: edición probada en prod (20→25 kg HARINA: total
  1.454,79→1.459,94 €, persistido y restaurado), 19/19 E2E verdes.
- **⚠️ FROZEN**: cualquier cambio futuro en escandallos requiere
  autorización explícita del usuario. Archivos cubiertos:
  `src/app/admin/cocina/escandallos/page.tsx`,
  `src/app/api/cocina/escandallos/route.ts`,
  `src/app/api/cocina/escandallos/[escandalloId]/lines/route.ts`,
  `src/lib/units-pure.ts` (humanizeUnit).
