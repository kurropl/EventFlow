# SPEC · Sprint 4 — Los 14 gaps restantes del Gap Analysis

**Metodología:** SDD. Este documento describe el QUÉ, el PORQUÉ y el CÓMO. **No se ha tocado código ni base de datos** — FASE 1 (especificación), a la espera de revisión y aprobación explícita antes de implementar (FASE 3).

**Autor:** Arquitecto/Backend Senior · **Fecha:** 2026-07-01 · **Rama:** `main`
**Origen:** `docs/auditoria-erp-2026-06.md` — los 14 gaps que quedan tras los Sprints 1-3 (G1,G2,G3,G5,G6,G7,G8 resueltos; G4,G15 excluidos por mandato).
**Método de Discovery:** 6 agentes de investigación en paralelo releyeron el código ACTUAL (no la auditoría original, que tiene 3 sprints de antigüedad) para cada gap.

---

## 0. Corrección de cuenta y decisión de alcance

Son **14 gaps**, no 15 (G7 ya se resolvió de rebote en el Sprint 2 al redirigir `stockDeduct.ts` al ledger único).

**Varían en tamaño por 2 órdenes de magnitud.** Meter "arreglar un typo" y "cumplimiento Facturae/Verifactu con firma digital y homologación AEAT" en el mismo sprint sería deshonesto. Los agrupo en 3 niveles:

- **Nivel A — Arreglos mecánicos** (mismo sprint, riesgo bajo, minutos de trabajo cada uno): G19, G20, G21, G22(typo), y un bug real de G9 encontrado de paso.
- **Nivel B — Features acotadas** (mismo sprint, diseño claro, con decisiones de negocio marcadas): G10, G11, G12, G13, G16, G17(endurecimiento focalizado).
- **Nivel C — Iniciativas grandes** (NO se construyen en este sprint; se deja alcance de "fase 1" documentado para un futuro Spec dedicado): G9 (Facturae/Verifactu completo), G14 (IVA multi-tasa real), G18 (6 redundancias de modelo, cada una un mini-proyecto de por sí).

Recomiendo aprobar Nivel A + B ahora (cierra de verdad 12 de los 14) y dejar G9/G14/G18 explícitamente documentados como trabajo futuro con su primer paso ya perfilado, no como una promesa vaga.

---

# NIVEL A — Arreglos mecánicos

## A1 · G19 — Enlace lead↔evento por `LOWER(name)` difuso

**Hallazgo:** `transitions/route.ts` tiene 3 copias de un anti-patrón que `acceptQuote.ts` ya solucionó una vez (fix "T4.2", comentario literal en el código) pero que nunca se propagó aquí:
- `fwd2()` línea ~83: `UPDATE leads SET status='presupuestado' WHERE LOWER(name)=LOWER($1) AND status='nuevo'` (bind: `event.client_name`)
- `inv1()` línea ~229: mismo patrón, `status='perdido'`
- `inv2()` línea ~266: mismo patrón, `status='presupuestado'` (revertir a `'convertido'`)

**Fix:** cada handler ya tiene `event.quote_id` (viene de `SELECT * FROM events`). Sustituir el filtro `LOWER(name)=LOWER($1)` por `id = (SELECT lead_id FROM quotes WHERE id = $1)` usando `event.quote_id` — sin queries nuevas en `fwd2` (ya trae el `quote` completo), una subquery ligera en `inv1`/`inv2`.

```ts
// fwd2 — antes: WHERE LOWER(name) = LOWER($1) AND status = 'nuevo', bind [event.client_name]
// después:
await querySingle(
  `UPDATE leads SET status = 'presupuestado' WHERE id = (SELECT lead_id FROM quotes WHERE id = $1) AND status = 'nuevo'`,
  [quote.id]
);
```
Análogo en `inv1`/`inv2` usando `event.quote_id`.

**Test:** verificar que un lead con nombre distinto al `client_name` del evento (caso que el matching difuso fallaría) se sincroniza correctamente vía la FK real.

## A2 · G20 — Dos (en realidad tres) implementaciones de freeze de escandallo

**Hallazgo confirmado:** `freezeEscandallo` (`src/lib/escandallo.ts`) es estrictamente más correcta que `freezeEventEscandallo` (`src/lib/recalcEscandallo.ts`) — esta última NO consolida `actual_quantity`/`actual_cost_total` con fallback a lo teórico, NO escribe `deviation_qty`/`deviation_cost` por línea, NO fija `frozen_at`, y NO fija `closed_at` en `event_cost_deviations`. Además, `fwd4` (transitions) tiene una TERCERA implementación inline, aún más pobre (nunca toca `event_cost_deviations`).

**No requiere decisión de negocio** — es una corrección de bug, no una elección de comportamiento.

**Fix:**
1. Borrar `freezeEventEscandallo` de `recalcEscandallo.ts`.
2. `src/app/api/escandallo/event/[eventId]/route.ts` (único call site) pasa a llamar `freezeEscandallo` de `escandallo.ts`, adaptando el shape de retorno (`{estimado,real,desviacion}` en vez de `{deviationAmount,deviationPct,estimatedTotal,actualTotal}`).
3. `fwd4` en `transitions/route.ts`: sustituir el bloque inline `UPDATE event_shopping_items SET frozen=true` por una llamada a `freezeEscandallo` (esto también resuelve parte de G16 — ver más abajo).

**Test:** cerrar un evento con líneas de escandallo SIN consumo real registrado → `event_cost_deviations` debe reflejar el fallback teórico correctamente (antes con `freezeEventEscandallo` esto habría subestimado el coste real a 0/null).

## A3 · G21 — `admins.worker_id` sin FK

**Hallazgo corregido respecto a la auditoría original:** la columna NO está muerta — `/api/admin/users` la lee y escribe activamente (vincular login de cocina/camareros a su perfil de `workers`). Por tanto el añadido de la FK no es trivial-y-listo: hay que comprobar huérfanos primero.

**Fix:**
```sql
-- 1. Comprobar huérfanos (informativo, no bloqueante)
SELECT id, worker_id FROM admins WHERE worker_id IS NOT NULL AND worker_id NOT IN (SELECT id FROM workers);

-- 2. Añadir la FK sin validar de inmediato (no bloquea si hay huérfanos)
ALTER TABLE admins ADD CONSTRAINT admins_worker_id_fkey
  FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE admins VALIDATE CONSTRAINT admins_worker_id_fkey;
```
Si el paso 1 devuelve filas, se decide entonces (limpiar el dato huérfano a NULL vs conservarlo) — improbable dado el volumen de datos de verificación, pero el script de FASE 3 comprobará esto antes de validar.

## A4 · G22 (parte 1) — Bug del dispatcher `mapa-mas`

**Confirmado, verbatim, sin cambios desde la auditoría:** `src/app/admin/page.tsx` línea 89: `pathname?.includes('mapa-mas')` — la ruta real es `/admin/mapa-mesas`. "mapa-mas" NO es substring de "mapa-mesas" (mapa-m**e**sas vs mapa-m**as**), así que esta condición **nunca ha sido cierta**. Efecto práctico: el dispatcher cae al fallback `isOther` vía otra condición (mapa-mesas ya tiene su propia página standalone, `mapa-mesas/page.tsx`, según lo visto en el Sprint de sidebar) — hay que confirmar en FASE 3 que arreglar el typo no cambia comportamiento visible (si la ruta standalone ya cubre el caso, este fix es solo higiene de código muerto).

**Fix:** `pathname?.includes('mapa-mas')` → `pathname?.includes('mapa-mesas')`.

## A5 · G9 (bug suelto, NO el gap completo) — `client?.nif` inexistente en `close/route.ts`

**Hallazgo real encontrado por el agente de G9/G14, fuera del scope original de G9 pero demasiado concreto para no arreglarlo ya:** `src/app/api/events/[id]/close/route.ts` línea ~78 usa `client?.nif` — esa columna no existe en `clients` (la real es `fiscal_nif`). Esto significa que **el NIF fiscal de la factura generada en el cierre queda siempre vacío** cuando se genera por esta vía (a diferencia de `invoices/route.ts`, que sí usa `fiscal_nif` correctamente).

**Fix:** `client?.nif` → `client?.fiscal_nif` en la construcción de `createInvoice(...)`.

**Test:** cerrar un evento con un cliente con `fiscal_nif` poblado → la factura resultante debe tener `fiscal_nif` no vacío (hoy sale vacío, regresión silenciosa).

---

# NIVEL B — Features acotadas

## B1 · G10 — Auto-dimensionado de staffing incompleto y frágil

**Hallazgo confirmado y AGRAVADO respecto a la auditoría:** `event-flow/calculate` solo toca la línea `camarero`, dejando `cocinero`/`metre` obsoletos tras un cambio de comensales. Peor aún: el `ON CONFLICT DO NOTHING` de esa ruta **no tiene ninguna constraint única contra la que chocar** (`staffing_lines` no tiene `UNIQUE(event_id, role)`) — así que cada recálculo **inserta una fila `camarero` duplicada** en vez de actualizar la existente.

**Diseño:**
```sql
-- Constraint necesaria para que un upsert real sea posible, solo para líneas abiertas
-- (una línea 'filled'/'cancelled' no debe recibir un resize silencioso — decisión de
-- negocio: redimensionar solo lo que sigue 'open').
CREATE UNIQUE INDEX IF NOT EXISTS idx_staffing_lines_event_role_open
  ON staffing_lines(event_id, role) WHERE status = 'open';
```

Nuevo `src/lib/domain/staffingSizing.ts`:
```ts
export function calcCocineros(guests: number): number { return Math.ceil(guests / 30); }
export function calcMetres(guests: number): number { return Math.max(1, Math.ceil(guests / 40)); }

export async function upsertStaffingLines(
  client: Pool | PoolClient, eventId: string, guests: number, serviceType: ServiceType
): Promise<void> {
  const roles = [
    { role: 'camarero', slots: calcCamareros(guests, serviceType) },
    { role: 'cocinero', slots: calcCocineros(guests) },
    { role: 'metre', slots: calcMetres(guests) },
  ];
  for (const r of roles) {
    await client.query(
      `INSERT INTO staffing_lines (event_id, role, slots_needed, notes, status)
       VALUES ($1,$2,$3,'Auto-generado', 'open')
       ON CONFLICT (event_id, role) WHERE status = 'open'
       DO UPDATE SET slots_needed = $3`,
      [eventId, r.role, r.slots]
    );
  }
}
```
**Call sites a cambiar:** `acceptQuote.ts` (sustituye el bucle inline de 3 roles), `event-flow/[eventId]/calculate/route.ts` (sustituye el `INSERT ... camarero` suelto).

**E-B1 (decidido):** redimensionar SOLO líneas `status='open'` (la recomendada) — una línea ya `filled`/`cancelled` no se toca.

**Test:** aceptar presupuesto con 100 comensales (camarero+cocinero+metre creados), cambiar a 200 vía `/calculate`, confirmar que las 3 líneas se actualizan (no solo camarero) y que no hay duplicados.

## B2 · G12 — Sin gestión de menaje/equipamiento reservado

**Hallazgo:** `equipment_rules` YA calcula la necesidad por evento (`generateLogisticsSheet` en `cocinaSheets.ts`), pero es de solo lectura — nunca escribe una reserva, y `equipment.stock_quantity` nunca se decrementa.

**Diseño:**
```sql
CREATE TABLE IF NOT EXISTS event_equipment_checkout (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  quantity_sent NUMERIC(10,2) NOT NULL DEFAULT 0,
  quantity_returned NUMERIC(10,2),
  condition_notes TEXT,
  checked_out_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, equipment_id)
);
```
Nuevo `domain/equipmentCheckout.ts::reserveEquipmentForEvent(client, eventId)` — reutiliza el cálculo YA existente de `generateLogisticsSheet` (no lo duplica: se extrae esa función de necesidad a algo reusable, o se llama a la misma consulta). Nueva ruta `PATCH /api/cocina/equipment/checkout/[eventId]` para marcar enviado/devuelto con notas de rotura.

**E-B2 (decidido):** la reserva se dispara **automáticamente** al generar la hoja de logística (solo eventos `externo`) — sin botón manual. `generateLogisticsSheet` llama a `reserveEquipmentForEvent` como efecto secundario idempotente cada vez que se genera/regenera la hoja.

**Test:** generar hoja de logística de un evento externo → reserva creada con las cantidades calculadas automáticamente; marcar como devuelto con menos cantidad de la enviada → `condition_notes` refleja la merma.

## B3 · G11 — Merma no entra en el coste real

**Hallazgo:** la fórmula `bruto = neto / (1 − merma/100)` existe y es correcta (`recipeImport.ts::grossFromNet`), pero solo se aplica UNA VEZ al importar el CSV — el `merma_pct` se lee, se usa, y se descarta. `recipe_items.quantity` guarda el bruto ya calculado, sin dejar rastro del % usado. Si alguien edita la receta manualmente después, la merma se pierde sin que nadie lo note.

**Decisión de negocio (E-B3), la más importante de este gap:**
- **Opción A (mínima, sin migración):** añadir `recipe_items.merma_pct` solo como metadato/auditoría — se persiste desde ahora en adelante, pero `generateEscandallo.ts` no cambia (sigue usando `quantity` tal cual, que ya es bruto). Arregla la pérdida de trazabilidad hacia adelante, NO arregla el riesgo de que una edición manual futura reintroduzca un valor neto sin querer.
- **Opción B (correcta, con migración):** `recipe_items.quantity` pasa a significar SIEMPRE neto; `merma_pct` se aplica en `generateEscandallo.ts`/`recalcEscandallo.ts` en tiempo de lectura (`qtyNative = recipe_qty * raciones / (1 - merma_pct/100)`). Requiere decidir qué hacer con las filas YA existentes (su `quantity` actual es bruto de una importación pasada — ¿se re-calcula el neto con el `merma_pct` que se capture ahora con `merma_pct=0` por defecto, dejándolas como están hasta que alguien las reimporte/edite?).

**E-B3 (decidido): Opción A**, y el usuario limpiará por su cuenta los datos de receta existentes (borrado + reimportación completa desde CSV) en vez de una migración en vivo — no se construye ningún script de migración/backfill para las filas actuales. `merma_pct` simplemente empieza a persistirse en `recipe_items` desde ya para toda importación futura; las filas ya existentes se quedan con `merma_pct=0` hasta que el usuario las reimporte, lo cual es aceptable dado su plan de borrar/reimportar.

```sql
ALTER TABLE recipe_items ADD COLUMN IF NOT EXISTS merma_pct NUMERIC(5,2) NOT NULL DEFAULT 0;
ALTER TABLE recipe_item_versions ADD COLUMN IF NOT EXISTS merma_pct NUMERIC(5,2);
```
`src/app/api/cocina/recipes/import/route.ts`: persistir `line.merma_pct` en el INSERT (hoy se calcula y se tira).

**Test:** importar un CSV con `merma_%=20` → `recipe_items.merma_pct=20` persistido (hoy no se persiste nada).

## B4 · G13 — CRM sin propietario comercial ni historial

**Hallazgo:** cero columnas de ownership en todo el esquema; `leads`/`quotes` routes ni siquiera llaman a `requireAuth()` hoy (el RBAC vive solo en middleware) — hay que añadir esa capa para poder auto-rellenar `assigned_to`/`created_by`.

**E-B4 (decidido): fuente única.** `assigned_to` vive SOLO en `leads` — no se duplica en `quotes` ni `events`. La propiedad de un presupuesto/evento se **deriva** siempre a través de la cadena de FKs ya existente: `quotes.lead_id → leads.assigned_to`, y para eventos: `events.quote_id → quotes.lead_id → leads.assigned_to`. Como todo evento ya tiene un lead auto-creado/vinculado al crearse (T4.1, `LEAD_CREATED`), esta cadena cubre prácticamente todos los casos sin necesitar columnas redundantes que puedan desincronizarse.

```sql
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES admins(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);

CREATE TABLE IF NOT EXISTS interactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID REFERENCES leads(id) ON DELETE CASCADE,
  event_id    UUID REFERENCES events(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('llamada','email','whatsapp','nota','reunion')),
  notes       TEXT,
  created_by  UUID REFERENCES admins(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT interactions_target_chk CHECK (lead_id IS NOT NULL OR event_id IS NOT NULL)
);
```
`audit_log` se queda como está (ledger de transiciones de estado, inmutable) — NO se ensancha para esto, son conceptos distintos (uno es un log de sistema, el otro son notas editables de un comercial).

**Cambios de ruta:**
- `src/app/api/leads/route.ts`: GET añade filtro `?assigned_to=`; POST añade `getCurrentUser()` para auto-asignar `assigned_to` al creador si no se especifica.
- `src/app/api/quotes/route.ts`, `src/app/api/events/route.ts` (GET/list): añaden un `LEFT JOIN` a través de `lead_id`/`quote_id→lead_id` para exponer `assigned_to`/`assigned_to_name` en la respuesta, sin columna propia.
- Nueva `PATCH /api/leads/[id]/assign` (reasignar el lead — esto reasigna automáticamente todos sus presupuestos/eventos derivados, al ser fuente única).
- Nueva `POST/GET /api/interactions` (CRUD ligero, scoped por `lead_id` o `event_id`).

**Nota — esto es solo backend/API.** El "badge de propietario" y el filtro "mis leads" en `LeadsCRM.tsx`/`KanbanPipeline.tsx` son trabajo de UI, se dejan para el sprint de rediseño ya acordado; aquí solo se deja el dato servible.

**Test:** crear un lead autenticado como usuario X → `assigned_to = X.id`; el evento derivado de ese lead (vía `quote_id→lead_id`) resuelve `assigned_to=X.id` en el JOIN sin columna propia; reasignar el lead → el evento deriva el nuevo propietario automáticamente; crear una interacción → aparece en el timeline del lead.

## B5 · G16 — Orquestación de cierre duplicada + facturación parcial

**Hallazgo, más serio de lo que sugería la auditoría original:** además de la ya conocida divergencia en pagos, se confirmaron 5 diferencias más entre `close/route.ts` y `fwd4`: `fwd4` exige `payments.length > 0` (close no), solo `fwd4` actualiza `event_orders.status`, solo `fwd4` escribe `audit_log`, la fuente del `subtotal` de la factura difiere (`event.total_pvp` vs `order.confirmed_price ?? event.total_pvp`), y `fwd4` nunca llamaba a la implementación correcta de freeze (arreglado en A2).

**E-B5 (decidido) — ni "forzar todo" ni "solo lo cobrado": facturación parcial explícita.** Tu requisito va más allá de las dos opciones que planteé: de un evento de 2000€, debe poder facturarse solo 1000€ (lo realmente cobrado), quedando los otros 1000€ pendientes de cobro manual — y facturables MÁS TARDE en una segunda factura cuando se cobren. Esto descarta ambos comportamientos actuales (`fwd4` fuerza el 100%; `close/route.ts` solo permite UNA factura por evento, nunca una segunda parcial posterior) y añade una capacidad nueva: **facturación incremental**.

**Diseño:**

1. **`domain/closeEvent.ts`** — nunca fuerza pagos. El cierre (freeze/stock/estado/`audit_log`) siempre ocurre igual; la factura generada AL CERRAR es la primera factura parcial, por el importe indicado (o por defecto, lo ya marcado `paid=true`, igual que hace hoy `close/route.ts`):
```ts
export async function closeEvent(
  eventId: string,
  opts: { invoiceAmount?: number; motivo?: string }
): Promise<{ event: any; effects: string[] }> {
  // freeze vía freezeEscandallo (canónica, A2) → event_orders.status='completed' (siempre) →
  // NUNCA fuerza payments.paid → factura por opts.invoiceAmount ?? Σ(payments.paid=true) →
  // stock (deductStockForEvent) → audit_log (siempre) → event → 'completed'
}
```
2. **Relajar la idempotencia de facturación** — hoy `invoices/route.ts` bloquea con "ya existe factura" si hay CUALQUIER factura para el `event_order_id`. Pasa a permitir varias facturas por evento mientras la suma de sus `subtotal` (no canceladas) no supere `order.confirmed_price` (control de sanidad, no bloqueo duro — un exceso solo genera un aviso, nunca un error, por si hay recargos legítimos).
3. **Nueva ruta manual reutilizable** `POST /api/events/[id]/invoice` (mismo patrón que `POST /api/events/[id]/contract/generate` del Sprint 3 — botón admin, invocable varias veces): body `{ amount }`, llama a `createInvoice` con ese importe como `subtotal`. Funciona tanto en un evento recién cerrado como en uno cerrado hace tiempo (para facturar el resto cuando se cobre).
4. El importe NO facturado se queda como `payments` sin marcar `paid` — se marcan manualmente más tarde vía la ruta YA existente `PATCH /api/payments/[id]`, sin cambios ahí.
5. `close/route.ts` y `fwd4` pasan a ser wrappers finos sobre `closeEvent(eventId, { invoiceAmount, motivo })`, adaptando solo la forma de la respuesta HTTP (`results` vs `effects`).

**Test:** cerrar un evento de 2000€ indicando `invoiceAmount=1000` → 1 factura por 1000€, `payments` con 1000€ aún sin marcar `paid`; marcar esos 1000€ como pagados manualmente vía `PATCH /api/payments/[id]`; llamar `POST /api/events/[id]/invoice {amount:1000}` → 2ª factura por los otros 1000€, ambas facturas suman el total del evento.

## B6 · G17 — Endurecimiento focalizado (no la reforma completa)

**Hallazgo:** 17 puntos de escritura de `events.status`, la mayoría gobernados correctamente (dentro de `transitions/route.ts`, protegidos por `assertTransition` en el dispatcher). Pero **2 son genuinamente peligrosos**:
- `PUT /api/events/[id]` (`events/[id]/route.ts` línea ~224): acepta `status` del body **sin validar el valor en absoluto** — cualquier string, cualquier transición, sin excepciones.
- `src/lib/automation.ts` línea ~273: las reglas de automatización configurables por el admin pueden fijar `events.status` a cualquier string configurado, sin ejecutar ninguno de los efectos de negocio asociados (factura, stock, etc.).

Y 2 más que crean estados fantasma no representados en `VALID_TRANSITIONS` en absoluto: `presupuestado` (vía `payments/signal/route.ts`) y `paid` (vía `invoices/[id]/route.ts`).

**E-B6 (decidido): el alcance acotado recomendado.**
1. **Whitelist mínima** en los 2 puntos peligrosos: `events/[id]/route.ts` y `automation.ts` solo aceptan `status` si pertenece a un conjunto cerrado de valores válidos (`draft,sent,accepted,presupuestado,completed,lost,cancelled,reopened,paid`) — no elimina el bypass de gobernanza, pero elimina el riesgo de typos/estados inventados.
2. **Documentar** `presupuestado`/`paid` como transiciones reales añadiendo entradas a `VALID_TRANSITIONS` (sin cambiar su comportamiento, solo haciéndolas visibles/auditables): `PAY-1: accepted→presupuestado`, `PAY-2: completed→paid`.

**Diferido explícitamente (Nivel C dentro de G17):** migrar `setEventStatus` para exigir `transitionCode` en todos los 17 call sites, y migrar `send-budget/route.ts`/`quotes/public/[id]/reject/route.ts`/`event-orders/[id]/route.ts` a delegar en la lógica gobernada — esto es una reforma arquitectónica real que merece su propio ciclo de Spec, no una línea más en este documento.

**Test:** `PUT /api/events/[id] {"status":"cualquier-cosa-inventada"}` → rechazado (hoy se acepta sin más).

---

# NIVEL C — Grandes iniciativas (NO se construyen ahora — alcance documentado)

## C1 · G9 — Facturae / Verifactu

Cumplimiento fiscal español real requiere: (a) direcciones fiscales estructuradas (hoy `address`/`fiscal_address` son texto libre, Facturae exige Provincia/CP/Población/País desglosados), (b) líneas de factura persistidas de forma inmutable (hoy solo hay totales agregados — no existe una tabla `invoice_lines`), (c) firma digital XAdES con certificado cualificado (cero librerías de firma XML en el proyecto hoy), (d) para Verifactu específicamente: encadenado por hash + envío a la AEAT (integración externa con certificado, fuera del alcance de cualquier sprint de desarrollo normal).

**Primer paso realista, si se decide abordar esto en un futuro Spec dedicado:** un endpoint `GET /api/invoices/[id]/facturae.xml` que genere un XML con la forma correcta de Facturae 3.2.x **sin firma** (claramente marcado como no válido para envío oficial, solo para archivo/revisión manual) — deja la firma XAdES y la integración AEAT como fases 2/3 separadas, con sus propios plazos legales (Real Decreto 1007/2023, mediados/finales de 2026).

## C2 · G14 — IVA multi-tasa real

Entrelazado con G9 (el desglose de tasas de Facturae necesita esto). El hallazgo clave: **no basta con añadir una columna `iva_pct` a `cost_desglose`/`event_shopping_items`** (son tablas de coste interno, no de facturación al cliente) — el primer paso correcto es `catalog_items.iva_pct` (10% por defecto, override a 21% para bebidas alcohólicas — hoy `bebida` mezcla agua/refrescos con vino/cerveza sin ningún campo que los distinga) y llevarlo a las líneas de presupuesto/factura, con `createInvoice` reestructurado para sumar por tasa distinta. Esto toca ~8 sitios de código (ver informe del agente) y depende de resolver primero la falta de tabla de líneas de factura de C1(b) — por eso lo trato junto a G9 como una iniciativa conjunta futura, no aislada.

## C3 · G18 — Redundancias de modelo (6 sub-ítems, cada uno un mini-proyecto)

Confirmado que persisten las 6 redundancias, y una (los planos de mesa) resultó ser **peor** de lo que decía la auditoría: son 4 tablas distintas (`tables`, `table_plans`, `event_floorplans`, `floor_plans`), no 2, con `/api/plans` incluso trayendo su propio `schema.sql` separado — señal de un subsistema añadido por separado sin integrar. Cada consolidación (planos de mesa, sistemas de receta, `guest_forms` vs `guests`, `selected_items` vs `event_menu_items`, `waiters` vs `workers` — este último confirmado NO muerto, tiene ruta CRUD mantenida activamente —, y el triple alias de coste) toca funcionalidad real usada hoy por el mapa de mesas, la cocina y el staffing. Fusionarlas sin cuidado arriesga romper flujos en producción. Recomiendo: NO tocar en este sprint; abordar de una en una, cada una con su propio Spec y su propia batería de regresión, cuando haya presupuesto de tiempo dedicado.

## G23 — Dos proveedores de WhatsApp (NO es un bug, solo documentación)

El agente confirmó que Twilio (captación pública de leads, solo entrante) y Meta Cloud API (staffing interno, entrante+saliente) cubren flujos genuinamente distintos, con modelos de confianza distintos (público anónimo vs. interno autenticado). **No recomiendo consolidar** — sería una re-arquitectura sin ningún bug que la motive. Se deja documentado en el handoff como decisión de arquitectura intencional, no como deuda técnica.

---

## Resumen de cambios (Nivel A + B, para la FASE 3)

| Tipo | Fichero | Cambio |
|---|---|---|
| Ruta (edit) | `src/app/api/events/[id]/transitions/route.ts` | A1 (lead vía FK), A2 (freeze canónica en fwd4), B5 (delega en closeEvent) |
| Lib (edit) | `src/lib/recalcEscandallo.ts` | A2: borrar `freezeEventEscandallo` |
| Ruta (edit) | `src/app/api/escandallo/event/[eventId]/route.ts` | A2: llamar a `freezeEscandallo` |
| DDL | `schema.sql` | A3 (FK worker_id), B1 (índice único staffing_lines), B2 (tabla event_equipment_checkout), B3 (merma_pct), B4 (assigned_to solo en leads + tabla interactions), B6 (VALID_TRANSITIONS entries) |
| Frontend (edit) | `src/app/admin/page.tsx` | A4: typo mapa-mas |
| Ruta (edit) | `src/app/api/events/[id]/close/route.ts` | A5 (fiscal_nif), B5 (delega en closeEvent) |
| Dominio (nuevo) | `src/lib/domain/staffingSizing.ts` | B1 |
| Dominio (edit) | `src/lib/domain/acceptQuote.ts` | B1 (usa staffingSizing) |
| Ruta (edit) | `src/app/api/event-flow/[eventId]/calculate/route.ts` | B1 |
| Dominio (nuevo) | `src/lib/domain/equipmentCheckout.ts` | B2 |
| Ruta (nueva) | `src/app/api/cocina/equipment/checkout/[eventId]/route.ts` | B2 |
| Ruta (edit) | `src/app/api/cocina/recipes/import/route.ts` | B3 (persistir merma_pct) |
| Ruta (edit) | `src/app/api/leads/route.ts` | B4 (assigned_to propio + requireAuth) |
| Ruta (edit) | `src/app/api/quotes/route.ts`, `src/app/api/events/route.ts` | B4 (assigned_to derivado por JOIN, sin columna propia) |
| Ruta (nueva) | `src/app/api/leads/[id]/assign/route.ts`, `src/app/api/interactions/route.ts` | B4 |
| Dominio (nuevo) | `src/lib/domain/closeEvent.ts` | B5 |
| Ruta (nueva) | `src/app/api/events/[id]/invoice/route.ts` | B5 (facturación parcial reutilizable) |
| Ruta (edit) | `src/app/api/invoices/route.ts` | B5 (relaja idempotencia: varias facturas por evento) |
| Ruta (edit) | `src/app/api/events/[id]/route.ts`, `src/lib/automation.ts` | B6 (whitelist de status) |
| Test (nuevo) | `scripts/verify-sprint4.sh` | AC-A1..A5 + AC-B1..B6 |

## Plan de validación (FASE 3, tras aprobación)
1. Nivel A primero (bajo riesgo) → punto de control/commit.
2. Nivel B por partes, cada gap con su propio punto de control (staffing → equipamiento → merma → CRM → cierre unificado → estado) para poder cortar limpio si hace falta.
3. `npm run build` + `verify-sprint4.sh` + regresión completa de las 7 suites previas en cada punto de control.
4. Documentar C1/C2/C3/G23 en `docs/handoff.md` como backlog explícito con su primer paso ya perfilado (no una promesa vaga).

## Decisiones — RESUELTAS por el usuario (E-B1 a E-B6)

- **E-B1** ✅ Solo líneas `status='open'` se redimensionan.
- **E-B2** ✅ Reserva de equipamiento automática al generar la hoja de logística (eventos externos).
- **E-B3** ✅ Opción A (solo persistir `merma_pct` desde ahora); el usuario reimportará los datos de receta existentes por su cuenta, sin migración/backfill.
- **E-B4** ✅ Fuente única: `assigned_to` vive solo en `leads`; presupuestos/eventos lo derivan por join a través de `lead_id`.
- **E-B5** ✅ Facturación parcial explícita: ni forzar el 100% ni bloquear a una sola factura — importe indicado + segunda factura posterior para el resto, vía nueva ruta manual reutilizable.
- **E-B6** ✅ Alcance acotado (whitelist + documentar transiciones fantasma), reforma completa diferida.

---

**FIN DEL SPEC — SPEC Aprobado (todas las decisiones resueltas). Pasando a FASE 3 (implementación).**
