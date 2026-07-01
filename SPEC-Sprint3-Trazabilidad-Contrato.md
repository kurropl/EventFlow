# SPEC · Sprint 3 — Trazabilidad de lote (G5) y Contrato/firma de cliente (G8)

**Estado:** ✅ Aprobado — pasando a FASE 3. Decisiones finales del usuario sobre
la propuesta original (D1–D4):
- **D1** — Contrato en HTML confirmado (sin PDF real en este sprint).
- **D2** — **Firma dibujada** (canvas), no solo nombre+NIF+checkbox como
  proponía la FASE 1. Añade una página pública con pizarra de firma y una
  columna `signature_data` (PNG en base64) a `event_contracts`.
- **D3** — **Botón separado**: el contrato NO se genera automáticamente
  dentro de `acceptQuote` (se retira esa interceptación de la propuesta
  original); se genera bajo demanda vía un endpoint de admin
  `POST /api/events/[id]/contract/generate`.
- **D4** — El texto legal de términos y condiciones lo redacta el propio
  Spec (boilerplate estándar de servicios de catering en España — el
  usuario debe hacerlo revisar por un abogado antes de producción real,
  pero no bloquea el desarrollo).

**Metodología:** SDD. Este documento describe el QUÉ, el PORQUÉ y el CÓMO exacto.

**Autor:** Arquitecto/Backend Senior · **Fecha:** 2026-07-01 · **Rama:** `main`
**Origen:** `docs/auditoria-erp-2026-06.md` — **G5** ("Trazabilidad de lote manual en el punto de consumo, riesgo legal APPCC") y **G8** ("Sin contrato ni firma del cliente").
**Excluido por mandato vigente:** G4/G15 (pasarela de pago, TPV, KDS) — no se tocan.
**Alcance EXCLUSIVO de este Sprint:** G5 y G8. El resto de gaps pendientes (G9-G14, G16-G23) quedan para sprints posteriores.

---

## 0. Hallazgos de Discovery (evidencia leída antes de diseñar)

### Para G5
1. **El esquema APPCC ya existe y es correcto** — `receiving_log` (lote, `expiry_date`, `batch_quantity`, `ingredient_id`), `lot_consumption` (`receiving_log_id`, `event_id`, `quantity_consumed`), `traceability_log` (`event_id`, `ingredient_id`, `recipe_id`, `lot_number`, `receiving_id`, `quantity_used`, `used_by`, `guest_served` INT, `is_critical`). El problema no es de modelo, es que **nada escribe en `lot_consumption`/`traceability_log` automáticamente** — solo existen endpoints POST manuales (`/api/trazabilidad/lot-consumption/[eventId]`).
2. **`stockDeduct.ts` (tras Sprint 2/G6) ya usa `adjustIngredientStock` como único escritor del saldo** — el punto de inserción correcto para la trazabilidad FEFO es justo ahí, en paralelo (no sustituye el ledger de G6, lo complementa).
3. **No hay una noción de "saldo restante por lote"** — se calcula on-the-fly: `receiving_log.batch_quantity − Σ lot_consumption.quantity_consumed (de ese lote)`. No requiere columna nueva.
4. **El fixture de verificación no registra lotes antes de cerrar el evento** (confirmado en `verify-rbac-cocina.sh`: el lote `LOTE-V1` se registra en la sección APPCC, DESPUÉS de la sección de cierre) → añadir el consumo FEFO en `stockDeduct.ts` **no afecta ningún test existente** (cero lotes disponibles en ese momento → la deducción cae al caso "sin lote", ver diseño abajo).

### Para G8
5. **No existe tabla de contratos ni de firma de cliente.** El único precedente de "firma" es `worker_event_pay.signature_url`/`signed_by` (nómina de trabajador) — y, leyendo el código real, **es solo un campo de texto** (`signature_url`, un string cualquiera); no hay pizarra de firma dibujada en ningún componente del frontend (confirmado: cero referencias a canvas/`SignaturePad` en `StaffingManager.tsx`). El propio verify script prueba la firma con una URL falsa (`/firmas/x.png`). Es decir: el patrón de "firma" ya asentado en este código es un **clic de confirmación con nombre**, no una firma criptográfica ni un trazo dibujado — G8 sigue el mismo nivel de rigor, coherente con lo ya construido.
6. **`invoices.pdf_data` (columna base64) existe pero nada la escribe** — confirmado por grep, cero escritores. No hay generación de PDF en servidor establecida para reutilizar; `jspdf` está en `package.json` pero es una librería de navegador (cliente), no sirve para generar el documento en el backend sin infraestructura adicional (canvas headless). **Decisión de diseño:** el contrato se genera como **HTML** (snapshot de texto, no PDF binario) — el cliente lo ve y firma en una página pública; exportar a PDF queda de mejora futura (v2), no bloquea el cierre del gap legal/comercial que pide G8 (tener un documento aceptado y trazado, no necesariamente un PDF).
7. **El patrón `client_token` para acceso público ya está asentado** (`guest-forms/decor/route.ts`): valida `events.client_token = $1`, exige `event.status = 'accepted'`, usa `securityHeaders()`/`sanitizeText`. El contrato reutiliza EXACTAMENTE este patrón, tal y como pedía la auditoría.
8. **`acceptQuote.ts` es donde ya se genera `client_token`** (paso 4) — es el sitio natural para generar también el contrato (mismo evento de negocio: "el presupuesto se acaba de aceptar").

---

# G5 · Trazabilidad de lote automática (FEFO) en el cierre

## G5.1 · SQL DDL

**Ninguno.** El esquema ya tiene todo lo necesario (`receiving_log`, `lot_consumption`, `traceability_log`). Cero cambios de schema.sql para G5.

## G5.2 · Domain Logic

Nuevo fichero **`src/lib/domain/lotTraceability.ts`**:

```ts
/**
 * EventFlow — Dominio: trazabilidad de lote FEFO al consumo (Spec Sprint 3, G5)
 *
 * Complementa (no sustituye) domain/stockLedger.ts: adjustIngredientStock
 * sigue siendo el único escritor del SALDO (ingredients.quantity). Esta
 * función escribe el RASTRO — qué lote concreto (First-Expired-First-Out)
 * cubrió cada consumo — que hoy solo existe si un humano lo introduce a
 * mano vía /api/trazabilidad/lot-consumption/[eventId].
 *
 * Si el stock consumido no proviene de ningún lote registrado (p.ej. una
 * carga inicial de inventario sin receiving_log, o un ajuste manual), NO se
 * inventa un lote: se reporta como `untracedQty` para que el hueco de
 * trazabilidad sea visible, nunca oculto.
 */
import type { PoolClient } from 'pg';

export interface ConsumeLotsParams {
  ingredientId: string;
  eventId: string;
  quantity: number;   // en la unidad de stock del ingrediente (positivo)
  unit: string;
  recipeId?: string | null;
  usedBy?: string;
  guestServed?: number | null;
}

export interface ConsumeLotsResult {
  consumedFromLots: number;
  untracedQty: number;
  lotsUsed: Array<{ lotNumber: string; qty: number }>;
}

export async function consumeLotsFEFO(
  client: PoolClient, p: ConsumeLotsParams
): Promise<ConsumeLotsResult> {
  const lots = (await client.query(
    `SELECT rl.id, rl.lot_number,
            rl.batch_quantity - COALESCE((
              SELECT SUM(quantity_consumed) FROM lot_consumption WHERE receiving_log_id = rl.id
            ), 0) AS remaining
     FROM receiving_log rl
     WHERE rl.ingredient_id = $1
     ORDER BY rl.expiry_date ASC NULLS LAST, rl.received_date ASC
     FOR UPDATE OF rl`,
    [p.ingredientId]
  )).rows.filter((r: any) => Number(r.remaining) > 0);

  let remaining = p.quantity;
  const lotsUsed: Array<{ lotNumber: string; qty: number }> = [];

  for (const lot of lots) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, Number(lot.remaining));
    if (take <= 0) continue;

    await client.query(
      `INSERT INTO lot_consumption (receiving_log_id, event_id, quantity_consumed, unit)
       VALUES ($1, $2, $3, $4)`,
      [lot.id, p.eventId, take, p.unit]
    );
    await client.query(
      `INSERT INTO traceability_log
         (event_id, ingredient_id, recipe_id, lot_number, receiving_id, quantity_used, unit, used_by, guest_served, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [p.eventId, p.ingredientId, p.recipeId ?? null, lot.lot_number, lot.id, take, p.unit,
       p.usedBy ?? 'sistema (cierre automático)', p.guestServed ?? null, 'Consumo FEFO automático al cierre']
    );
    lotsUsed.push({ lotNumber: lot.lot_number, qty: take });
    remaining -= take;
  }

  return {
    consumedFromLots: Math.round((p.quantity - remaining) * 1000) / 1000,
    untracedQty: Math.round(Math.max(0, remaining) * 1000) / 1000,
    lotsUsed,
  };
}

/** Best-effort: resuelve un recipe_id para el traceability_log a partir del
 *  recipe_item_id de la línea del escandallo. Devuelve null si no hay
 *  correspondencia única (varias versiones de receta para el mismo plato). */
export async function resolveRecipeId(client: PoolClient, recipeItemId: string | null): Promise<string | null> {
  if (!recipeItemId) return null;
  const rows = (await client.query(
    `SELECT r.id FROM recipes r
     JOIN recipe_items ri ON ri.catalog_item_id = r.catalog_item_id
     WHERE ri.id = $1`,
    [recipeItemId]
  )).rows;
  return rows.length === 1 ? rows[0].id : null;
}
```

**FEFO (First-Expired-First-Out):** `ORDER BY expiry_date ASC NULLS LAST` — los lotes con caducidad más próxima se consumen primero; los lotes sin fecha de caducidad registrada van al final (no hay señal de urgencia, se asume que se cargaron sin ese dato). `received_date ASC` desempata lotes con la misma caducidad (o sin ella) por antigüedad de recepción (FIFO como criterio secundario). `FOR UPDATE OF rl` bloquea las filas de `receiving_log` implicadas — evita que dos cierres concurrentes consuman el mismo lote dos veces.

## G5.3 · Interceptación en `stockDeduct.ts`

Tras el bloque que ya llama a `adjustIngredientStock` (paso 4, sin tocarlo), añadir:

```ts
    // 4.5) G5 (Sprint 3): traza el consumo real a un lote concreto (FEFO).
    // Complementa el ledger (G6): el saldo ya se movió arriba; esto registra
    // QUÉ lote lo cubrió. Si el stock no viene de ningún lote registrado, se
    // reporta como traceGap en vez de inventarse un origen.
    const recipeId = await resolveRecipeId(getPool() as any, item.recipe_item_id ?? null);
    const trace = await consumeLotsFEFO(getPool() as any, {
      ingredientId: ingredient.id,
      eventId,
      quantity: deductionAmount,
      unit: ingredient.unit,
      recipeId,
      guestServed: event.guest_count ?? null,   // aproximación: raciones del evento, no por plato
    });
    if (trace.untracedQty > 0) {
      traceGaps.push(`${ingredient.name}: ${trace.untracedQty}${ingredient.unit} sin lote de origen registrado`);
    }
```

- Import nuevo en `stockDeduct.ts`: `import { consumeLotsFEFO, resolveRecipeId } from '@/lib/domain/lotTraceability';`.
- `item.recipe_item_id` — hay que añadirlo al `SELECT` del paso 1 (`event_shopping_items`), que hoy no lo trae.
- Se necesita `event.guest_count`: el `SELECT` del paso 0 (`SELECT id, stock_deducted FROM events...`) se amplía a `SELECT id, stock_deducted, guest_count FROM events...`.
- `traceGaps: string[]` se declara junto a `skipped`/`details` y se añade a `DeductionResult`:
  ```ts
  export interface DeductionResult {
    success: boolean;
    deducted: number;
    details: Array<{ ingredient_name: string; deducted_qty: number; unit: string }>;
    skipped?: string[];
    traceGaps?: string[];   // NUEVO — ingredientes cuyo consumo no se pudo trazar a un lote
    already_deducted?: boolean;
    error?: string;
  }
  ```
  y el `return` final añade `traceGaps: traceGaps.length ? traceGaps : undefined`.

**Por qué no bloquea el cierre:** un ingrediente sin lote de origen (p.ej. inventario inicial cargado antes de que existiera trazabilidad de lote) no debe impedir cerrar el evento — sería peor que el estado actual. `traceGaps` hace visible el hueco (en la respuesta de `close`/`fwd4`, y disponible para un futuro panel de alertas APPCC) en vez de fallar o de ocultarlo silenciosamente.

## G5.4 · Test Plan

Nuevo `scripts/verify-sprint3.sh` (sección G5), con reseed + registro deliberado de 2 lotes con caducidades distintas para el mismo ingrediente antes de cerrar:

- **AC-G5.1 · Consumo cubierto por un solo lote respeta FEFO.** Registrar lote A (caduca antes) y lote B (caduca después) para el mismo ingrediente, con stock suficiente en A. Cerrar el evento con demanda ≤ remaining(A) → 1 fila en `lot_consumption` (lote A), 0 en lote B.
- **AC-G5.2 · Consumo que cruza lotes reparte FEFO.** Demanda > remaining(A) y ≤ remaining(A)+remaining(B) → 2 filas en `lot_consumption` (A agotado, B parcial) y 2 filas en `traceability_log`, cantidades exactas.
- **AC-G5.3 · Sin lote suficiente → `untracedQty` reportado, no se inventa origen.** Demanda > remaining(A)+remaining(B) → el resto aparece en `traceGaps` de la respuesta de `/close`; `lot_consumption` solo tiene las filas de A+B agotados (nunca una fila fantasma).
- **AC-G5.4 · `traceability_log` alimenta el reporte existente.** `GET /api/trazabilidad/trace/[eventId]` (ya existente, sin cambios) muestra las líneas generadas automáticamente.
- **AC-G5.5 · Idempotencia.** Reintentar el cierre (ya `stock_deducted=true`) no duplica `lot_consumption`/`traceability_log` (la función ni se invoca — `deductStockForEvent` ya corta en el paso 0).
- **No-regresión:** las suites existentes (fixture sin lotes registrados antes del cierre) siguen en verde — la deducción cae íntegra a `traceGaps`, ninguna aserción actual comprueba ese campo.

---

# G8 · Contrato y firma de cliente

## G8.1 · SQL DDL

```sql
-- ============================================================
-- SPRINT 3 · G8 — Contrato de cliente + firma dibujada (patrón client_token)
-- ============================================================
CREATE TABLE IF NOT EXISTS event_contracts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    quote_id        UUID REFERENCES quotes(id) ON DELETE SET NULL,
    content_html    TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','signed','voided')),
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    signed_at       TIMESTAMPTZ,
    signed_by_name  TEXT,
    signed_by_nif   TEXT,
    -- D2: firma dibujada (canvas) — PNG en base64 (data URI), no un checkbox.
    signature_data  TEXT,
    signer_ip       TEXT,
    voided_at       TIMESTAMPTZ,
    voided_reason   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_contracts_event ON event_contracts(event_id);
-- Como mucho 1 contrato activo (pending o signed) por evento; anular
-- (status='voided') libera el hueco para generar uno nuevo si el evento se
-- renegocia (p.ej. tras INV-4 reabrir con cambio de precio).
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_contracts_active
  ON event_contracts(event_id) WHERE status != 'voided';
```

## G8.2 · Plantilla del contrato (D4: texto legal estándar)

Nuevo fichero **`src/lib/contractTemplate.ts`** — construye el HTML a partir del evento/presupuesto/pagos. D4: el usuario pidió redactar yo mismo un texto estándar; es un boilerplate razonable para un contrato de servicios de catering en España, **no sustituye la revisión de un abogado antes de usarlo en producción real** (se anota como comentario en el propio fichero para que quede visible a quien lo toque después):

```ts
/**
 * Texto legal estándar de un contrato de prestación de servicios de catering
 * (D4 — redactado como boilerplate razonable, NO revisado por un abogado;
 * el negocio debe validarlo legalmente antes de usarlo en producción real).
 */
const TERMS_HTML = `
  <h2>Términos y condiciones</h2>
  <ol>
    <li><b>Objeto.</b> El presente contrato regula la prestación de servicios de
    catering y organización del evento descrito, por parte de J. Benítez
    ("el Prestador") al cliente arriba indicado ("el Cliente"), en los
    términos y condiciones aquí recogidos y en el presupuesto aceptado que
    forma parte integrante de este documento.</li>
    <li><b>Precio y forma de pago.</b> El precio total del servicio es el
    indicado en el presupuesto aceptado. Salvo acuerdo distinto, el pago se
    realiza en dos plazos: un 40% en concepto de señal a la aceptación del
    presupuesto, y el 60% restante antes de la fecha del evento, según el
    calendario de pagos detallado en este documento.</li>
    <li><b>Modificaciones.</b> Cualquier cambio en el número de comensales,
    menú, fecha o condiciones del servicio deberá comunicarse por escrito y
    podrá dar lugar a un ajuste del precio, reflejado en un presupuesto
    actualizado.</li>
    <li><b>Cancelación.</b> En caso de cancelación por parte del Cliente, la
    señal entregada quedará en poder del Prestador en concepto de
    indemnización por los gastos de organización y reserva ya
    comprometidos, sin perjuicio de otras cantidades que pudieran adeudarse
    conforme a lo pactado.</li>
    <li><b>Alérgenos e intolerancias.</b> El Prestador elaborará el menú
    conforme a la información sobre alergias e intolerancias facilitada por
    el Cliente y sus invitados. El Prestador no se hace responsable de
    reacciones derivadas de información no comunicada con la antelación
    suficiente.</li>
    <li><b>Fuerza mayor.</b> Ninguna de las partes será responsable del
    incumplimiento de sus obligaciones cuando este se deba a causas de
    fuerza mayor ajenas a su voluntad.</li>
    <li><b>Protección de datos.</b> Los datos personales facilitados se
    tratarán conforme al Reglamento (UE) 2016/679 (RGPD) y la LOPDGDD, con
    la única finalidad de gestionar la relación contractual y la prestación
    del servicio.</li>
    <li><b>Jurisdicción.</b> Para cualquier controversia derivada de este
    contrato, ambas partes se someten a los Juzgados y Tribunales del
    domicilio del Prestador, con renuncia a cualquier otro fuero que
    pudiera corresponderles.</li>
  </ol>
`;

export function renderContractHtml(p: { event: any; quote: any; payments: any[] }): string {
  const { event, quote, payments } = p;
  const total = Number(quote?.total_pvp ?? event.total_pvp ?? 0).toFixed(2);
  const paymentRows = payments.map(pay =>
    `<tr><td>${pay.concept}</td><td>${Number(pay.amount).toFixed(2)} €</td><td>${pay.due_date ?? '—'}</td></tr>`
  ).join('');
  return `<!doctype html><html><head><meta charset="utf-8"></head><body>
    <h1>Contrato de prestación de servicios de catering</h1>
    <p><b>Cliente:</b> ${event.client_name} (${event.client_email})</p>
    <p><b>Evento:</b> ${event.event_type} — ${event.event_date} — ${event.guest_count} comensales</p>
    <p><b>Total presupuesto:</b> ${total} €</p>
    <h2>Calendario de pagos</h2>
    <table>${paymentRows}</table>
    ${TERMS_HTML}
  </body></html>`;
}
```

## G8.3 · Domain Logic

Nuevo fichero **`src/lib/domain/eventContract.ts`** — sin cambios respecto a la FASE 1 salvo que ahora se invoca bajo demanda (D3), no dentro de `acceptQuote`:

```ts
import type { PoolClient } from 'pg';
import { renderContractHtml } from '@/lib/contractTemplate';

/** Genera el contrato del evento si no existe uno activo (pending/signed).
 *  Idempotente: reintentar no duplica. Requiere que el evento ya esté
 *  aceptado (tiene client_token) — se valida en la ruta, no aquí. */
export async function generateEventContract(client: PoolClient, eventId: string) {
  const existing = (await client.query(
    `SELECT * FROM event_contracts WHERE event_id = $1 AND status != 'voided' LIMIT 1`,
    [eventId]
  )).rows[0];
  if (existing) return { contract: existing, created: false };

  const event = (await client.query(`SELECT * FROM events WHERE id = $1`, [eventId])).rows[0];
  const quote = (await client.query(
    `SELECT * FROM quotes WHERE event_id = $1 ORDER BY accepted_at DESC NULLS LAST, created_at DESC LIMIT 1`,
    [eventId]
  )).rows[0];
  const payments = (await client.query(
    `SELECT concept, amount, due_date FROM payments WHERE event_id = $1 ORDER BY due_date ASC NULLS LAST`,
    [eventId]
  )).rows;

  const html = renderContractHtml({ event, quote, payments });
  const created = (await client.query(
    `INSERT INTO event_contracts (event_id, quote_id, content_html, status)
     VALUES ($1, $2, $3, 'pending') RETURNING *`,
    [eventId, quote?.id ?? null, html]
  )).rows[0];
  return { contract: created, created: true };
}
```

## G8.4 · D3 — Generación bajo demanda (botón separado, NO dentro de `acceptQuote`)

`acceptQuote.ts` **no se toca**. En su lugar, nueva ruta de admin:

- `POST /api/events/[id]/contract/generate` — exige el evento en estado que ya tenga `client_token` (es decir, `accepted` en adelante — mismo campo que ya genera `acceptQuote`; si el evento no tiene `client_token` → 400 "El presupuesto debe estar aceptado antes de generar el contrato"). Llama a `generateEventContract(getPool(), eventId)` dentro de `transaction(...)` y devuelve `{ success: true, data: contract, created }`.

Esto deja la decisión de CUÁNDO enviar el contrato al cliente completamente en manos del negocio (un botón "Generar contrato" en la ficha del evento, a añadir en el futuro rediseño del admin — este Sprint entrega el backend + la página pública de firma).

## G8.5 · Rutas HTTP nuevas

**Públicas (token-scoped, mismo patrón que `guest-forms/decor/route.ts`):**
- `GET /api/contract/public/[token]` — devuelve `{ content_html, status, event: {client_name, event_date} }` buscando `events.client_token = token`. 404 si no hay evento con ese token; 404 si no hay contrato generado todavía (el admin no ha pulsado el botón).
- `POST /api/contract/public/[token]/sign` — body `{ signed_by_name, signed_by_nif, signature_data }` (D2: `signature_data` es el PNG en base64 exportado del canvas — `data:image/png;base64,...`). Valida que `signature_data` no esté vacío (una firma en blanco no es válida). Requiere contrato en `status='pending'` (409 si ya `signed`, 404 si no existe). Captura `signer_ip` de `x-forwarded-for`/`x-real-ip`. `UPDATE ... SET status='signed', signed_at=now(), signed_by_name=$1, signed_by_nif=$2, signature_data=$3, signer_ip=$4`.

**Admin (autenticado, patrón estándar del resto de rutas `/api/events/[id]/...`):**
- `POST /api/events/[id]/contract/generate` — ver G8.4.
- `GET /api/events/[id]/contract` — devuelve el contrato activo (o 404 si no se ha generado).
- `POST /api/events/[id]/contract/void` — body `{ reason }`. Marca `status='voided'`, `voided_at`, `voided_reason`. Libera el hueco para una futura regeneración (`generateEventContract` vuelve a crear uno `pending`).

## G8.6 · Frontend público — página de firma con pizarra (D2)

Nueva página **`src/app/contrato/[token]/page.tsx`** (`'use client'`, mismo patrón que `src/app/invitados/[token]/page.tsx`: `useParams()` para el token, marca J.Benitez gold/cream/ink, `Playfair Display` para títulos):

- Carga `GET /api/contract/public/[token]` al montar; si `status==='signed'` muestra un estado "ya firmado" (con fecha) en vez de la pizarra.
- Renderiza `content_html` dentro de un contenedor con estilos de solo lectura (p.ej. `dangerouslySetInnerHTML` en un `<div>` con `prose` — el HTML lo genera el propio backend, no el usuario, por lo que no hay riesgo de XSS de terceros).
- **Pizarra de firma**: un `<canvas>` con manejadores `pointerdown`/`pointermove`/`pointerup` (funciona con ratón y con el dedo en tablet/móvil — importante porque el cliente firma normalmente desde el móvil) que dibuja un trazo; botón "Borrar" (limpia el canvas) y campos de texto para `signed_by_name`/`signed_by_nif`.
- Al confirmar: `canvas.toDataURL('image/png')` → `POST /api/contract/public/[token]/sign` con `{signed_by_name, signed_by_nif, signature_data}`. Deshabilita el botón de envío si el canvas está vacío (comprobación simple: ¿se han registrado eventos de dibujo?) para no aceptar una firma en blanco.
- Tras firmar con éxito, sustituye la pizarra por una confirmación ("Contrato firmado el [fecha]").

## G8.7 · Test Plan

Sección G8 en `scripts/verify-sprint3.sh` (los tests a nivel de API simulan `signature_data` como un string base64 corto — no se renderiza un canvas real desde un script `curl`; la página en sí se verifica manualmente en navegador, ver §4):

- **AC-G8.1 · Generación bajo demanda.** `POST /api/events/:id/contract/generate` sobre un evento aceptado (con `client_token`) → 201/200, `event_contracts` tiene 1 fila `status='pending'`.
- **AC-G8.2 · No se genera automáticamente al aceptar (D3).** Tras `acceptQuote` (sin llamar al endpoint de arriba), `event_contracts` sigue vacío para ese evento.
- **AC-G8.3 · Idempotencia.** Repetir `POST .../contract/generate` no duplica la fila.
- **AC-G8.4 · Sin `client_token` → 400.** Intentar generar el contrato de un evento aún en `draft`/`sent` (sin `client_token`) → 400.
- **AC-G8.5 · Acceso público por token.** `GET /api/contract/public/:token` devuelve 200 con `content_html` no vacío y `status='pending'`.
- **AC-G8.6 · Token inválido → 404.**
- **AC-G8.7 · Firma correcta con `signature_data`.** `POST /api/contract/public/:token/sign {signed_by_name, signed_by_nif, signature_data}` → 200, `status='signed'`, `signature_data`/`signed_at`/`signed_by_name`/`signer_ip` no nulos.
- **AC-G8.8 · Firma en blanco rechazada.** `signature_data` vacío/ausente → 422, no se marca `signed`.
- **AC-G8.9 · Firmar dos veces → 409.**
- **AC-G8.10 · Admin ve el contrato.** `GET /api/events/:id/contract` (con sesión admin).
- **AC-G8.11 · Anular y regenerar.** `POST /api/events/:id/contract/void {reason}` → `voided`; `POST .../contract/generate` de nuevo crea un `pending` nuevo.
- **No-regresión:** ninguna ruta ni componente existente lee `event_contracts` — el gap es puramente aditivo; `acceptQuote.ts` no se modifica.

---

## 3. Resumen de cambios (inventario para la FASE 3)

| Tipo | Fichero | Cambio |
|---|---|---|
| Dominio (nuevo) | `src/lib/domain/lotTraceability.ts` | `consumeLotsFEFO` / `resolveRecipeId` |
| Lib (edit) | `src/lib/stockDeduct.ts` | trae `recipe_item_id`/`guest_count`, llama `consumeLotsFEFO` tras cada deducción, `traceGaps` en `DeductionResult` |
| DDL | `schema.sql` | tabla `event_contracts` (+índice de unicidad de contrato activo) |
| Lib (nuevo) | `src/lib/contractTemplate.ts` | `renderContractHtml` |
| Dominio (nuevo) | `src/lib/domain/eventContract.ts` | `generateEventContract` (idempotente) |
| Ruta (nueva) | `src/app/api/events/[id]/contract/generate/route.ts` | POST admin (D3 — botón separado) |
| Ruta (nueva) | `src/app/api/contract/public/[token]/route.ts` | GET público por `client_token` |
| Ruta (nueva) | `src/app/api/contract/public/[token]/sign/route.ts` | POST firma pública (con `signature_data`) |
| Ruta (nueva) | `src/app/api/events/[id]/contract/route.ts` | GET admin |
| Ruta (nueva) | `src/app/api/events/[id]/contract/void/route.ts` | POST admin (anular) |
| Frontend (nuevo) | `src/app/contrato/[token]/page.tsx` | página pública con pizarra de firma (canvas) |
| Test (nuevo) | `scripts/verify-sprint3.sh` | AC-G5.1..5 + AC-G8.1..11 |

**Garantía de idempotencia:** `consumeLotsFEFO` es aditivo por naturaleza (cada llamada solo se invoca una vez por deducción real, ya protegida por `stock_deducted`); `generateEventContract` comprueba existencia (`status != 'voided'`) antes de insertar, respaldado por el índice único parcial. `acceptQuote.ts` **no se toca** (D3).

## 4. Plan de validación (FASE 3, tras "SPEC Aprobado")
1. Añadir DDL de `event_contracts` a `schema.sql`; recrear `eventflow_verify`.
2. Crear `lotTraceability.ts` y editar `stockDeduct.ts` (G5) — punto de control / commit.
3. Crear `contractTemplate.ts`, `eventContract.ts`, las 5 rutas y la página `contrato/[token]` (G8) — punto de control / commit.
4. `npm run build` exit 0.
5. `scripts/verify-sprint3.sh` (G5: 5 criterios + G8: 11 criterios = 16).
6. Verificación manual en navegador de la página `contrato/[token]` (pizarra de firma real, dibujo con ratón, envío) — no solo el test de API con un `signature_data` simulado.
7. No-regresión completa: 32/32 · 41/41 · 14/14 · 17/17 · 26/26 (sprint1) · 27/27 (sprint2).
8. Commit + push a `main`; actualizar `docs/handoff.md`.

## 5. Decisiones de diseño — RESUELTAS por el usuario (D1–D4)

- **D1 · HTML, sin PDF real.** ✅ Confirmado.
- **D2 · Firma dibujada (canvas).** ✅ Confirmado — ver G8.1 (`signature_data`) y G8.6 (página con pizarra).
- **D3 · Botón separado (no dentro de `acceptQuote`).** ✅ Confirmado — ver G8.4 (`POST /api/events/[id]/contract/generate`).
- **D4 · Texto legal redactado por el Spec.** ✅ Hecho — ver G8.2 (`TERMS_HTML`). Boilerplate razonable, pendiente de revisión por un abogado antes de producción real.

---

**FIN DEL SPEC — SPEC Aprobado. Pasando a FASE 3 (implementación).**
