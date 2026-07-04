# Plan de Implementación: Correcciones de la Auditoría Adversarial (03/07/2026)

> **Para Hermes:** Usar subagent-driven-development para implementar este plan tarea por tarea, en el orden de las fases. Cada tarea corresponde a un hallazgo verificado línea por línea (fichero:línea citado) — no son sospechas, son defectos confirmados leyendo el código real y, en varios casos, reproducidos.
>
> **Objetivo:** Cerrar los 59 hallazgos de la auditoría exhaustiva del codebase EventFlow, priorizados por severidad (crítico → alto → medio → bajo/limpieza) y por tipo (mecánico → seguridad → flujos de usuario → integridad transaccional → incoherencias de diseño → documentación).
>
> **Disciplina de verificación (heredada del proyecto):** cada fase termina con `npx tsc --noEmit`, `npm run build`, y la batería de regresión existente (`scripts/verify-sprint1.sh` … `verify-sprint6.sh`, `verify-e2e.sh`, `verify-operativos.sh`, `verify-rbac-cocina.sh`, `verify-erp-conectado.sh` — 290/290 antes de empezar). **Nunca avanzar de fase con regresión en rojo.** Los scripts que reseeden internamente (sprint1-5, erp-conectado) son autocontenidos; `verify-e2e.sh`, `verify-operativos.sh` y `verify-rbac-cocina.sh` necesitan un reseed manual propio (`psql -f scripts/verify-ejemplo-e2e.sql`) inmediatamente antes de cada uno, sin nada más de por medio.
>
> **Tareas marcadas 🔸 requieren una decisión de negocio del usuario antes de implementar** (afectan a qué modelo de datos gana, o cambian comportamiento visible). Todas las demás son correcciones mecánicas o de gobernanza técnica sin ambigüedad.

---

## Fase 0: Confirmar en BD real antes de tocar nada

### Tarea 0.1 — Reproducir los crashes de esquema contra `eventflow_verify`

Antes de corregir, confirmar que cada uno de estos 6 caminos realmente crashea hoy (algunos son alcanzables solo bajo condiciones concretas):

```bash
# recipes INSERT (Tarea 1.1)
curl -s -X POST localhost:3939/api/cocina/recipes -H 'Content-Type: application/json' \
  -d '{"name":"Test","servings":4,"category":"carne","ingredients":[],"instructions":"x"}'

# payments/signal (Tarea 1.2)
curl -s -X POST localhost:3939/api/payments/signal -H 'Content-Type: application/json' \
  -d '{"event_id":"<uuid de un evento accepted>"}'

# ocr/apply rama sin match (Tarea 1.3)
curl -s -X POST localhost:3939/api/ocr/apply -H 'Content-Type: application/json' \
  -d '{"mode":"ticket_proveedor","items":[{"name":"ingrediente-inexistente-xyz","quantity":1,"unit":"kg","cost":5}]}'

# staffing/workers/[id]/contract (Tarea 1.4)
curl -s -X POST localhost:3939/api/staffing/workers/<id>/contract -H 'Content-Type: application/json' \
  -d '{"contract_url":"https://x.com/c.pdf","contract_name":"contrato.pdf"}'

# recipes.difficulty acentuado (Tarea 1.5)
curl -s -X PUT localhost:3939/api/cocina/recipes/<id> -H 'Content-Type: application/json' \
  -d '{"difficulty":"fácil"}'

# mapa-mesas assignments (Tarea 1.6)
curl -s localhost:3939/api/mapa-mesas/<eventId>/assignments
```

Documentar cuáles de estos 6 confirmaron 500 antes de pasar a la Fase 1 (algunos podrían llevar meses sin dispararse en producción real si nadie ha usado esa función — igual de importante corregirlos, pero ayuda a priorizar cuál doler más).

---

## Fase 1: Arreglos mecánicos de esquema (críticos, todos triviales de corregir)

### Tarea 1.1 — `recipes` INSERT: falta un placeholder

**Archivo:** `src/app/api/cocina/recipes/route.ts:162-181`

El INSERT declara 13 columnas pero solo 12 placeholders `$1`..`$12` — falta el de `published`. Añadir `$13` a la lista de VALUES y el valor correspondiente al array de parámetros.

**Verificación:** `POST /api/cocina/recipes` con un body válido debe devolver 201, no 500.

### Tarea 1.2 — `payments/signal`: columnas y estado inexistentes

**Archivo:** `src/app/api/payments/signal/route.ts:40,45`

```sql
-- Hoy (crashea):
UPDATE quotes SET deposit_paid = true, deposit_amount = $1 WHERE event_id = $2 AND status = 'accepted'
```

`quotes` no tiene `deposit_paid` ni `deposit_amount`. Decidir la representación correcta:
- Opción recomendada: añadir de verdad `deposit_paid BOOLEAN DEFAULT false` y `deposit_amount NUMERIC(12,2)` a `quotes` vía `schema.sql` (columna nueva, no requiere migración de datos existentes), y dejar que esta ruta las escriba como pretende.
- Alternativa: derivar "señal pagada" de la tabla `payments` (ya existe `concept='Señal (40% del presupuesto)'` con `paid boolean`) en vez de un campo redundante en `quotes` — más coherente con el resto del sistema de pagos, pero requiere reescribir el endpoint para leer/escribir contra `payments` en vez de añadir columnas nuevas.

Además, la misma función llama a `setEventStatus(eventId, 'presupuestado', ...)` — `'presupuestado'` es un valor de `leads.status`, no de `events.status` (violación de CHECK). Corregir a un valor real del enum de `events.status` (revisar qué transición semántica corresponde — probablemente no debería tocar `events.status` en absoluto si el evento ya está `accepted`, solo registrar el pago).

**Efecto colateral a limpiar:** `src/lib/domain/eventState.ts` tiene `'presupuestado'` baked into `VALID_TRANSITIONS['FWD-4'].from` y `VALID_EVENT_STATUSES` — eliminarlo de ambos una vez decidida la opción de arriba, ya que ahora mismo la propia whitelist permite un estado que nunca debería llegar a `events.status`.

**Efecto colateral en frontend:** `src/components/b2b/EventDetail.tsx:559,568,573,586,615,618` lee `quote.deposit_paid/deposit_amount/deposit_pct` — actualizar para leer la fuente que se decida arriba.

**Verificación:** `POST /api/payments/signal` sobre un evento `accepted` debe devolver 200 y el banner "señal pagada" de `EventDetail` debe activarse.

### Tarea 1.3 — `stock_entries.cost_price` no existe

**Archivo:** `src/app/api/ocr/apply/route.ts:224`

Rama "ingrediente no encontrado" del OCR. `stock_entries` solo tiene `id, ingredient_id, event_id, quantity, unit, movement_reason, notes, created_at` — quitar `cost_price` del INSERT (y de la lista de columnas), o añadir la columna a `schema.sql` si de verdad se necesita guardar el coste de un ítem sin matchear (recomendado: guardarlo en `notes` como ya hace el resto de esta rama, ver línea 224 vs 231 — está duplicado, basta con quitar la columna inexistente).

**Verificación:** `POST /api/ocr/apply` con un ítem que no matchee ningún ingrediente debe devolver 200, no 500.

### Tarea 1.4 — `workers.contract_url` / `contract_name` no existen

**Archivo:** `src/app/api/staffing/workers/[id]/contract/route.ts:64,86,99` + `src/app/api/staffing/workers/route.ts` (GET)

Añadir a `schema.sql`:
```sql
ALTER TABLE workers ADD COLUMN IF NOT EXISTS contract_url TEXT;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS contract_name TEXT;
```
Y añadir ambas columnas al SELECT de `GET /api/staffing/workers` (hoy las omite, así que `StaffingManager.tsx` nunca ve el enlace de contrato ni con el crash corregido).

**Verificación:** subir y borrar un contrato de trabajador debe funcionar de punta a punta; el badge/enlace en `StaffingManager.tsx` debe reflejar el estado real.

### Tarea 1.5 — `recipes.difficulty`: acentuado vs. sin acentuar

**Archivos:** `src/app/api/cocina/recipes/route.ts:44,66`, `src/app/api/cocina/recipes/[id]/route.ts:96`, `schema.sql:1092`

El zod acepta `'fácil'|'media'|'difícil'`; el CHECK de la BD solo permite `'facil'|'media'|'dificil'`. Elegir una única forma canónica (recomendado: mantener el CHECK sin acentuar, que es lo que ya persiste la BD, y corregir el zod para que coincida) y aplicarla en ambos lados. Si la UI muestra el valor con acento, hacerlo solo como label de presentación, nunca como el valor almacenado.

**Verificación:** crear/editar una receta con dificultad "fácil" desde la UI debe persistir sin 500.

### Tarea 1.6 — `guests.dietary_restrictions` / `guests.allergens` no existen

**Archivo:** `src/app/api/mapa-mesas/[eventId]/assignments/route.ts:15-16`

`guests` solo tiene `dietary JSONB`. Corregir el JOIN para seleccionar `g.dietary` (y adaptar el frontend consumidor si espera campos separados) en vez de las dos columnas inexistentes.

**Verificación:** `GET /api/mapa-mesas/[eventId]/assignments` debe devolver 200.

### Tarea 1.7 — `cocina/passes` PUT: enum de categorías equivocado

**Archivo:** `src/app/api/cocina/passes/route.ts:8-16`

```ts
// Hoy (categorías de equipamiento, equivocado):
category: z.enum(['utensilio','vajilla','maquinaria','textil','mobiliario','descartable','catalog_item'])
// Debe ser (categorías de plato, las de category_pass_mapping/catalog_items):
category: z.enum(['aperitivo-frio','aperitivo-caliente','compartir-mesa','arroz','carne','pescado','sorbete','postre','bebida','complemento'])
```

**Verificación:** el editor de asignación de pases (AC5.1) debe aceptar un PUT real con una categoría de plato.

### Tarea 1.8 — `convert_uom` no reconoce la unidad "docena"

**Archivo:** `schema.sql` (seed de `units_of_measure`) + `src/lib/recipeImport.ts:19-25,60-64`

`UNIT_ALIASES` normaliza `docena/docenas/doc` → `'doc'` y lo persiste, pero `units_of_measure` solo tiene `kg,g,l,ml,ud` — `convert_uom` cae en su fallback "sin factor, devuelve tal cual", corrompiendo en silencio el cálculo de `inventory_commitments` para cualquier receta importada con unidad de docena.

Sembrar `units_of_measure` con la conversión real (`doc` → `ud`, factor 12) o, si no se quiere soportar la unidad, hacer que `normalizeUnit`/`convert_uom` lancen un error explícito en vez de devolver el número sin convertir en silencio.

**Verificación:** importar una receta con una cantidad en docenas y comprobar que `inventory_commitments`/el aviso de faltante de stock usa el valor multiplicado por 12, no el crudo.

**Fin de Fase 1 — checkpoint:** typecheck + build + regresión completa (290/290) + commit.

---

## Fase 2: Seguridad

### Tarea 2.1 — Inyección SQL en `appcc/[resource]`

**Archivo:** `src/app/api/appcc/[resource]/route.ts:147-174`

- `ORDER BY`/`LIMIT`: sustituir la concatenación de `sp.get('order')`/`sp.get('limit')` por una whitelist explícita de columnas ordenables por recurso (mismo patrón de allowlist que ya usan otras rutas del proyecto) y un `LIMIT $n` parametrizado con un tope duro (p.ej. máx. 500).
- INSERT dinámico: sustituir `Object.keys(body)` por un mapa explícito `resource → columnas permitidas` (allowlist por tabla), rechazando cualquier clave fuera de esa lista con 422.

**Verificación:** `GET /api/appcc/plans?order=(SELECT 1)` debe devolver 400/422, no ejecutar la subquery. Un POST con una clave no permitida (`id`, cualquier FK) debe rechazarse.

### Tarea 2.2 — Filtro genérico de `appcc/[resource]` asume columnas que no existen en 7 de 10 tablas

**Archivo:** `src/app/api/appcc/[resource]/route.ts:35-65` (mismo fichero que 2.1, resolver juntas)

Reemplazar el filtro ciego por columna-por-recurso: definir en el mapa de handlers (`h`) qué filtros son válidos para cada tabla (`status`, `recorded_at`/`used_at`/`performed_at`/`calibration_date` según corresponda, `event_id`, `ingredient_id`), e ignorar/422 los que no apliquen.

**Verificación:** `GET /api/appcc/limits?status=x`, `/calibration?status=x`, `/suppliers?event_id=x`, `/monitoring?event_id=x` deben devolver 200 (ignorando el filtro no aplicable) o 422 explicativo, nunca 500.

### Tarea 2.3 — Webhook de WhatsApp staffing acepta peticiones sin firmar

**Archivo:** `src/app/api/webhooks/whatsapp-staffing/route.ts:36-52`

```ts
// Hoy:
if (signature && process.env.WHATSAPP_APP_SECRET) { /* verifica */ }
// sigue adelante si falta `signature`, sin verificar nada
```

Cambiar a fail-closed: si `WHATSAPP_APP_SECRET` está configurado, la ausencia de `signature` (o una firma inválida) debe rechazar con 401, sin ejecutar `processMessage()`. Si el secreto no está configurado en absoluto, considerar rechazar también en producción (`NODE_ENV==='production'`) en vez de procesar sin ninguna verificación.

**Verificación:** una petición POST sin `x-hub-signature-256` debe devolver 401 cuando `WHATSAPP_APP_SECRET` está definido.

### Tarea 2.4 — 3 de 4 endpoints de cron sin `isCronAuthorized`

**Archivos:** `src/app/api/cron/payment-reminders/route.ts`, `src/app/api/cron/post-event-followup/route.ts`, `src/app/api/cron/pre-event-reminders/route.ts`

Añadir al inicio de cada handler, igual que ya hace `cron/pre-event-briefing/route.ts`:
```ts
if (!isCronAuthorized(request)) {
  return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
}
```

**Verificación:** las 3 rutas deben devolver 401 sin la cabecera/secreto de cron; el cron real (con secreto) debe seguir funcionando.

### Tarea 2.5 — Sin rate limiting en `/api/auth/login`

**Archivo:** `src/app/api/auth/login/route.ts`

Aplicar `checkRateLimit()` (ya usado en `ai-quote`/`whatsapp/inbound`) por IP y, si es viable, también por `username` intentado, con backoff. Considerar bloqueo temporal tras N intentos fallidos consecutivos.

**Verificación:** más de N intentos de login fallidos en poco tiempo desde la misma IP deben devolver 429.

### Tarea 2.6 — `isPublicRoute()` en `middleware.ts` es código muerto

**Archivo:** `src/middleware.ts:79-94`

Nunca se llama — solo `isPublicMethod()` protege de verdad. Eliminarla (si de verdad es redundante tras confirmar que ambas listas coinciden hoy) o, si se prefiere conservarla como única fuente de verdad, cablearla de vuelta en `middleware()` y eliminar `isPublicMethod()`. No dejar dos listas de "rutas públicas" donde solo una se ejecuta.

**Verificación:** repasar manualmente que ninguna ruta pública real (guest-forms/decor, quotes/public, contract/public, cron, webhooks) quede bloqueada tras la limpieza.

### Tarea 2.7 — Invoices filtra excepciones crudas

**Archivo:** `src/app/api/invoices/route.ts:37,110`

Sustituir `{ error: String(error) }` por `{ success: false, error: sanitizeError(error) }`, igual que el resto de rutas de facturación/pagos.

**Verificación:** forzar un error (p.ej. UUID inválido) y confirmar que la respuesta no incluye texto crudo de Postgres.

### Tarea 2.8 (opcional, bajo impacto) — Endurecer detalles menores

- `src/app/api/auth/login/route.ts:25` — sustituir `password === adminPassword` por `crypto.timingSafeEqual` (con padding de longitud) para el admin maestro.
- `src/lib/security.ts:78-85` — documentar/validar que `x-forwarded-for` solo se confía detrás de un proxy conocido, o usar la IP de conexión directa como fallback.
- `src/app/api/webhooks/whatsapp-staffing/route.ts:25` — quitar el fallback hardcodeado `'eventflow-verify'`; exigir la variable de entorno en producción.
- ~36 rutas con manejo de errores inconsistente (`error.message` crudo, sin `success`) — normalizar a `sanitizeError()` + `{success:false,error}` en un barrido mecánico (lista completa en el informe de auditoría, sección Seguridad).

**Fin de Fase 2 — checkpoint:** typecheck + build + regresión completa + commit.

---

## Fase 3: Flujos de usuario rotos (frontend)

### Tarea 3.1 — 🔸 El camino principal del configurador público envía presupuestos a 0€

**Archivos:** `src/components/b2c/WizardStep2.tsx:54-68` (`handleUseMenu`), `src/store/useWizardStore.ts:367-383` (`submit()`)

**Decisión de negocio:** ¿"Usar este Menú" debe fijar el precio del menú propuesto (recomendado, es la lectura natural del botón) o debe forzar al usuario por el camino de "Personalizar Menú" para poder calcular un precio? Recomendado: que `handleUseMenu` rellene `step3.selected_items` con los platos reales del menú elegido (igual que ya hace `handleCustomizeMenu`), y que `submit()` incluya `menu_id` en el payload final (`EventSetupCreateSchema`/`POST /api/events` ya lo aceptan, solo falta que el store lo envíe).

**Verificación:** completar el wizard eligiendo "Usar este Menú" debe crear un evento con `total_pvp > 0`, `selected_items` no vacío, y `menu_id` no nulo; la página pública `/evento/[id]` debe mostrar el nombre real del menú, no "Personalizado".

### Tarea 3.2 — Extras del paso 4 del wizard no llegan al backend

**Archivos:** `src/components/b2c/WizardStep4.tsx:16,26-33`, `src/store/useWizardStore.ts` (`submit()`)

`step4.selected_suggestions`/`suggestions` nunca se leen en `submit()`. Incluirlas en el payload de `/api/events`, mapeadas a `selected_items` adicionales (con lookup de precio contra el catálogo, igual que el resto de items) para que se facturen y aparezcan para cocina.

**Verificación:** marcar una estación extra en el paso 4 y confirmar que aparece en `selected_items` del evento creado y en su coste total.

### Tarea 3.3 — 🔸 `bar_hours`/`bar_price` sin control en el wizard público

**Archivo:** `src/components/b2c/WizardStep4.tsx:30`

**Decisión de negocio:** ¿el público debe poder elegir horas de barra libre (0-3h, con `BAR_PRICES` ya definido en `types/specs.ts`), o esto es intencionalmente solo gestionable por un admin después? Si lo primero: añadir un selector real en el paso 4. Si lo segundo: quitar el campo del schema del wizard para no dejar la falsa impresión de que existe.

### Tarea 3.4 — Wizard permite elegir una fecha de evento pasada

**Archivo:** `src/components/b2c/WizardStep1.tsx`, `src/types/specs.ts` (`WizardStep1Schema`)

Añadir validación `event_date >= hoy` tanto en `canProceed` (paso 1) como en el schema zod (`.refine`), para que tampoco se pueda saltar por una llamada directa a la API.

**Verificación:** intentar avanzar con una fecha de ayer debe bloquear el botón "Siguiente" con un mensaje claro.

### Tarea 3.5 — OperationsManager: "Finalizar Evento" inalcanzable

**Archivo:** `src/components/b2b/OperationsManager.tsx`

`setShowComplete(true)` no se llama desde ningún sitio. Añadir el botón/acción que lo dispare (probablemente en la vista de detalle del evento, junto al resto de acciones de estado, visible cuando `selected.status === 'in_progress'`).

**Verificación:** desde un evento en curso, debe poder abrirse el modal de finalización, completar los "Consumos Extra", y persistirlos vía `handleComplete`.

### Tarea 3.6 — OperationsManager: eliminar camarero es solo local

**Archivo:** `src/components/b2b/OperationsManager.tsx:319-323` + `src/app/api/waiters/route.ts`

Añadir un DELETE real: al eliminar un camarero en la UI, llamar a `DELETE /api/waiters?id=` (ya existe el endpoint DELETE, solo falta que la UI lo use) en vez de solo mutar el estado local. Revisar también `renameWaiter` para que el guardado posterior no deje filas huérfanas con el nombre antiguo (borrar-y-recrear o hacer el upsert por `id`, no por `name`).

**Verificación:** eliminar un camarero, guardar, recargar la página — no debe reaparecer. Renombrar dos veces seguidas no debe dejar 2 filas.

### Tarea 3.7 — TrazabilidadPanel: "Nueva recepción" busca en un endpoint inexistente

**Archivo:** `src/components/b2b/TrazabilidadPanel.tsx:323-346` + crear `src/app/api/ingredients/route.ts` (o corregir el path si el endpoint real tiene otro nombre)

Revisar si existe ya una ruta equivalente de búsqueda de ingredientes (el informe de auditoría apunta a que `GET /api/stock` ya soporta "buscar por nombre/proveedor" según su propio docstring) y apuntar el fetch ahí, o crear el endpoint faltante si de verdad no existe ninguno.

**Verificación:** en el diálogo "Nueva recepción", escribir el nombre de un ingrediente existente debe mostrarlo en el desplegable y permitir seleccionarlo; el formulario debe poder enviarse.

### Tarea 3.8 — EventDetail: "Recalcular escandallo" llama a una ruta inexistente

**Archivo:** `src/components/b2b/EventDetail.tsx:1106-1119` + `src/app/api/escandallo/[eventId]/freeze/route.ts`

La rama "recalc" ya existe dentro de `freeze/route.ts` pero es inalcanzable (Next.js no matchea `/freeze/recalc` como subruta). Dos opciones:
- Crear un fichero de ruta real `src/app/api/escandallo/[eventId]/freeze/recalc/route.ts` que delegue en la lógica ya escrita, o
- Cambiar el fetch del frontend para pasar un parámetro (`?action=recalc` o body `{action:'recalc'}`) contra la ruta `freeze` existente, coherente con cómo esa rama ya distingue internamente entre freeze/recalc.

**Verificación:** el botón "Recalcular escandallo" debe regenerar `event_shopping_items` desde las recetas activas y refrescar la ficha del evento.

### Tarea 3.9 — LeadsCRM: "Aceptar Presupuesto" puede aceptar el equivocado

**Archivo:** `src/components/b2b/LeadsCRM.tsx:266-321`

`acceptQuote(quoteId)` descarta el id recibido; `handleConvert` vuelve a buscarlo con un `.find()`. Pasar el `quoteId` real hasta `handleConvert` (vía estado o parámetro) y usarlo directamente en vez de re-derivarlo.

**Verificación:** con un lead que tenga 2+ presupuestos, aceptar explícitamente el segundo debe convertir ese, no el primero que matchee `sent`/`draft`.

### Tarea 3.10 — LeadsCRM: fallos silenciosos sin feedback

**Archivo:** `src/components/b2b/LeadsCRM.tsx:226-264,273-321,197-203,323-344`

Añadir manejo de error (try/catch + `setError`/toast visible) a `createQuote`, `handleConvert`, `updateStatus`, `sendQuote`, `updateQuotePrice` — hoy varias de estas funciones no tienen ni siquiera un `catch`.

**Verificación:** forzar un fallo de red (DevTools offline) al crear un presupuesto debe mostrar un mensaje de error visible, no fallar en silencio.

### Tarea 3.11 — KanbanPipeline: "Aceptar" siempre muestra éxito optimista

**Archivo:** `src/components/b2b/KanbanPipeline.tsx:551-562` (`moveEvent`)

Comprobar `res.ok`/`data.success` tras el `fetch`; si falla (409 por conflicto de stock/salón, u otro error), revertir la actualización optimista de `events` y mostrar el mensaje de error real devuelto por la API en vez de dejar la tarjeta en la columna nueva.

**Verificación:** provocar un 409 real (evento con faltante de stock bloqueante) y confirmar que la tarjeta vuelve a su columna original con un mensaje de error visible.

### Tarea 3.12 — AutomationRules: toggle silencioso

**Archivo:** `src/components/b2b/AutomationRules.tsx:446-465`

Añadir feedback de error visible cuando el PUT de activar/desactivar una regla falla, en vez de solo revertir el switch en silencio.

### Tarea 3.13 — 🔸 BudgetEditor: "Enviar presupuesto" permanentemente deshabilitado en borradores desde lead

**Archivo:** `src/components/b2b/BudgetEditor.tsx:435-436` (toca directamente el trabajo de Sprint 6 F3.1 — revisar con cuidado)

`simpleMode` (borrador) oculta toda edición de platos, pero el botón de envío exige `items.length > 0`. Decidir: si en `simpleMode` el envío se hace por precio+comensales (sin desglose de platos, que es la premisa de F3.1), el `disabled` de este botón no debería depender de `items.length` en absoluto en ese modo — debería depender de que `priceOverride > 0` y `guestCount > 0`. Corregir la condición del botón para reflejar la lógica real de `simpleMode` en vez de la heredada de modo completo.

**Verificación:** un lead convertido a evento en `draft` (con `selected_items: []`) debe poder enviarse el presupuesto una vez fijados comensales y precio, sin necesidad de añadir platos.

**Fin de Fase 3 — checkpoint:** typecheck + build + verificación manual de cada flujo tocado (esta fase es la más sensible a UX, no basta con los scripts de regresión) + regresión completa + commit.

---

## Fase 4: Integridad transaccional del dominio

### Tarea 4.1 — `closeEvent.ts` sin transacción

**Archivo:** `src/lib/domain/closeEvent.ts:19-137`

Envolver los 6 pasos (`freezeEscandallo`, actualizar `event_orders`, `createInvoice`, `deductStockForEvent`, `setEventStatus`, `audit_log`) en un único `transaction(async (client) => {...})`, pasando ese `client` a cada función interna en vez de dejar que cada una use `getPool()`/statements sueltos. Prestar atención especial a `createInvoice`'s `MAX(...)+1` — considerar además un `SELECT ... FOR UPDATE` o una secuencia real de Postgres para evitar colisión de número de factura bajo concurrencia, ya que envolver en transacción reduce pero no elimina la ventana de carrera de un cálculo basado en `MAX`.

**Verificación:** cerrar dos eventos concurrentemente (simulado con 2 llamadas en paralelo) no debe dejar ningún evento a medio cerrar (escandallo congelado sin factura); si algo falla, todo el cierre debe revertirse.

### Tarea 4.2 — 🔸 El Kanban tiene un segundo camino para "cerrar evento", divergente de `closeEvent.ts`

**Archivos:** `src/app/api/events/[id]/route.ts:319-331`, `src/components/b2b/KanbanPipeline.tsx:551-561` (columna "Realizado")

**Decisión de negocio:** ¿arrastrar una tarjeta a "Realizado" debe ejecutar el cierre completo y gobernado (`closeEvent`/`FWD-4`), o debe eliminarse esa transición del Kanban y forzar que el cierre solo se haga desde el botón dedicado en la ficha del evento? Recomendado: que el drag-and-drop a esa columna dispare la misma transición `FWD-4` que ya existe en `transitions/route.ts` (con su `motivo`/validación si aplica), en vez de un `PUT {status:'completed'}` directo. Esto también resuelve de raíz el hallazgo de "incoherencia de diseño" 06.3 (dos niveles de gobernanza para cambiar el estado de un evento).

**Verificación:** arrastrar una tarjeta a "Realizado" debe generar factura, congelar el escandallo, y quedar auditado exactamente igual que el cierre desde la ficha del evento.

### Tarea 4.3 — Bloqueo de fila neutralizado en cierres concurrentes

**Archivo:** `src/lib/stockDeduct.ts:148`

```ts
// Hoy: getPool() as any — el FOR UPDATE de adjustIngredientStock no protege nada
const adj = await adjustIngredientStock(getPool() as any, {...});
```

Corregir para que `deductStockForEvent` reciba y propague un `client` transaccional real (coherente con la Tarea 4.1 — si `closeEvent` ya abre una transacción y se la pasa, este bug se resuelve como efecto colateral).

**Verificación:** dos deducciones de stock concurrentes sobre el mismo ingrediente (dos eventos cerrados casi a la vez) no deben perderse una a la otra — el saldo final debe reflejar ambas deducciones.

### Tarea 4.4 — INV-2 no libera la reserva de salón

**Archivo:** `src/app/api/events/[id]/transitions/route.ts` (función `inv2`)

Añadir `await releaseVenue(getPool(), event.id);`, igual que ya hacen `inv1` e `inv3`.

**Verificación:** revertir un evento aceptado (INV-2) y comprobar que su salón/fecha vuelve a estar disponible para un evento distinto.

### Tarea 4.5 — Sin bloqueo en la comprobación de faltante de stock

**Archivo:** `src/lib/domain/inventoryCommitment.ts` (`commitInventoryForEvent`, `checkInventoryShortages`)

Añadir `SELECT ... FOR UPDATE` sobre las filas de `ingredients` relevantes (o un lock advisory por `ingredient_id`) antes de comparar disponible vs. comprometido, dentro de la misma transacción de `acceptQuote`.

**Verificación:** dos aceptaciones de presupuesto concurrentes que reclaman el mismo ingrediente escaso — con `block_accept_on_stock_shortage=true` — no deben poder pasar ambas la comprobación.

### Tarea 4.6 — `'paid'` sin transición de salida + forzable sin gobernanza

**Archivos:** `src/lib/domain/eventState.ts` (`VALID_TRANSITIONS`), `src/app/api/invoices/[id]/route.ts:56-58`

- Añadir una transición real de salida desde `'paid'` (p.ej. `INV-6: {from:['paid'], to:'reopened'}`, reutilizando la lógica de `INV-4`).
- En `invoices/[id]/route.ts`, antes de `setEventStatus(invoice.event_id, 'paid')`, comprobar el estado actual del evento asociado y rechazar si no es una transición válida (o delegar en el dispatcher de `transitions/route.ts` en vez de escribir el estado directamente).

**Verificación:** un evento `'paid'` debe poder reabrirse por un camino gobernado; marcar una factura de un evento `cancelled`/`lost` como pagada no debe forzar `events.status='paid'` sin control.

### Tarea 4.7 — INV-5 no es atómica

**Archivo:** `src/app/api/events/[id]/transitions/route.ts:299-319`

Envolver `createInvoice` + `recordPayment` (rama `diffAmount > 0`) en una única `transaction()`.

### Tarea 4.8 — Recálculo de escandallo silencioso en FWD-3

**Archivo:** `src/app/api/events/[id]/transitions/route.ts:117-123`

Si `recalcEventEscandallo` falla, además del `console.warn`, escribir una entrada en `audit_log` o marcar el evento con un flag visible ("coste puede estar desactualizado") para que no sea puramente invisible.

**Fin de Fase 4 — checkpoint:** typecheck + build + regresión completa + pruebas de concurrencia manuales donde aplique (4.1, 4.3, 4.5) + commit.

---

## Fase 5: Incoherencias de diseño (requieren decisión, mayor alcance)

### Tarea 5.1 — 🔸 Unificar el modelo de "camarero de este evento"

**Archivos:** `src/app/api/waiters/route.ts`, tabla `waiters`, vs. `workers`+`staffing_lines`+`staffing_assignments`, consumido por `src/components/b2b/OperationsManager.tsx`

**Decisión de negocio:** ¿`OperationsManager` (asignación de mesas/camareros) debe pasar a leer/escribir contra `staffing_lines`/`staffing_assignments`/`workers` (el modelo "real", usado por nómina/briefing/WhatsApp), eliminando la tabla `waiters` por completo? Es el camino recomendado dado que ya hay un comentario en el propio código (`event-orders/[id]/waiters/route.ts:15-17`) documentando que el modelo antiguo fue reemplazado — solo faltó terminar la migración en esta pantalla. Alcance: reescribir la carga/guardado de camareros en `OperationsManager.tsx` para usar `/api/staffing/lines`/`/api/staffing/lines/[id]/assignments` en vez de `/api/waiters`, y eliminar `src/app/api/waiters/route.ts` + la tabla `waiters` de `schema.sql` una vez migrado.

**Verificación:** un trabajador dado de alta en `staffing_lines` debe aparecer disponible para asignar a una mesa en `OperationsManager`, y viceversa — un único roster.

### Tarea 5.2 — 🔸 Consolidar el modelo de "plano de mesas" (4 tablas → 1)

**Archivos:** `src/app/api/plans` (sobre `table_plans`), `src/app/api/floor-plan` (sobre `table_plans` y `floor_plans`), `src/app/api/mapa-mesas/[eventId]` (sobre `event_floorplans`), más la tabla `tables` usada directamente en `generate-operations`/`briefing`/`trace`

Ya documentado como "no tocar en un sprint, abordar con su propio Spec dedicado" (`docs/handoff.md`, Nivel C). **No implementar directamente en este plan** — requiere su propia auditoría de qué pantallas leen de cuál tabla hoy, con qué datos reales, antes de decidir cuál gana. Registrar como pendiente de Spec propio, no como tarea ejecutable aquí.

Eliminar de paso el fichero vestigial `src/app/api/plans/schema.sql` (duplicado exacto de la definición de `table_plans` ya en `schema.sql`, nunca ejecutado por ningún código) una vez confirmado que no lo referencia ningún proceso de despliegue externo al repo.

### Tarea 5.3 — Verificar que la Tarea 4.2 resuelve la doble gobernanza de cambio de estado

Sin tarea adicional — este ítem de incoherencia de diseño (06.3 del informe) se resuelve como efecto directo de la Tarea 4.2. Marcar como cerrado tras verificar 4.2.

**Fin de Fase 5 — checkpoint:** cada tarea 🔸 requiere aprobación explícita del usuario antes de tocar código (mismo patrón SDD del resto del proyecto: FASE 1 spec → "SPEC Aprobado" → FASE 3 implementación).

---

## Fase 6: Limpieza de código y esquema muerto (baja prioridad, opcional)

| # | Qué eliminar / resolver | Archivo(s) |
|---|---|---|
| 6.1 | `TableMapEditor.tsx` (0 importadores) + rama inalcanzable en `admin/page.tsx:111` | `src/components/b2b/TableMapEditor.tsx`, `src/app/admin/page.tsx` |
| 6.2 | `DishCard.tsx` / `MenuCard.tsx` (0 importadores) | `src/components/b2c/` |
| 6.3 | `handleDeleteItem` sin cablear en CatalogCRUD (decidir si se expone o se borra la función) | `src/components/b2b/CatalogCRUD.tsx:195-203` |
| 6.4 | ~275 líneas muertas de `DiaDView` + su store en localStorage | `src/components/b2b/CalendarView.tsx:1180-1455` |
| 6.5 | 🔸 Unificar `DiaDChecklist.tsx` (BD) y `ChecklistPanel.tsx` (localStorage) — decidir cuál gana | `src/components/b2b/{DiaDChecklist,ChecklistPanel}.tsx` |
| 6.6 | Permitir eliminar tareas personalizadas del checklist (falta botón + endpoint DELETE) | `src/components/b2b/DiaDChecklist.tsx`, `src/app/api/checklist/route.ts` |
| 6.7 | 6 rutas API sin ningún llamador — confirmar y eliminar o documentar como reservadas | `/api/plans`, `/proposed-menus`, `/event-plans(+[id])`, `/stock/uom`, `/bar-config`, `/mapa-mesas/page` |
| 6.8 | Regla de RBAC huérfana para `/api/plans` | `src/lib/rbac.ts` |
| 6.9 | 5 tablas APPCC con POST genérico sin productor real en la UI — decidir si se construye la UI o se elimina el esquema | `haccp_plans`, `haccp_critical_limits`, `haccp_monitoring`, `supplier_approval`, `haccp_equipment_calibration` |
| 6.10 | `recipe_item_versions` nunca escrita — decidir si se implementa el versionado o se elimina la tabla | `schema.sql` ~1757-1767 |
| 6.11 | 13 primitivas de `ui/` sin usar (dropdown-menu, switch, toast, tooltip, checkbox, popover, scroll-area, separator, avatar, accordion, DataCard, DataList, Spinner) — al menos sustituir el checkbox hand-rolled del wizard por el compartido | `src/components/ui/`, `src/components/b2c/WizardStep3.tsx`/`WizardStep4.tsx` |
| 6.12 | Email de contacto `info@alborotoeventos.es` no coincide con la marca "J. Benitez" del resto del sitio público | `src/components/b2c/LandingFooter.tsx:33` |

---

## Fase 7: Corrección de documentación

### Tarea 7.1 — `docs/auditoria-erp-2026-06.md` presenta como abiertos 4 gaps ya cerrados

Añadir una nota al principio del documento (o una sección "Estado post-Sprint 1-4") marcando explícitamente G8 (firma de contrato), G1 (doble reserva de salón), G2 (avisos de faltante de stock) y G3 (coste de personal en margen) como **cerrados**, con referencia a qué Sprint/commit los cerró, dejando claro que G4 (pasarela de pago) y G17 (gobernanza de transiciones de estado) siguen genuinamente abiertos.

### Tarea 7.2 — `SPEC-Sprint6-Cocina-APPCC.md` con cabecera desactualizada

Actualizar la cabecera ("FASE 1, sin cambios de código todavía") para reflejar que el sprint fue completado e implementado (referenciar `docs/handoff.md`), o archivar el fichero con una nota clara de "spec histórica, ver handoff.md para el estado real".

---

## Resumen de tareas por fase

| Fase | Nº tareas | Naturaleza | Requiere decisión 🔸 |
|---|---|---|---|
| 0 | 1 | Validación en BD real | No |
| 1 | 8 | Arreglos mecánicos de esquema (crítico) | No |
| 2 | 8 | Seguridad | No |
| 3 | 13 | Flujos de usuario rotos | 3 (3.1, 3.3, 3.13) |
| 4 | 8 | Integridad transaccional del dominio | 1 (4.2) |
| 5 | 3 | Incoherencias de diseño | 2 (5.1, 5.2 diferida a Spec propio) |
| 6 | 12 | Limpieza de código/esquema muerto | 1 (6.5) |
| 7 | 2 | Documentación | No |

**Total: 55 tareas ejecutables** (más 4 diferidas explícitamente a decisión de negocio antes de tocar código, y la Fase 5.2 diferida a un Spec dedicado por su propio alcance).

---

## Verificación global (antes de dar por cerrado el plan)

1. `npx tsc --noEmit` limpio.
2. `npm run build` sin errores (recordar el patrón conocido del proyecto: tras un build de producción, reiniciar `next dev` en limpio — `pkill -9 -f next-server && rm -rf .next` — antes de verificar manualmente).
3. Los 6 crashes reproducidos en la Tarea 0.1 ya no reproducen.
4. Regresión completa: `verify-sprint1.sh` … `verify-sprint6.sh`, `verify-e2e.sh`, `verify-operativos.sh`, `verify-rbac-cocina.sh`, `verify-erp-conectado.sh` — 290/290 (los tres que no autoresiembran necesitan `psql -f scripts/verify-ejemplo-e2e.sql` inmediatamente antes, sin nada más de por medio).
5. Verificación manual de cada flujo de Fase 3 en el navegador (no basta con scripts — son bugs de UX).
6. Commit por fase (no uno solo gigante), seedeado por checkpoint, siguiendo la disciplina ya establecida en el proyecto.
