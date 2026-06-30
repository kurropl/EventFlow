# SPEC · Sprint 1 — Core Business (G1 + G3)

**Metodología:** SDD (Spec-Driven Development). Este documento describe el QUÉ, el PORQUÉ y el CÓMO exacto. **No se ha tocado ni código ni base de datos todavía** — esta es la FASE 1 (especificación) y queda a la espera de aprobación explícita ("SPEC Aprobado") antes de implementar.

**Estado:** ✅ Implementada (FASE 3 completada 2026-06-30). Verificación:
`verify-sprint1.sh` 26/26 · sin regresión (E2E 32/32 · RBAC 41/41 · Operativos
14/14 · ERP 17/17) · build de producción exit 0. Decisiones aplicadas:
**D1** INV-2 mantiene el hold (solo INV-1/INV-3 liberan); **D2** día completo;
**D3** clave de API `venue` (slug); **D4** el margen cuenta solo nóminas
pagadas, reflejando además el total asignado (`laborCostTotal`/`Pending`).

**Autor:** Arquitecto/Backend Senior · **Fecha:** 2026-06-30 · **Rama:** `main`
**Origen:** `docs/auditoria-erp-2026-06.md` (Gap Analysis).
**Alcance EXCLUSIVO de este Sprint:**
- **G1** — Prevención de doble reserva de salón mediante constraint de exclusión en PostgreSQL.
- **G3** — Inclusión del coste `worker_event_pay` (personal) en la rentabilidad/P&L.

**Fuera de alcance (excluido por mandato):** G4 (pasarela/cobro online), G15 (KDS/TPV), y cualquier flujo de cobro automático. No se mencionan ni se diseñan aquí.

---

## 0. Contexto del dominio (dato de negocio incorporado)

Los eventos ocurren en **tres ubicaciones**:
1. **Salón de Arriba** — recurso físico propio, **exclusivo** (un evento por día).
2. **Salón de Abajo** — recurso físico propio, **exclusivo** (un evento por día).
3. **Fuera de los salones** (externo) — en la ubicación del cliente; **NO es exclusivo** (puede haber varios eventos externos el mismo día sin conflicto).

Por tanto la regla de no-solapamiento aplica **solo a los dos salones físicos**. Los eventos externos no reservan recurso y nunca colisionan.

### Restricciones de compatibilidad detectadas (no romper)
- `events.venue_type TEXT CHECK (venue_type IN ('benitez','externo'))` lo usa el **módulo Cocina** para decidir si aplica la fase de CARGA/logística. Los verify scripts (`verify-rbac-cocina.sh`, `verify-operativos.sh`) hacen `PUT /api/events/:id {"venue_type":"benitez"|"externo"}` y dependen de ese campo. → **`venue_type` se conserva intacto.** La reserva NO se ata a `venue_type` sino a un **`venue_id` explícito** (qué salón). Los tests actuales nunca asignan `venue_id`, así que no crean reservas y permanecen verdes.
- `events.total_cost` es la **fuente única de coste** (Spec 001, R2/Opción B): `Σ event_shopping_items.estimated_cost (no congeladas) + Σ cost_desglose(line_type='extras')`. El invariante **AC2.1** (`verify-erp-conectado.sh:60-61`) afirma `total_cost == Σ estimated_cost`. → **`total_cost` NO cambia de semántica.** El coste de personal se trata como una dimensión separada del P&L; nunca se inyecta en `total_cost`.
- `cost_desglose.line_type` ya admite `'personal'` en su CHECK (`schema.sql:84`). `recalcEventCost` solo suma `'extras'` (`recalcEventCost.ts:30-31`), así que escribir líneas `'personal'` **no contamina** `total_cost`.

---

# G1 · Prevención de doble reserva de salón

## G1.1 · SQL DDL

Se añade al final de `schema.sql` (bloque idempotente, estilo del resto del fichero).

```sql
-- ============================================================
-- SPRINT 1 · G1 — Reserva de salón con exclusión a nivel BD
-- ============================================================

-- btree_gist habilita el operador de igualdad (=) sobre tipos escalares
-- (uuid) dentro de un índice GiST, necesario para combinar `venue_id WITH =`
-- y `daterange WITH &&` en el mismo constraint EXCLUDE.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Catálogo de espacios reservables. Solo los salones físicos viven aquí.
-- "Fuera de los salones" NO tiene fila: un evento externo lleva venue_id = NULL.
CREATE TABLE IF NOT EXISTS venues (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug        TEXT NOT NULL UNIQUE,          -- 'salon-arriba' | 'salon-abajo'
    name        TEXT NOT NULL,                 -- 'Salón de Arriba' | 'Salón de Abajo'
    capacity    INT,                           -- aforo (informativo, opcional)
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed idempotente de los dos salones (NO se siembra "externo").
INSERT INTO venues (slug, name, capacity) VALUES
    ('salon-arriba', 'Salón de Arriba', 180),
    ('salon-abajo',  'Salón de Abajo',  120)
ON CONFLICT (slug) DO NOTHING;

-- Vínculo evento → salón concreto. NULL = evento externo (sin recurso exclusivo).
-- Se conserva venue_type (benitez/externo) para Cocina; venue_id lo refina.
ALTER TABLE events
    ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES venues(id) ON DELETE SET NULL;

-- Reservas: 1 fila por evento con salón asignado. La exclusión impide que
-- dos reservas del MISMO salón solapen el MISMO día (granularidad = día,
-- porque events.event_date es DATE; el rango [fecha, fecha+1) deja la puerta
-- abierta a granularidad horaria futura sin cambiar el constraint).
CREATE TABLE IF NOT EXISTS venue_bookings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id    UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    event_id    UUID NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
    event_date  DATE NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- ★ El corazón de G1: imposible a nivel de motor solapar salón+fecha.
    CONSTRAINT venue_bookings_no_overlap
        EXCLUDE USING gist (
            venue_id WITH =,
            daterange(event_date, event_date + 1) WITH &&
        )
);

CREATE INDEX IF NOT EXISTS idx_venue_bookings_event ON venue_bookings(event_id);
CREATE INDEX IF NOT EXISTS idx_venue_bookings_venue_date ON venue_bookings(venue_id, event_date);
```

**Notas de diseño:**
- `event_id UNIQUE` → un evento tiene como mucho una reserva; permite *upsert* idempotente por `event_id`.
- `ON DELETE CASCADE` desde `events`/`venues` → borrar un evento o un salón limpia su reserva.
- La exclusión **no** colisiona una fila consigo misma (Postgres excluye el propio `id`), así que re-reservar el mismo evento/salón/fecha es no-op seguro.
- Un evento **externo** (`venue_id = NULL`) **nunca** entra en `venue_bookings` → sin restricción, varios externos el mismo día conviven.

## G1.2 · Domain Logic

Nuevo fichero **`src/lib/domain/venueBooking.ts`** (fuente única de escritura de reservas, coherente con el patrón `domain/`):

```ts
/**
 * EventFlow — Dominio: reserva de salón (Spec Sprint 1, G1)
 * Única implementación de "reservar/liberar un salón". La garantía dura
 * vive en el constraint EXCLUDE de venue_bookings; aquí se traduce la
 * violación 23P01 a un error de negocio legible e idempotente.
 */
import type { PoolClient } from 'pg';
import { getPool } from '@/lib/db';

export class VenueConflictError extends Error {
  status = 409;
  constructor(msg = 'El salón ya está reservado para esa fecha') { super(msg); }
}

/** Reserva (idempotente) el salón `venueId` para `eventId` en `eventDate`.
 *  No-op si el evento no tiene salón (externo). Lanza VenueConflictError (409)
 *  si otro evento ya ocupa ese salón ese día. */
export async function reserveVenue(
  client: PoolClient,
  eventId: string,
  venueId: string | null,
  eventDate: string
): Promise<void> {
  if (!venueId) { await releaseVenue(client, eventId); return; } // externo → sin reserva
  try {
    await client.query(
      `INSERT INTO venue_bookings (venue_id, event_id, event_date)
       VALUES ($1, $2, $3::date)
       ON CONFLICT (event_id)
       DO UPDATE SET venue_id = EXCLUDED.venue_id, event_date = EXCLUDED.event_date`,
      [venueId, eventId, eventDate]
    );
  } catch (e: any) {
    if (e?.code === '23P01') throw new VenueConflictError();  // exclusion_violation
    throw e;
  }
}

/** Libera la reserva de un evento (idempotente: no falla si no existía). */
export async function releaseVenue(client: PoolClient, eventId: string): Promise<void> {
  await client.query(`DELETE FROM venue_bookings WHERE event_id = $1`, [eventId]);
}

/** Resuelve un slug ('salon-arriba'|'salon-abajo') a su venue_id, o null. */
export async function resolveVenueId(
  client: PoolClient, slug: string | null | undefined
): Promise<string | null> {
  if (!slug || slug === 'externo') return null;
  const r = await client.query(`SELECT id FROM venues WHERE slug = $1 AND active = true`, [slug]);
  return r.rows[0]?.id ?? null;
}
```

### Puntos de interceptación (3 capas)

**Capa 0 (garantía absoluta):** el constraint `EXCLUDE` — imposible solapar aunque el código falle.

**Capa 1 — `src/lib/domain/acceptQuote.ts` (la bisagra de compromiso).**
Tras el bloque de `client_token` y **antes** de `setEventStatus(... 'accepted')` (actualmente línea 177), insertar:

```ts
    // G1 (Sprint 1): al confirmar el evento, su salón queda reservado.
    // Si el evento es externo (venue_id NULL) es no-op. Si el salón ya está
    // ocupado ese día, la transacción aborta con VenueConflictError (409).
    await reserveVenue(client, eventId, event.venue_id ?? null,
      (event.event_date instanceof Date
        ? event.event_date.toISOString().slice(0, 10)
        : String(event.event_date).slice(0, 10)));
```
- `event` ya está cargado (línea 138, `SELECT * FROM events`), así que `event.venue_id` y `event.event_date` están disponibles.
- Import a añadir (cabecera): `import { reserveVenue } from './venueBooking';`
- Como `acceptQuote` corre dentro de `transaction(...)`, un conflicto revierte TODO (orden, pagos, escandallo…) — no se confirma un evento que no puede ocupar su salón. El error 409 se propaga a los tres callers (`quotes/[id]`, `quotes/public/[id]/accept`, `transitions::fwd3`), que ya saben mapear `AcceptQuoteError.status`; se añadirá un `catch` para `VenueConflictError` análogo.

**Capa 2 — `src/app/api/events/[id]/route.ts` (PUT, asignación temprana del salón).**
Cuando el body trae `venue` (slug) o cambia `event_date`, reservar/liberar **en el momento de asignar**, para bloquear antes incluso de aceptar el presupuesto:

```ts
    // G1: asignación/cambio de salón o fecha → re-sincroniza la reserva.
    if (body.venue !== undefined || body.venue_id !== undefined || body.event_date !== undefined) {
      const venueId = body.venue_id !== undefined
        ? body.venue_id
        : await resolveVenueId(getPool() as any, body.venue);
      const evDate = body.event_date ?? current.event_date;
      await reserveVenue(getPool() as any, eventId, venueId,
        String(evDate).slice(0, 10));
      // Mantener venue_type coherente para Cocina: con salón → 'benitez', sin → 'externo'.
      await querySingle(`UPDATE events SET venue_id = $1,
        venue_type = CASE WHEN $1 IS NULL THEN 'externo' ELSE 'benitez' END
        WHERE id = $2`, [venueId, eventId]);
    }
```
- **Importante para no romper E2E:** los tests hacen `PUT {"venue_type":"benitez"}` / `{"venue_type":"externo"}` **sin** `venue`/`venue_id`/`event_date` → el bloque NO se ejecuta (la condición es falsa), y el `venue_type` se sigue actualizando por la ruta PUT existente. Cero impacto en `verify-rbac-cocina.sh`/`verify-operativos.sh`.

**Capa 3 — `src/app/api/events/[id]/transitions/route.ts` (liberar al perder/cancelar).**
- En **`inv1`** (sent → lost, línea ~220) y **`inv3`** (accepted → cancelled, línea ~276), añadir antes del `audit(...)`:
  ```ts
  await releaseVenue(getPool() as any, event.id);  // G1: el salón vuelve a estar libre
  ```
  Import: `import { releaseVenue } from '@/lib/domain/venueBooking';`
- **Decisión para tu revisión:** en **`inv2`** (revertir aceptación accepted → sent) NO se libera el salón por defecto — el evento sigue "vivo" en negociación y conviene mantener el hold. Si prefieres que revertir también libere, se añade el mismo `releaseVenue`. *(Marcar preferencia al aprobar.)*

## G1.3 · Test Plan (criterios de aceptación técnicos)

Nuevo script **`scripts/verify-sprint1.sh`** (mismo estilo `check`/`q` que los demás), con reseed previo de `eventflow_verify`.

**Nivel base de datos (la garantía dura):**
- **AC-G1.1 · Imposible insertar reservas solapadas.** Insertar dos `venue_bookings` con el mismo `venue_id` y misma `event_date` (vía dos eventos distintos) → la 2ª lanza `SQLSTATE 23P01`. Aserción:
  ```sql
  -- se espera que esta 2ª inserción FALLE; el test captura el error y comprueba el code
  ```
  Verificación: `q "SELECT COUNT(*) FROM venue_bookings WHERE venue_id = <arriba> AND event_date = '2026-09-12'"` == `1` tras el intento doble.
- **AC-G1.2 · Mismo salón, días distintos → permitido.** Dos reservas mismo `venue_id`, fechas distintas → ambas existen (`COUNT = 2`).
- **AC-G1.3 · Salones distintos, mismo día → permitido.** `salon-arriba` y `salon-abajo` el mismo día → ambas existen.
- **AC-G1.4 · Externos no reservan ni colisionan.** Dos eventos `venue_id = NULL` mismo día → `0` filas en `venue_bookings`, sin error.

**Nivel dominio (idempotencia + 409):**
- **AC-G1.5 · `reserveVenue` idempotente.** Llamar dos veces con el mismo evento/salón/fecha → 1 sola fila, sin error.
- **AC-G1.6 · Conflicto vía API devuelve 409.** Aceptar (FWD-3) un evento en `salon-arriba` el 2026-09-12, luego intentar aceptar otro evento distinto en `salon-arriba` el 2026-09-12 → la 2ª respuesta HTTP es `409` y su `event_order`/pagos **no** se crearon (rollback transaccional verificado: `COUNT(event_orders WHERE event_id = 2º) = 0`).
- **AC-G1.7 · Liberación al cancelar.** Tras INV-3 sobre el evento reservado, `COUNT(venue_bookings WHERE event_id = …) = 0`; reservar otro evento en ese salón+fecha ahora **sí** funciona.

**No-regresión:** `verify-e2e.sh` 32/32, `verify-rbac-cocina.sh` 41/41, `verify-operativos.sh` 14/14, `verify-erp-conectado.sh` 17/17 — todos verdes sin cambios (los tests no asignan `venue_id`).

---

# G3 · Coste de personal en la rentabilidad (P&L)

## G3.1 · SQL DDL

**Ninguno nuevo.** Se reutiliza `cost_desglose` (ya tiene `line_type='personal'` en el CHECK, `schema.sql:84`) y `worker_event_pay.total_pay` (`schema.sql:1714`). No se altera `events.total_cost` ni su fórmula.

## G3.2 · Domain Logic

Nuevo fichero **`src/lib/domain/recalcEventLaborCost.ts`** (fuente única del coste de personal de un evento):

```ts
/**
 * EventFlow — Dominio: coste de personal del evento (Spec Sprint 1, G3)
 *
 * Mantiene UNA línea cost_desglose(line_type='personal') por evento, igual a
 * Σ worker_event_pay.total_pay. NO toca events.total_cost (que sigue siendo
 * comida+extras, R2/Opción B): el coste laboral es una dimensión separada del
 * P&L, consumida por /api/rentabilidad. Idempotente (borra+inserta su línea).
 */
import type { PoolClient } from 'pg';
import { getPool } from '@/lib/db';

const AUTO_LABOR_DESC = 'Personal del evento (nóminas)';

export async function recalcEventLaborCost(
  clientOrEventId: PoolClient | string,
  maybeEventId?: string
): Promise<number> {
  const usingClient = typeof clientOrEventId !== 'string';
  const client = usingClient ? (clientOrEventId as PoolClient) : getPool();
  const eventId = usingClient ? (maybeEventId as string) : (clientOrEventId as string);

  const labor = Number((await client.query(
    `SELECT COALESCE(SUM(total_pay), 0) AS labor
     FROM worker_event_pay WHERE event_id = $1`, [eventId]
  )).rows[0]?.labor) || 0;

  // Resincroniza la única línea auto de personal (idempotente).
  await client.query(
    `DELETE FROM cost_desglose
     WHERE event_id = $1 AND line_type = 'personal' AND description = $2`,
    [eventId, AUTO_LABOR_DESC]
  );
  if (labor > 0) {
    await client.query(
      `INSERT INTO cost_desglose (event_id, line_type, description, quantity, unit_price, total)
       VALUES ($1, 'personal', $2, 1, $3, $3)`,
      [eventId, AUTO_LABOR_DESC, labor]
    );
  }
  return labor;
}
```

**Por qué una línea en `cost_desglose` y no en `total_cost`:**
- `recalcEventCost` solo suma `line_type='extras'` → la línea `'personal'` queda fuera de `total_cost` ⇒ **AC2.1 intacto**.
- Pero `/api/rentabilidad` ya hace `GROUP BY line_type` sobre `cost_desglose` (`rentabilidad/route.ts:36-41`), así que el personal aparece automáticamente en `costBreakdown` y, además, lo usamos para el margen real.

### Dónde se invoca `recalcEventLaborCost`
La nómina por evento se crea/edita en `/api/staffing/pay`. Se añade la llamada tras cada mutación que cambie importes:
- **`POST /api/staffing/pay`** (alta de pago) — tras insertar.
- **`PUT /api/staffing/pay`** (editar horas/tarifa/total o marcar pagado) — tras actualizar.
- **`DELETE /api/staffing/pay`** — tras borrar.
En los tres: `await recalcEventLaborCost(getPool() as any, <event_id de la fila afectada>);`
*(El endpoint `/api/staffing/pay/[id]/sign` no cambia importes → no necesita recálculo.)*

Además, como red de seguridad, `/api/rentabilidad` recalcula el personal **en vivo** (ver abajo), así que el dashboard es correcto aunque la línea persistida estuviera desincronizada.

## G3.3 · Modificación de `/api/rentabilidad/route.ts`

Por cada evento, añadir una consulta de personal y recomponer el margen sobre el coste **total real** (comida+extras + personal):

```ts
        // G3: coste de personal del evento (nóminas asignadas, pagadas o no).
        const laborResult = await query(
          `SELECT COALESCE(SUM(total_pay), 0) AS labor
           FROM worker_event_pay WHERE event_id = $1`, [eventId]
        );
        const laborCost = Number(laborResult.rows[0]?.labor || 0);
```
Y en el cálculo (sustituye las líneas 60-62):
```ts
        const totalCostFull = cost + laborCost;            // comida+extras + personal
        const grossMargin   = pvp - totalCostFull;         // ← margen REAL (antes pvp - cost)
        const marginPct     = pvp > 0 ? (grossMargin / pvp) * 100 : 0;
        const costPerGuest  = totalCostFull / guests;      // ← coste/comensal REAL
        const revenuePerGuest = pvp / guests;
```
Y en el objeto devuelto (junto a `totalCost`):
```ts
          totalCost: cost,            // comida+extras (sin cambios de semántica)
          laborCost,                  // G3: coste de personal
          totalCostFull,             // G3: coste total real (= base del margen)
          grossMargin,               // ahora descuenta personal
          marginPct: Math.round(marginPct * 10) / 10,
```
Y en los **totales globales** (líneas 111-124), añadir:
```ts
      totalLaborCost: events.reduce((s, e) => s + (e.laborCost || 0), 0),
      totalCostFull:  events.reduce((s, e) => s + (e.totalCostFull || 0), 0),
```
y recalcular `averageMarginPct` sobre `totalMargin` ya corregido (la suma de `grossMargin`, que ahora incluye personal) — el código existente ya deriva `totalMargin` de `e.grossMargin`, así que se corrige solo.

**Compatibilidad UI:** `totalCost` mantiene su significado (comida+extras), de modo que cualquier consumidor previo no se rompe; los nuevos campos (`laborCost`, `totalCostFull`) son aditivos. El panel `rentabilidad/page.tsx` se actualizará en un paso posterior de UI (fuera del núcleo de este Sprint backend) para mostrar la línea de personal; el dato ya viaja en la respuesta.

## G3.4 · Test Plan

En `scripts/verify-sprint1.sh` (sección G3):

- **AC-G3.1 · `total_cost` NO cambia.** Tras crear `worker_event_pay`, `events.total_cost` sigue siendo `Σ estimated_cost(no congeladas) + Σ extras` (invariante R2/AC2.1 reverificado).
- **AC-G3.2 · Línea de personal sincronizada.** Crear 2 nóminas (p.ej. 300 € + 200 €) para el evento, ejecutar la mutación → `cost_desglose` tiene 1 línea `personal` con `total = 500`.
- **AC-G3.3 · Idempotencia.** Ejecutar `recalcEventLaborCost` dos veces → sigue habiendo **1** línea `personal` con `total = 500` (no se duplica).
- **AC-G3.4 · Rentabilidad descuenta personal.** `GET /api/rentabilidad` para el evento: `laborCost = 500`, `totalCostFull = total_cost + 500`, `grossMargin = total_pvp - totalCostFull`, `marginPct` coherente.
- **AC-G3.5 · Recalculo al borrar nómina.** Borrar una nómina → la línea `personal` baja al nuevo Σ; a cero nóminas → la línea `personal` desaparece (no queda `total=0` colgado).
- **No-regresión:** `verify-operativos.sh` FR-A06 (`total_cost += 50` por gasto previo `extras`) sigue en verde, demostrando que personal y extras no interfieren.

---

## 4. Resumen de cambios (inventario para la FASE 3)

| Tipo | Fichero | Cambio |
|---|---|---|
| DDL | `schema.sql` | `CREATE EXTENSION btree_gist`; tablas `venues` (+seed 2 salones), `venue_bookings` (+EXCLUDE); `events.venue_id` |
| Dominio (nuevo) | `src/lib/domain/venueBooking.ts` | `reserveVenue` / `releaseVenue` / `resolveVenueId` / `VenueConflictError` |
| Dominio (nuevo) | `src/lib/domain/recalcEventLaborCost.ts` | sincroniza línea `cost_desglose('personal')` = Σ `worker_event_pay` |
| Dominio (edit) | `src/lib/domain/acceptQuote.ts` | llama `reserveVenue` antes de `accepted` (rollback si 409) |
| Ruta (edit) | `src/app/api/events/[id]/route.ts` (PUT) | reserva/libera al asignar `venue`/fecha; mantiene `venue_type` coherente |
| Ruta (edit) | `src/app/api/events/[id]/transitions/route.ts` | `releaseVenue` en INV-1/INV-3 (INV-2 a decidir) |
| Ruta (edit) | `src/app/api/staffing/pay/route.ts` | `recalcEventLaborCost` tras POST/PUT/DELETE |
| Ruta (edit) | `src/app/api/rentabilidad/route.ts` | margen real = pvp − (total_cost + personal); campos `laborCost`/`totalCostFull` |
| Test (nuevo) | `scripts/verify-sprint1.sh` | AC-G1.1..G1.7 + AC-G3.1..G3.5 |

**Garantía de idempotencia (requisito del Sprint):**
- `reserveVenue` → `ON CONFLICT (event_id) DO UPDATE` + el EXCLUDE no choca consigo mismo ⇒ re-aceptar no duplica ni falla.
- `recalcEventLaborCost` → delete+insert de su única línea ⇒ re-ejecutar converge al mismo estado.
- `acceptQuote` conserva su idempotencia previa (cada paso comprueba antes de escribir); la reserva se suma a ese contrato.

## 5. Plan de validación (FASE 3, tras "SPEC Aprobado")
1. Editar `schema.sql`; recrear `eventflow_verify` (drop/create + schema + seed).
2. Implementar los 2 ficheros de dominio nuevos + las 5 ediciones de ruta.
3. `npm run build` exit 0.
4. `scripts/verify-sprint1.sh` 12/12 (G1: 7, G3: 5).
5. Suite completa sin regresión: 32/32 · 41/41 · 14/14 · 17/17.
6. Commit + push a `main` (mensajes con trailers de sesión). Actualizar `docs/handoff.md`.

## 6. Riesgos y decisiones abiertas (para tu revisión)
- **D1 · Liberar salón en INV-2 (revertir aceptación)?** Propuesta: **no** liberar (mantener hold mientras se renegocia). Alternativa: liberar. → *elige*.
- **D2 · Granularidad de reserva = día completo** (un evento por salón y día). Si en el futuro hay doble turno (comida/cena) en el mismo salón, habrá que pasar `event_date DATE` → franja horaria y el `daterange` → `tstzrange`. El constraint queda preparado para ese salto. → *confirmar que día completo es correcto hoy*.
- **D3 · Asignación de salón vía PUT con clave `venue`** (slug `salon-arriba`/`salon-abajo`/`externo`). Si prefieres otra clave de API (`venue_slug`, `venue_id` directo), se ajusta. → *confirmar contrato de API*.
- **D4 · Personal = todas las nóminas asignadas** (pagadas o no), porque es coste incurrido del evento. Si quieres que el margen solo cuente nóminas ya **pagadas**, se filtra por `status='paid'`. → *elige criterio de P&L*.

---

**FIN DEL SPEC — FASE 1 completada. No se ha modificado código ni base de datos. A la espera de tu revisión y del comando "SPEC Aprobado" para ejecutar la FASE 3.**
