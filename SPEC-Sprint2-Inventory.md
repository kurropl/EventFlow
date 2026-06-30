# SPEC · Sprint 2 — Compromiso de inventario y compra automática (G2)

**Metodología:** SDD. Este documento describe el QUÉ, el PORQUÉ y el CÓMO exacto. **No se ha tocado código ni base de datos** — FASE 1 (especificación), a la espera de revisión y aprobación explícita antes de implementar (FASE 3).

**Autor:** Arquitecto/Backend Senior · **Fecha:** 2026-06-30 · **Rama:** `main`
**Origen:** `docs/auditoria-erp-2026-06.md`, Gap **G2** — *"El inventario no se compromete al confirmar y la compra es 100% manual"*.
**Excluido por mandato vigente:** G4/G15 (pasarela de pago, TPV, KDS) — no se tocan ni se mencionan en el diseño.
**Fuera de alcance de ESTE sprint (G6, explícitamente diferido):** la doble contabilidad de stock (`ingredients.quantity` vs `inventory`/`inventory_movements`) NO se unifica aquí. Este sprint usa `ingredients.quantity` como única fuente de "stock disponible" — es la misma fuente que ya usan `stock/check`, `stockDeduct.ts` y `generate-order` hoy, así que no se introduce una tercera verdad; solo se hace explícito que `inventory`/`inventory_movements` queda fuera.

---

## 0. Hallazgos de Discovery (evidencia leída antes de diseñar)

1. **`stockWarnings` es una funcionalidad muerta, confirmado con más precisión que en la auditoría inicial.** `src/components/b2b/LeadsCRM.tsx:185-188` lee `quoteData.stockWarnings` de la respuesta de `PUT /api/quotes/[id]`. Pero `src/app/api/quotes/[id]/route.ts` (líneas 56-71), cuando `status==='accepted'`, devuelve `{success, data, eventOrder, payments}` — **sin** campo `stockWarnings`. Por eso siempre es `undefined` en el cliente. `transitions::fwd3` (línea 121) reenvía `data.stockWarnings` desde esa misma respuesta — así que arreglando UN solo punto (la respuesta de `quotes/[id]` PUT) se arregla la UI existente Y `fwd3`, sin tocar el frontend.
2. **Bug real descubierto y confirmado empíricamente**: `src/app/api/stock/generate-order/route.ts:137` llama a la función SQL `convert_uom(...)`, pero esa función **no existe en `schema.sql`** — solo vive en `scripts/migration-escandallos-v2.sql`, que no se carga nunca (ni en producción ni en `eventflow_verify`). Verificado contra la BD de verificación:
   ```
   $ psql -d eventflow_verify -c "SELECT convert_uom(100,'g','kg')"
   ERROR: function convert_uom(integer, unknown, unknown) does not exist
   ```
   Es decir: **el botón "Generar pedido" de `StockManager.tsx` está roto hoy** en cualquier despliegue desde `schema.sql` limpio. Nadie lo ha notado porque (según el propio Gap Analysis) nadie lo pulsa casi nunca.
3. **`generate-order` tampoco graba `event_id` en `supplier_orders`** pese a que la tabla ya tiene esa columna (`schema.sql`, `supplier_orders.event_id UUID REFERENCES events(id)`) y la ruta recibe `event_id` en el body — se pierde la trazabilidad pedido↔evento.
4. **Matching de ingrediente por nombre exacto** (`generate-order` línea 107: `WHERE name = $1`) es frágil — `stockDeduct.ts` (línea 76-104) ya resuelve esto mejor: prioriza `ingredient_id` (que `event_shopping_items` ya trae resuelto desde `generateEscandallo.ts`) y solo cae a nombre como fallback. `generate-order` no usa `ingredient_id` en absoluto.
5. **`event_shopping_items`** ya tiene, por cada línea con receta resuelta, `ingredient_id` (FK directa) y `theoretical_qty`/`theoretical_unit` (cantidad ya convertida a la unidad de la receta) — confirmado en `generateEscandallo.ts:60-75`. Son la base correcta para comparar contra `ingredients.quantity`/`ingredients.unit`, mejor que recalcular desde `total_grams/total_units/total_ml` como hace `stock/check` hoy.
6. **`units_of_measure`** ya está sembrada con los factores correctos (`kg=1, g=0.001, l=1, ml=0.001, ud=1`) — la función `convert_uom` que falta solo necesita añadirse, no rediseñarse.
7. **Fixture de verificación no dispara faltante**: el evento de `verify-ejemplo-e2e.sql` tiene 100.000 g de Solomillo VERIFY en stock y la receta solo consume 24.000 g (120 raciones × 200 g) → añadir el chequeo de compromiso a `acceptQuote` **no** afecta a ningún test existente (32/32, 41/41, 14/14, 17/17 siguen sin shortage). El nuevo verify script de este sprint creará deliberadamente un escenario de falta de stock.

---

## 1. Diseño

### G2.1 · `inventory_commitments` — el "compromiso" que falta

**Problema exacto del Gap Analysis**: *"dos eventos de la misma semana «prometen» el mismo stock sin alerta"*. Hoy `stock/check` y `generate-order` comparan la demanda de **un solo evento** contra `ingredients.quantity` (stock físico actual) — ignorando que OTRO evento ya aceptado puede haber "reclamado" ese mismo stock para una fecha futura. Sin un registro de qué evento ya prometió qué cantidad, es imposible avisar de ese conflicto.

**Solución**: una tabla ledger, igual de simple que `venue_bookings` (Sprint 1) pero sin exclusión (el stock SÍ es compartible/divisible, a diferencia de un salón):

```sql
-- ============================================================
-- SPRINT 2 · G2 — Compromiso de inventario al aceptar presupuesto
-- ============================================================

-- Función de conversión de unidades — existía referenciada en
-- /api/stock/generate-order pero NUNCA se cargó en schema.sql (bug real,
-- confirmado: la ruta fallaba con "function convert_uom does not exist"
-- contra cualquier BD limpia). Se incorpora aquí, sin cambios de lógica
-- respecto a scripts/migration-escandallos-v2.sql.
CREATE OR REPLACE FUNCTION convert_uom(amount NUMERIC, from_unit VARCHAR, to_unit VARCHAR)
RETURNS NUMERIC AS $$
DECLARE
  from_factor NUMERIC;
  to_factor NUMERIC;
BEGIN
  SELECT factor_to_base INTO from_factor FROM units_of_measure WHERE name = from_unit;
  SELECT factor_to_base INTO to_factor FROM units_of_measure WHERE name = to_unit;
  IF from_factor IS NULL OR to_factor IS NULL THEN RETURN amount; END IF;
  RETURN ROUND((amount * from_factor / to_factor)::numeric, 4);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Una fila por (evento, ingrediente): cuánto de ese ingrediente "promete"
-- consumir este evento, en la unidad de stock del ingrediente
-- (ingredients.unit). Se crea/actualiza al aceptar presupuesto (escandallo
-- generado) y se borra al revertir/cancelar/cerrar (el stock real ya
-- reflejó el consumo, el compromiso deja de tener sentido).
CREATE TABLE IF NOT EXISTS inventory_commitments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    qty_committed NUMERIC(12,3) NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (event_id, ingredient_id)
);
CREATE INDEX IF NOT EXISTS idx_inv_commitments_ingredient ON inventory_commitments(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_inv_commitments_event ON inventory_commitments(event_id);
```

**"Disponible para prometer" a un ingrediente X** = `ingredients.quantity − Σ(inventory_commitments.qty_committed de OTROS eventos)`. Esto es lo que se compara contra la demanda de un evento nuevo para decidir si hay faltante — ya no solo "¿hay stock físico?" sino "¿hay stock físico que nadie más ya se haya prometido?".

### G2.2 · Dominio `src/lib/domain/inventoryCommitment.ts` (nuevo)

```ts
/**
 * EventFlow — Dominio: compromiso de inventario al aceptar presupuesto (G2)
 *
 * Resuelve el gap "dos eventos prometen el mismo stock sin aviso": cada
 * evento aceptado registra cuánto de cada ingrediente consumirá (vía
 * inventory_commitments). checkInventoryShortages compara la demanda de UN
 * evento contra el stock físico MENOS lo ya comprometido por OTROS eventos.
 *
 * Fuente de "stock disponible": ingredients.quantity (la misma que usan
 * stock/check y stockDeduct.ts). La tabla `inventory`/`inventory_movements`
 * (doble contabilidad, Gap G6) queda fuera de alcance de este sprint.
 */
import type { PoolClient } from 'pg';

export interface ShortageRow {
  ingredient_id: string | null;
  ingredient_name: string;
  provider_name: string | null;
  needed: number;
  available: number;   // stock físico MENOS comprometido por otros eventos
  unit: string;
  deficit: number;
}

/** Upsert idempotente: 1 fila por (evento, ingrediente) con la demanda total
 *  del escandallo, convertida a la unidad de stock del ingrediente. */
export async function commitInventoryForEvent(client: PoolClient, eventId: string): Promise<void> {
  await client.query(
    `INSERT INTO inventory_commitments (event_id, ingredient_id, qty_committed)
     SELECT esi.event_id, esi.ingredient_id,
            SUM(convert_uom(esi.theoretical_qty, esi.theoretical_unit, i.unit))
     FROM event_shopping_items esi
     JOIN ingredients i ON i.id = esi.ingredient_id
     WHERE esi.event_id = $1 AND esi.ingredient_id IS NOT NULL
       AND esi.theoretical_qty IS NOT NULL AND esi.theoretical_unit IS NOT NULL
     GROUP BY esi.event_id, esi.ingredient_id
     ON CONFLICT (event_id, ingredient_id)
     DO UPDATE SET qty_committed = EXCLUDED.qty_committed, updated_at = now()`,
    [eventId]
  );
}

/** Libera (borra) todos los compromisos de un evento — idempotente. */
export async function releaseInventoryCommitments(client: PoolClient, eventId: string): Promise<void> {
  await client.query(`DELETE FROM inventory_commitments WHERE event_id = $1`, [eventId]);
}

/** Compara la demanda de `eventId` contra stock físico − compromisos de
 *  OTROS eventos. Incluye también ingredientes que generateEscandallo no
 *  pudo resolver a un ingrediente real (ingredient_id NULL) como aviso
 *  informativo (available=0), igual que ya hace /api/stock/check hoy. */
export async function checkInventoryShortages(client: PoolClient, eventId: string): Promise<ShortageRow[]> {
  const resolved = await client.query(
    `SELECT esi.ingredient_id, i.name AS ingredient_name, esi.provider_name, i.unit,
            SUM(convert_uom(esi.theoretical_qty, esi.theoretical_unit, i.unit)) AS needed,
            i.quantity AS on_hand,
            COALESCE((
              SELECT SUM(qty_committed) FROM inventory_commitments
              WHERE ingredient_id = esi.ingredient_id AND event_id <> $1
            ), 0) AS others_committed
     FROM event_shopping_items esi
     JOIN ingredients i ON i.id = esi.ingredient_id
     WHERE esi.event_id = $1 AND esi.ingredient_id IS NOT NULL
       AND esi.theoretical_qty IS NOT NULL AND esi.theoretical_unit IS NOT NULL
     GROUP BY esi.ingredient_id, i.name, esi.provider_name, i.unit, i.quantity`,
    [eventId]
  );

  const unresolved = await client.query(
    `SELECT DISTINCT ingredient_name FROM event_shopping_items
     WHERE event_id = $1 AND ingredient_id IS NULL`,
    [eventId]
  );

  const shortages: ShortageRow[] = [];
  for (const row of resolved.rows) {
    const needed = Number(row.needed) || 0;
    const available = Math.max(0, Number(row.on_hand) - Number(row.others_committed));
    if (needed > available) {
      shortages.push({
        ingredient_id: row.ingredient_id, ingredient_name: row.ingredient_name,
        provider_name: row.provider_name, needed, available, unit: row.unit,
        deficit: Math.round((needed - available) * 1000) / 1000,
      });
    }
  }
  for (const row of unresolved.rows) {
    shortages.push({
      ingredient_id: null, ingredient_name: row.ingredient_name, provider_name: null,
      needed: 0, available: 0, unit: 'ud', deficit: 0,
    });
  }
  return shortages;
}
```

### G2.3 · Interceptación en `acceptQuote.ts`

Tras el paso 5 (`generateEscandallo`) y antes del paso 6 (`recalcEventCost`), insertar:

```ts
    // 5.5) G2 (Sprint 2): comprometer el inventario que este evento reclama y
    // comprobar faltantes contra lo ya comprometido por OTROS eventos. NO
    // bloqueante (a diferencia de G1/salón): el negocio puede aceptar la
    // boda aunque falte stock — se avisa y se genera un pedido borrador.
    await commitInventoryForEvent(client, eventId);
    const stockWarnings = await checkInventoryShortages(client, eventId);
    if (stockWarnings.length > 0) {
      await generateSupplierOrdersForEvent(client, eventId, stockWarnings);
    }
```
Imports nuevos en `acceptQuote.ts`: `commitInventoryForEvent`, `checkInventoryShortages` (de `./inventoryCommitment`) y `generateSupplierOrdersForEvent` (de `./generateSupplierOrders`, G2.4).

`AcceptQuoteResult` gana un campo:
```ts
export interface AcceptQuoteResult {
  quote: any; event: any; eventOrder: any; payments: any[]; clientToken: string;
  stockWarnings: ShortageRow[];   // NUEVO — vacío si no hay faltantes
}
```
y el `return` final de `acceptQuote` añade `stockWarnings`.

### G2.4 · Dominio `src/lib/domain/generateSupplierOrders.ts` (nuevo — reemplaza la lógica embebida en la ruta)

Única implementación de "generar pedidos a proveedor desde un déficit". Reemplaza el cuerpo de `src/app/api/stock/generate-order/route.ts` (que delega aquí, mismo patrón R1/D1 ya usado en todo el repo) y se reutiliza para el auto-disparo en `acceptQuote`.

```ts
/**
 * EventFlow — Dominio: generación de pedidos a proveedor desde un déficit (G2)
 *
 * Única implementación. Antes vivía embebida en
 * src/app/api/stock/generate-order/route.ts con: (a) una llamada a
 * convert_uom() que no existía en schema.sql (bug real, ver SPEC Sprint 2),
 * (b) matching de ingrediente por nombre exacto (frágil), (c) sin event_id
 * en el pedido pese a que la columna existe. Los tres se corrigen aquí.
 *
 * Idempotente por (event_id, supplier, status='pending'): si ya existe un
 * pedido borrador para ese evento+proveedor, se actualizan sus líneas en vez
 * de duplicar el pedido (evita pedidos repetidos si acceptQuote se reintenta
 * o si el botón manual se pulsa dos veces).
 */
import type { PoolClient } from 'pg';
import type { ShortageRow } from './inventoryCommitment';

export async function generateSupplierOrdersForEvent(
  client: PoolClient, eventId: string, shortages: ShortageRow[]
): Promise<{ created: number; orders: any[] }> {
  // Solo déficits con ingrediente resuelto (no se puede pedir lo que no
  // identifica a un ingrediente real) y con proveedor conocido.
  const byProvider = new Map<string, ShortageRow[]>();
  for (const s of shortages) {
    if (!s.ingredient_id || s.deficit <= 0) continue;
    const provider = s.provider_name || 'Sin proveedor';
    if (!byProvider.has(provider)) byProvider.set(provider, []);
    byProvider.get(provider)!.push(s);
  }

  const orders: any[] = [];
  for (const [provider, rows] of byProvider) {
    let order = (await client.query(
      `SELECT * FROM supplier_orders
       WHERE event_id = $1 AND supplier = $2 AND status = 'pending' AND origin = 'auto_accept'
       LIMIT 1`,
      [eventId, provider]
    )).rows[0];

    if (!order) {
      order = (await client.query(
        `INSERT INTO supplier_orders (event_id, supplier, status, origin, ordered_at)
         VALUES ($1, $2, 'pending', 'auto_accept', now())
         RETURNING *`,
        [eventId, provider]
      )).rows[0];
    } else {
      // Idempotente: limpia líneas previas de este pedido borrador y regenera.
      await client.query(`DELETE FROM supplier_order_items WHERE order_id = $1`, [order.id]);
    }

    let totalCost = 0;
    for (const r of rows) {
      const unitCost = (await client.query(
        `SELECT unit_cost FROM ingredients WHERE id = $1`, [r.ingredient_id]
      )).rows[0]?.unit_cost ?? 0;
      const lineCost = r.deficit * Number(unitCost);
      totalCost += lineCost;
      await client.query(
        `INSERT INTO supplier_order_items (order_id, ingredient_id, ingredient_name, quantity, unit, unit_cost, cost_per_unit)
         VALUES ($1, $2, $3, $4, $5, $6, $6)`,
        [order.id, r.ingredient_id, r.ingredient_name, r.deficit, r.unit, unitCost]
      );
    }
    await client.query(
      `UPDATE supplier_orders SET total_cost = $1, updated_at = now() WHERE id = $2`,
      [totalCost, order.id]
    );
    orders.push({ ...order, total_cost: totalCost });
  }
  return { created: orders.length, orders };
}
```

**Importante — esto crea pedidos en estado `pending` (borrador), nunca los envía a nadie.** No hay integración de email/WhatsApp a proveedores en este sprint (no existe hoy y no se añade): el pedido queda visible en `StockManager.tsx` para que un humano lo revise, edite y lo marque `approved`/lo gestione manualmente, igual que un pedido creado a mano hoy. Cero automatización del "dinero saliendo" — coherente con la cautela ya aplicada a G4.

### G2.5 · Reescritura de `src/app/api/stock/generate-order/route.ts`

Se sustituye el cuerpo (líneas 55-180 actuales) por una delegación al dominio, **reutilizando `checkInventoryShortages`** para construir el déficit en vez de la query SQL ad-hoc actual (que ni filtra por compromisos de otros eventos ni usa `convert_uom` correctamente). Contrato HTTP sin cambios: `POST {event_id}` → `{success, data: [...orders]}` — `StockManager.tsx:647` sigue funcionando sin tocar el frontend.

```ts
const body = await request.json();
const { event_id } = body;
// ... validación UUID igual que hoy ...
const result = await transaction(async (client) => {
  const shortages = await checkInventoryShortages(client, event_id);
  return generateSupplierOrdersForEvent(client, event_id, shortages);
});
return NextResponse.json({ success: true, data: result.orders });
```

### G2.6 · Liberación de compromisos (simétrico a G1)

- **`transitions/route.ts::inv2`** (revertir aceptación, accepted→sent): ya borra `event_shopping_items` y `event_orders` — se añade `await releaseInventoryCommitments(getPool(), event.id)` en el mismo bloque (antes del `setEventStatus`).
- **`transitions/route.ts::inv3`** (cancelar, accepted→cancelled): igual que ya hace con `releaseVenue` (G1) — se añade `await releaseInventoryCommitments(getPool(), event.id)` junto a esa línea.
- **`src/lib/stockDeduct.ts::deductStockForEvent`**: al final, justo antes del `return`, se añade `await releaseInventoryCommitments(getPool() as any, eventId)` — una vez el stock se ha deducido DE VERDAD (consumo real), el "compromiso" (una promesa sobre stock futuro) ya cumplió su función y debe desaparecer. Esto cubre tanto `close/route.ts` como `transitions::fwd4` (ambos llaman a `deductStockForEvent`), sin tocar esos dos ficheros.

### G2.7 · Tabla resumen de cambios

| Tipo | Fichero | Cambio |
|---|---|---|
| DDL | `schema.sql` | función `convert_uom` (bug fix, antes ausente); tabla `inventory_commitments` |
| Dominio (nuevo) | `src/lib/domain/inventoryCommitment.ts` | `commitInventoryForEvent` / `releaseInventoryCommitments` / `checkInventoryShortages` |
| Dominio (nuevo) | `src/lib/domain/generateSupplierOrders.ts` | `generateSupplierOrdersForEvent` (única fuente, sustituye la lógica embebida) |
| Dominio (edit) | `src/lib/domain/acceptQuote.ts` | compromete inventario + chequea faltantes + auto-genera pedidos borrador; `stockWarnings` en el resultado |
| Ruta (edit) | `src/app/api/quotes/[id]/route.ts` (PUT) | incluye `stockWarnings: result.stockWarnings` en la respuesta de aceptación → arregla la UI ya existente sin tocarla |
| Ruta (edit) | `src/app/api/stock/generate-order/route.ts` | delega en el dominio (arregla el bug de `convert_uom` ausente + matching frágil + `event_id` perdido) |
| Ruta (edit) | `src/app/api/events/[id]/transitions/route.ts` | `releaseInventoryCommitments` en `inv2`/`inv3` |
| Lib (edit) | `src/lib/stockDeduct.ts` | `releaseInventoryCommitments` tras deducir stock real |
| Test (nuevo) | `scripts/verify-sprint2.sh` | criterios de aceptación abajo |

**Garantía de idempotencia:** `commitInventoryForEvent` usa `ON CONFLICT (event_id, ingredient_id) DO UPDATE` (recalcula, no duplica); `generateSupplierOrdersForEvent` reutiliza el pedido `pending`+`origin='auto_accept'` existente del mismo evento+proveedor en vez de crear otro; `releaseInventoryCommitments` es un `DELETE` plano (no falla si no hay filas). `acceptQuote` sigue siendo seguro de reintentar.

---

## 2. Test Plan (criterios de aceptación técnicos)

Nuevo `scripts/verify-sprint2.sh` (mismo estilo que `verify-sprint1.sh`), reseed previo + un segundo evento/escandallo con stock deliberadamente insuficiente.

- **AC-G2.1 · `convert_uom` existe y convierte bien.** `SELECT convert_uom(2000,'g','kg')` = `2`. (Bug fix verificado directamente.)
- **AC-G2.2 · Aceptar sin conflicto de stock → `stockWarnings: []`.** El evento fixture (100.000 g stock, 24.000 g demanda) acepta sin avisos, igual que hoy (no regresión).
- **AC-G2.3 · Compromiso registrado al aceptar.** Tras aceptar, `inventory_commitments` tiene 1 fila por ingrediente resuelto del escandallo, con `qty_committed` = demanda convertida a la unidad del ingrediente.
- **AC-G2.4 · Segundo evento agota el stock "prometido" → aviso.** Crear un 2º evento+presupuesto cuya demanda del mismo ingrediente, sumada al compromiso del primero, supere `ingredients.quantity`. Al aceptarlo: `stockWarnings.length > 0`, con `deficit` correcto.
- **AC-G2.5 · La aceptación NO se bloquea.** Pese al aviso, el 2º evento queda `accepted` igualmente (HTTP 200, no 409) — a diferencia de G1.
- **AC-G2.6 · Pedido borrador auto-generado.** Tras AC-G2.4, existe 1 `supplier_orders` con `event_id` = el 2º evento, `origin='auto_accept'`, `status='pending'`, con `supplier_order_items` cubriendo exactamente el déficit.
- **AC-G2.7 · `stockWarnings` llega a la API pública (la UI ya lo lee).** `PUT /api/quotes/:id {"status":"accepted"}` para el 2º evento devuelve `stockWarnings` no vacío en el JSON top-level (el mismo shape que `LeadsCRM.tsx` espera).
- **AC-G2.8 · Idempotencia del compromiso.** Re-aceptar el mismo evento (reintento) no duplica `inventory_commitments` (sigue 1 fila por ingrediente) ni duplica el pedido borrador (sigue 1 `supplier_orders`).
- **AC-G2.9 · Liberación al cancelar (INV-3).** Cancelar el 2º evento → `inventory_commitments` de ese evento desaparece; un 3er evento que antes chocaba ahora acepta sin aviso.
- **AC-G2.10 · Liberación al revertir (INV-2).** Aceptar un evento, revertir (accepted→sent) → `inventory_commitments` de ese evento desaparece.
- **AC-G2.11 · Liberación al cerrar (deducción real).** Cerrar un evento (FWD-4 o `/close`) → `inventory_commitments` de ese evento desaparece (el consumo ya es real, no una promesa).
- **AC-G2.12 · Ruta manual `/api/stock/generate-order` ya no rompe.** Llamada directa con un `event_id` con déficit conocido → `200` con pedidos creados (antes daba `500` por `convert_uom` ausente).

**No-regresión:** `verify-e2e.sh` 32/32, `verify-rbac-cocina.sh` 41/41, `verify-operativos.sh` 14/14, `verify-erp-conectado.sh` 17/17, `verify-sprint1.sh` 26/26 — todos verdes (la demanda del fixture nunca supera el stock sembrado, así que `acceptQuote` no genera avisos en ninguno de ellos).

---

## 3. Decisiones de diseño tomadas (para tu confirmación)

- **E1 · No bloqueante.** A diferencia de G1 (salón = recurso exclusivo, conflicto real e irresoluble), un faltante de stock SÍ tiene salida (comprar más) — por eso `acceptQuote` nunca lanza error por `stockWarnings`, solo avisa + genera el pedido borrador. *¿Conforme, o prefieres también un modo bloqueante opcional?*
- **E2 · El pedido auto-generado queda en `pending`, nunca se envía.** Sigue el mismo patrón cauteloso que ya aplicamos a G4 (sin tocar dinero/proveedores automáticamente) — un humano debe revisarlo y gestionarlo en `StockManager.tsx`, igual que uno creado a mano hoy. *¿Conforme?*
- **E3 · Ingredientes sin resolver** (`ingredient_id IS NULL`, el escandallo no encontró el ingrediente en catálogo) aparecen como aviso informativo en `stockWarnings` pero NO generan pedido automático (no hay ingrediente real al que comprarle nada). *¿Conforme, o prefieres que estos también bloqueen/avisen de otra forma?*
- **E4 · Alcance de "stock disponible" = solo `ingredients.quantity`.** Se deja fuera la tabla `inventory`/`inventory_movements` (Gap G6, doble contabilidad) — abordarlo aquí habría disparado el alcance del sprint y tocado rutas de trazabilidad/APPCC no pedidas. *¿Conforme con dejarlo para un Sprint 3 dedicado a G6, o lo prefieres ya integrado en este?*

---

## 4. Plan de validación (FASE 3, tras "SPEC Aprobado")
1. Añadir DDL a `schema.sql`; recrear `eventflow_verify`.
2. Crear `domain/inventoryCommitment.ts` y `domain/generateSupplierOrders.ts`; editar `acceptQuote.ts`, `quotes/[id]/route.ts`, `stock/generate-order/route.ts`, `transitions/route.ts` (inv2/inv3), `stockDeduct.ts`.
3. `npm run build` exit 0.
4. `scripts/verify-sprint2.sh` 12/12.
5. No-regresión completa: 32/32 · 41/41 · 14/14 · 17/17 · 26/26 (sprint1).
6. Commit + push a `main`; actualizar `docs/handoff.md`.

---

**FIN DEL SPEC — FASE 1 completada. No se ha modificado código ni base de datos. A la espera de tu revisión (E1–E4) y del comando "SPEC Aprobado" para ejecutar la FASE 3.**
