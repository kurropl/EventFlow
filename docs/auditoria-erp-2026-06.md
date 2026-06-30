# Auditoría ERP/CRM — EventFlow (J. Benítez · catering & salón de celebraciones)

**Fecha:** 30/06/2026 · **Alcance:** módulo de administración (`/admin`) como ERP+CRM integral.
**Método:** mapeo en paralelo de 5 ejes — modelo de datos (`schema.sql`, ~57 tablas + 4 vistas), superficie API (137 rutas), frontend admin (~35 paneles B2B), interconexión real (capa `src/lib/domain/`) y profundidad operativa (inventario, escandallo, staffing, APPCC). Doble perfil: **consultor de operaciones de hostelería** + **arquitecto de software**.

---

## 1. Veredicto ejecutivo

EventFlow **no es un MVP**: es un ERP de catering sorprendentemente completo en su back-office, con una **columna vertebral de escandallo (receta→ingrediente→coste) genuinamente robusta** y dos "bisagras" de negocio realmente automatizadas: **aceptar presupuesto** (`acceptQuote`) y **cerrar evento** (`close`/`fwd4`). El CRM comercial, el catálogo/ingeniería de menú, la trazabilidad/APPCC (a nivel de esquema), el staffing de extra y la facturación tienen pantalla real y CRUD funcional.

El problema **no es de silos de datos** (las claves foráneas y la lógica de explosión existen) sino de **silos de automatización**: el *medio operativo* de un negocio de celebraciones —compromiso de inventario, compra automática, coste de personal en el margen, disponibilidad del salón, trazabilidad de lote en el punto de consumo y la ruta del dinero entrante— está **manual-bajo-demanda o ausente**. Como ERP de gestión interna es sólido; como **sistema operativo del negocio de bodas** le faltan los lazos que hacen que las cosas ocurran sin que un humano pulse un botón, y le falta la pieza que ningún salón puede permitirse: **el control de disponibilidad para no doblar una fecha**.

**Madurez por dominio:**

| Dominio | Madurez | Nota |
|---|---|---|
| Escandallo / costes de comida | 🟢 Robusto | Lo mejor del sistema. Explosión, reescalado por comensales, propagación de precios, desviación teórico↔real con snapshot inmutable. |
| CRM comercial (leads/clientes/pipeline) | 🟢 Funcional | Ciclo completo con UI. Falta *ownership* comercial e historial de comunicaciones. |
| Catálogo / ingeniería de menú | 🟢 Funcional | CRUD completo, import de recetas con merma. |
| Facturación / cobros | 🟡 Funcional con huecos | Factura `F-AAAA-NNNN` canónica; sin Facturae/Verifactu ni pasarela. |
| Trazabilidad / APPCC | 🟡 Esquema excelente, runtime fino | El enlace lote→evento es **manual**; riesgo legal. |
| Inventario / compras | 🟡 Funcional pero partido | **Dos contabilidades de stock paralelas**; compras solo por botón. |
| Staffing / personal | 🟡 Ciclo completo, poco integrado | Coste laboral nunca llega al margen; auto-dimensionado frágil. |
| Reservas / disponibilidad de salón | 🔴 Ausente | No hay entidad de espacio ni bloqueo de doble reserva. |
| Ejecución en vivo (KDS / TPV) | 🔴 Ausente | Cocina = hojas estáticas; sin tiempo real ni punto de venta. |
| Ruta del dinero entrante (pasarela) | 🔴 Ausente | Los pagos se *registran*, nunca se *cobran*. |

---

## 2. Lo que está bien estructurado (fortalezas)

**Operativas (negocio):**
- **Escandallo de nivel profesional.** Explosión de receta a ingrediente escalada por comensales, coste teórico vs real con desviación congelada (`event_cost_deviations`), propagación de cambios de precio a todos los eventos abiertos con histórico. Es la base correcta para controlar el *food cost*, que es donde un catering gana o pierde dinero.
- **Trazabilidad/APPCC con modelo de datos serio:** planes, límites críticos (temp/pH/aw/tiempo), monitorización, registro de temperaturas de cámara, limpieza, homologación de proveedores y calibración de equipos. El esqueleto regulatorio está bien pensado.
- **Ciclo comercial conectado:** lead→presupuesto→aceptación dispara automáticamente orden de evento, pagos 40/60, token de cliente, escandallo, recálculo de coste, staffing y conversión del lead. Una sola transacción idempotente.
- **Staffing de extra de principio a fin:** auto-dimensionado por comensales, ofertas por WhatsApp con filtro de disponibilidad, asignaciones, nómina por evento, firma post-pago y contrato archivado.
- **Cocina venue-aware:** la guía distingue evento en local (`benitez`) vs externo y genera hojas de producción/carga/logística desde el escandallo, usando `is_dry`/`is_equipment` para clasificar.

**Arquitectura (software):**
- **Capa de dominio (`src/lib/domain/`) como fuente única** de las transacciones de negocio (`acceptQuote`, `generateEscandallo`, `recalcEventCost`, `createInvoice`, `recordPayment`, `eventState`). Patrón correcto, idempotente y recientemente consolidado (invariante: cero `INSERT` a `event_orders`/`payments`/`invoices` fuera de `domain/`).
- **Máquina de estados gobernada** (`eventState.ts::VALID_TRANSITIONS`) con transiciones auditadas en `audit_log`.
- **RBAC de doble capa** (navegación + API en `middleware.ts`) con 4 perfiles.
- **Suite de verificación E2E** real (17/17 ERP, 32/32 E2E, 41/41 RBAC, 14/14 operativos) que actúa como red de seguridad.
- Integraciones reales: email (SMTP/Resend), WhatsApp (Meta + Twilio), n8n, OCR Tesseract, IA para presupuestos, 4 crons.

---

## 3. Gap Analysis — brechas priorizadas

### 🔴 P0 · Críticos para un negocio de celebraciones

**G1 · Sin control de disponibilidad ni prevención de doble reserva del salón.**
- *Operación:* es el riesgo número uno de un salón. Hoy `events/route.ts` inserta un evento **sin ninguna comprobación de fecha/espacio**. Se pueden meter dos bodas el mismo día en Salones Benítez sin un solo aviso. El calendario solo *muestra* coincidencias como información.
- *Datos:* "venue" existe únicamente como columnas en `events` (`venue_type` benitez/externo, `location` texto libre). No hay tabla `venues`/`espacios`, ni capacidad por sala, ni `bookings`.
- *Técnico recomendado:* crear entidad `venues`(id, nombre, capacidad) y `venue_bookings`(venue_id, tsrange) con un **constraint de exclusión de PostgreSQL** (`EXCLUDE USING gist (venue_id WITH =, periodo WITH &&)`) que hace **imposible a nivel de base de datos** doblar una fecha. Validar en `acceptQuote`/creación de evento.

**G2 · El inventario no se compromete al confirmar y la compra es 100% manual.**
- *Operación:* al aceptar un presupuesto se genera el escandallo (qué se consumirá), pero **nunca se reserva ni se avisa de faltantes**. Dos eventos de la misma semana "prometen" el mismo stock sin alerta. La generación de pedidos a proveedor (`generate-order`, `auto-orders`) está implementada pero **solo se dispara con un clic**.
- *Datos:* no existe concepto de "stock comprometido/esperado"; `ingredients.quantity` solo se toca al cierre. La feature `stockWarnings` está cableada en la UI (`LeadsCRM`) y en la respuesta de FWD-3, pero **el backend nunca la rellena → feature muerta**.
- *Técnico recomendado:* (a) rellenar `stockWarnings` de verdad en `acceptQuote` llamando a la lógica de `stock/check`; (b) tabla `inventory_commitments` (event_id, ingredient_id, qty) para stock comprometido; (c) disparar `generate-order` automáticamente en FWD-3 tras X días, con flag en `business_settings`.

**G3 · El coste de personal está totalmente desconectado del margen.**
- *Operación:* `rentabilidad` calcula `margen = total_pvp − total_cost`, pero `total_cost` es **solo comida**. La nómina del evento (`worker_event_pay`) nunca entra. En una boda el personal es 25-35% del coste: **el panel de rentabilidad miente** y el dueño no puede ver el P&L real.
- *Técnico recomendado:* `recalcEventCost.ts` debe sumar `Σ worker_event_pay.total_pay` (y alquileres/logística) a un `total_cost_full`, o añadir líneas de tipo `personal` a `cost_desglose`. Es un cambio acotado en la única función escritora del coste.

**G4 · No existe la ruta del dinero entrante (sin pasarela).**
- *Operación:* `payments/signal` y `payments` solo **registran** cobros ya hechos (transferencia/efectivo). No hay forma de **cobrar la señal online** ni link de pago para el cliente. En bodas, cobrar la señal rápido cierra la venta.
- *Datos/Técnico:* cero referencias a Stripe/Redsys/TPV. Recomendado: integrar **Redsys** (estándar en España) o Stripe para la señal del 40%, con webhook que cree el `payment` y dispare FWD-3 automáticamente.

**G5 · Trazabilidad de lote manual en el punto de consumo (riesgo legal APPCC).**
- *Operación:* la pregunta que la ley exige poder responder —"¿qué lote de pollo fue a qué comensal en qué evento?"— hoy requiere **introducción a mano**. `stockDeduct.ts` descuenta un escalar `ingredients.quantity` sin registrar lote, sin FEFO, y **sin escribir en `lot_consumption` ni `traceability_log`**.
- *Técnico recomendado:* en el cierre, `stockDeduct` debe seleccionar lotes por FEFO (caducidad ascendente) desde `receiving_log` y escribir `lot_consumption`/`traceability_log` automáticamente.

### 🟡 P1 · Importantes (limitan control y escalado)

**G6 · Doble contabilidad de stock que puede divergir en silencio.** Conviven `ingredients.quantity` (+`stock_entries`) e `inventory`(+`inventory_movements`). Distintas rutas actualizan distintas tablas (`receiving` → `ingredients.quantity`; `receiving/from-order` y `lot-consumption` → `inventory`) y **nunca se reconcilian**. Es el mayor defecto de integridad. *Recomendado:* elegir UNA fuente (sugerido `inventory_movements` como ledger + vista de saldo) y que todo escriba ahí; `stockDeduct` también.

**G7 · `stockDeduct` salta todos los ledgers de movimiento y la lógica de lotes.** Ligado a G5/G6: la deducción de cierre es invisible para la auditoría de movimientos y para APPCC.

**G8 · Sin contrato ni firma del cliente.** La "confirmación" del evento es la señal, no un contrato firmado. Hay firma de nómina del trabajador pero **ninguna firma/contrato de cliente**. *Recomendado:* generación de contrato PDF desde el presupuesto + firma (link tokenizado, reutilizando el patrón `client_token`).

**G9 · Sin Facturae / Verifactu.** Contexto español: obligación de facturación electrónica/sistemas verificables. Hoy las facturas son filas con PDF base64; no hay exportación Facturae ni envío Verifactu/SII. *Recomendado:* endpoint de exportación Facturae y, a medio plazo, integración Verifactu.

**G10 · Auto-dimensionado de staffing incompleto y frágil.** En `acceptQuote` se crean camarero+cocinero+maître, pero `event-flow/calculate` (la ruta que se usa al cambiar comensales) **solo regenera la línea de camarero**: al recalcular se pierden cocineros y maître. No hay auto-línea de barman/azafata. *Recomendado:* extraer el dimensionado a `domain/` y usarlo en ambos sitios.

**G11 · Merma no entra en el coste real.** El bruto-desde-neto (`grossFromNet`) vive solo en el parser de import; el coste teórico usa cantidad neta → **infraestima el food cost real**. *Recomendado:* aplicar % de merma por ingrediente en `generateEscandallo`.

**G12 · Sin gestión de menaje/equipamiento como inventario reservado para eventos externos.** Existe `equipment` y el flag `is_equipment`, pero no hay reserva/salida/retorno/roturas de menaje ligada a la carga de un evento externo. *Operación:* en catering externo el menaje perdido/roto es coste y conflicto recurrente.

**G13 · CRM sin propietario comercial ni historial de comunicaciones.** No hay `owner_id`/`assigned_to` en leads/quotes/events (sin comisiones ni pipeline por comercial) ni timeline de interacciones (solo un campo `notes`). *Recomendado:* añadir `assigned_to` y tabla `interactions`.

**G14 · IVA como escalar único.** `iva_pct` es un solo número por evento/factura; no se puede separar comida (10%) de bebida/servicios (21%) por línea. Problema fiscal real. *Recomendado:* IVA por línea en `cost_desglose`/items de factura.

**G15 · Ejecución en vivo ausente (KDS/TPV).** Para catering puro el KDS en vivo es menos crítico que en restaurante, pero la coordinación sala↔cocina el día del evento (pases, incidencias, consumos de barra) hoy no tiene tiempo real (todo GET, ni SSE ni WebSocket) ni punto de venta. *Recomendado (medio plazo):* canal SSE para pases y un registro de consumos de barra que alimente `extra_consumptions`.

### 🟢 P2 · Cohesión y deuda técnica

- **G16 · Orquestación de cierre duplicada** en `close/route.ts` y `transitions::fwd4`, con manejo de pagos sutilmente distinto → extraer a `domain/closeEvent.ts` (igual que se hizo con `acceptQuote`).
- **G17 · Máquina de estados saltable:** `setEventStatus` escribe `events.status` sin validar `VALID_TRANSITIONS`; varias rutas la llaman directo. La gobernanza solo se cumple vía el endpoint `transitions`.
- **G18 · Redundancias de modelo:** 4 representaciones de plano de mesas (`tables`, `table_plans`, `event_floorplans`, `floor_plans`); dos sistemas de receta (`recipes/recipe_items` vs `recipe_templates`); `guest_forms`(jsonb) vs `guests`; `events.selected_items` vs `event_menu_items`; `waiters` (legacy) vs `workers`; triple alias de coste en `ingredients`. Consolidar.
- **G19 · Enlace lead↔evento por `LOWER(name)` difuso** en `transitions` (FWD-2/INV-1), frágil; `acceptQuote` ya usa la FK real `quotes.lead_id`. Unificar en la FK.
- **G20 · Dos implementaciones de freeze** de escandallo (`escandallo.ts` vs `recalcEscandallo.ts`).
- **G21 · `admins.worker_id` sin FK** a `workers` (enlace login↔trabajador sin constraint).
- **G22 · `AutomationRules` huérfano** (componente sin entrada de menú) y **bug del dispatcher** `mapa-mas` (typo) en `admin/page.tsx`.
- **G23 · Dos proveedores de WhatsApp** coexistiendo (Twilio para leads, Meta para staffing) — unificar o documentar.

---

## 4. Matriz de cobertura por capacidad de negocio

| Capacidad (negocio celebraciones) | Modelo datos | API | UI | Conectado/automático |
|---|---|---|---|---|
| CRM leads/clientes/pipeline | ✅ | ✅ | ✅ | 🟡 (sin owner/timeline) |
| Calendario / citas / prueba de menú | ✅ | ✅ | ✅ | 🟡 (prueba = solo tipo de cita) |
| **Disponibilidad / no doble-reserva** | ❌ | ❌ | ⚠️ solo muestra | 🔴 **ausente** |
| Presupuestos / aceptación | ✅ | ✅ | ✅ | 🟢 `acceptQuote` |
| Contrato / firma cliente | ❌ | ❌ | ❌ | 🔴 ausente |
| **Cobro online (pasarela)** | ❌ | ⚠️ solo registra | ✅ registra | 🔴 **ausente** |
| Catálogo / ingeniería de menú | ✅ | ✅ | ✅ | 🟢 |
| Escandallo / coste comida | ✅ | ✅ | ✅ | 🟢 robusto |
| **Coste personal en margen** | ✅ datos | ✅ | ✅ | 🔴 **desconectado** |
| Inventario / stock | ⚠️ doble | ✅ | ✅ | 🟡 partido |
| **Compra automática por demanda** | ✅ | ✅ | ✅ | 🔴 **solo manual** |
| Proveedores / cuentas a pagar | ✅ | ✅ | ✅ | 🟡 (proveedor servicio ≠ proveedor comida) |
| Cocina (guía/producción/carga) | ✅ | ✅ | ✅ | 🟢 auto desde escandallo |
| **KDS en vivo / TPV** | ❌ | ❌ | ❌ | 🔴 ausente |
| Trazabilidad / APPCC | ✅ excelente | ✅ | ✅ | 🔴 lote→evento **manual** |
| Staffing / ofertas / nómina | ✅ | ✅ | ✅ | 🟡 |
| Facturación | ✅ | ✅ | ✅ | 🟡 sin Facturae/Verifactu |
| Mapa de mesas / RSVP / dietas | ✅ | ✅ | ✅ | 🟢 |

---

## 5. Recomendaciones técnicas de cohesión (roadmap)

El sistema ya tiene el patrón arquitectónico correcto (capa `domain/` idempotente). La estrategia es **extender ese patrón a los lazos que faltan**, no reescribir.

**Fase A — Blindar el núcleo del negocio (P0):**
1. **`domain/venues` + reserva con `EXCLUDE` de Postgres** → doble-reserva imposible a nivel BD. Validar en `acceptQuote` y en creación de evento.
2. **Activar `stockWarnings` real** en `acceptQuote` + tabla `inventory_commitments` para stock comprometido.
3. **Plegar coste laboral en `recalcEventCost`** → `rentabilidad` deja de mentir.
4. **Pasarela Redsys/Stripe** para la señal, con webhook → `recordPayment` → FWD-3 automático.
5. **FEFO en `stockDeduct`** escribiendo `lot_consumption`/`traceability_log` → APPCC cerrado legalmente.

**Fase B — Unificar y dar cohesión (P1):**
6. **Un solo ledger de stock** (consolidar `ingredients.quantity` ↔ `inventory`), todo movimiento por `inventory_movements` + vista de saldo.
7. **Disparo automático de `generate-order`** en FWD-3 (con flag de configuración).
8. **Contrato + firma de cliente** reutilizando el patrón `client_token`.
9. **Exportación Facturae** (y plan Verifactu).
10. **IVA por línea** y **merma en el escandallo**.
11. **`assigned_to` + tabla `interactions`** para CRM con dueño y timeline.

**Fase C — Deuda técnica y ejecución en vivo (P2):**
12. **`domain/closeEvent.ts`** unificando `close`/`fwd4`.
13. **Forzar `VALID_TRANSITIONS`** también en `setEventStatus` (o trigger BD).
14. **Consolidar redundancias** (planos de mesa, recetas, guests, waiters).
15. **Canal SSE** para pases de cocina + registro de consumos de barra (semilla de KDS/TPV ligero).

---

## 6. Riesgos de integridad de datos (resumen técnico)

| # | Riesgo | Severidad | Origen |
|---|---|---|---|
| R1 | Doble contabilidad de stock que diverge | Alta | `ingredients.quantity` vs `inventory` |
| R2 | Deducción de cierre invisible a ledgers y lotes | Alta | `stockDeduct.ts` |
| R3 | Coste laboral fuera del margen → rentabilidad falsa | Alta | `recalcEventCost` no suma `worker_event_pay` |
| R4 | Doble reserva de salón sin constraint | Alta | `events` sin entidad de espacio |
| R5 | Estado de evento saltable sin validación | Media | `setEventStatus` |
| R6 | Enlace lead↔evento por nombre difuso | Media | `transitions` `LOWER(name)` |
| R7 | Lógica duplicada (cierre, freeze, dimensionado staffing) | Media | divergencia futura |
| R8 | FKs/uniones por texto sin constraint | Media | `table_assignments.table_id`, `supplier_orders.supplier`, `admins.worker_id` |

---

*Auditoría generada a partir del estado de `main` a 30/06/2026. Evidencia detallada por eje disponible bajo petición (modelo de datos, API, frontend, interconexión, profundidad operativa).*
