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
