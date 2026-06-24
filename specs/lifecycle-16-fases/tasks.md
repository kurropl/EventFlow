# EventFlow — Plan de tareas (ejecutar con Sonnet)

> Deriva de `spec.md`. **Orden: intercalado por fase**, precedido de **Fase 0**
> (fundamentos transversales que todo lo demás necesita).
>
> **Reglas para el implementador (Sonnet):**
> - Una tarea = un commit. Mensaje: `feat(fN): <titulo>` o `fix/refactor`.
> - Cada tarea trae **Criterio de aceptación (CA)** y **Prueba**. No marcar hecha sin probar.
> - Tras cada bloque: `npm run build` debe pasar. Migraciones SQL **idempotentes** en `scripts/`.
> - No romper lo que ya funciona; converger duplicados, no añadir un tercero.
> - Paleta: gold `#C9A84C` / cream `#F8F3E6` / ink `#1A1A1A`; titulares Playfair; cuerpo Inter.

---

## FASE 0 — FUNDAMENTOS (bloqueante, hacer primero)

### F0.1 · Estados canónicos en español (BD + API + UI)
- **Objetivo:** un único set de estados en español (ver spec §2).
- **Archivos:** `schema.sql` (CHECK de `events`,`quotes`,`event_orders`,`payments`), `src/types/specs.ts` (zod `EventStatusSchema`), nueva migración `scripts/2026-estados-es.sql`, y todos los componentes que mapean estados (`DashboardOverview`, `KanbanPipeline`, `StatusBadge`, `LeadsCRM`, `BillingPanel`).
- **Pasos:**
  1. Migración idempotente: `UPDATE` que mapea inglés→español y español‑viejo→canónico (tabla del spec §2.1), luego **un solo** `CHECK` por tabla.
  2. zod: `EventStatusSchema = z.enum(['borrador','enviado','aceptado','en_curso','completado','pagado','cancelado','reabierto'])`.
  3. Crear `src/lib/estados.ts` con `ESTADOS`, `STATUS_META` (label+color de paleta) y helpers; **reemplazar** los mapas duplicados en cada panel por import de aquí.
- **CA:** no queda ningún literal `'draft'|'sent'|'accepted'|'in_progress'|'completed'|'paid'|'nuevo'|'propuesta_enviada'|'confirmado'` en `src/`. `grep` limpio.
- **Prueba:** crear evento por configurador → estado `borrador`; aceptar → `aceptado`; pipeline y dashboard muestran etiquetas correctas.

### F0.2 · Módulo único de operaciones (fórmula mesas/camareros)
- **Objetivo:** una sola fuente para la fórmula (spec §0.2).
- **Archivos:** nuevo `src/lib/operations.ts` con `calcMesas(adultos)`, `calcCamareros(mesas)`, `calcOperaciones(adultos,kids)`; **reemplazar** los 6 cálculos dispersos (`api/quotes/[id]`, `api/events/[id]`, `specs.ts` OPERATIONAL_RATIOS, `EventStaffingPanel`, transitions FWD‑3/4).
- **CA:** `grep -rn "ceil(.*gu" src` solo aparece dentro de `operations.ts`. 100 adultos ⇒ 10 mesas / 15 camareros en todos los puntos.
- **Prueba:** unit test `operations.test.ts` (10/15 para 100; 1/2 para 1).

### F0.3 · Transacciones atómicas en FWD‑2 y FWD‑4
- **Objetivo:** I2 del spec. Envolver toda la lógica multi‑escritura en `transaction()` con rollback.
- **Archivos:** `src/app/api/quotes/[id]/route.ts` (FWD‑2 ya usa transaction → revisar que TODO esté dentro y sea idempotente), `src/app/api/events/[id]/transitions/route.ts` (FWD‑4 **NO** es atómica → envolver en `transaction()`; el `deductStockForEvent` y la factura deben ir dentro o compensarse).
- **CA:** si la factura o el stock fallan, NADA se persiste (evento sigue `aceptado`). Probar inyectando un fallo.
- **Prueba:** test de cierre con stock forzado a error → estado intacto + sin factura huérfana.

### F0.4 · Ruta única de cierre y de aceptación (de‑duplicar)
- **Objetivo:** I5. Hoy hay `api/events/[id]/close` **y** `api/events/[id]/transitions` (FWD‑4); y aceptación en `quotes/[id]`.
- **Acción:** elegir `transitions` como canónica para FWD‑*; `close` redirige/llama a `transitions` o se elimina. Actualizar la UI que llame a la canónica.
- **CA:** un solo endpoint hace el cierre; `grep` no muestra dos implementaciones de freeze+invoice+deduct.

### F0.5 · Esquema reproducible (sin deriva)
- **Objetivo:** I7. Toda columna/tabla/vista usada por el código existe en `schema.sql`.
- **Acción:** auditar `stock_deducted`, `frozen`, `recipe_item_id`, `theoretical_qty`, `event_audit`, `guest_forms`, `client_token` → asegurarlos en `schema.sql` + migración consolidada `scripts/2026-baseline.sql`. Verificar arranque limpio.
- **CA:** BD recreada solo con `schema.sql` + `scripts/*.sql` → los 10 paneles cargan sin 500.

### F0.6 · Fundamentos de diseño (tokens + primitivos)  *(habilita la UI homogénea de cada fase)*
- **Objetivo:** base del sistema de diseño antes de homogeneizar pantallas.
- **Archivos:** `tailwind.config.ts` (añadir tokens `gold/cream/ink/paper/divider(#ECECF1)` + grises de marca), `src/components/ui/*` (asegurar `PageHeader`, `Card`, `Button`, `StatStrip`, `EmptyState`, `ErrorState`), `src/components/b2b/StatusBadge.tsx` (usar paleta, no blue/red/purple), `src/components/ui/button.tsx` (variant default = `bg-gold`, no `bg-amber-600`), `src/components/shared/Icon.tsx` (única fuente de iconos).
- **CA:** existen `Button/Card/PageHeader/StatStrip/EmptyState/ErrorState` con estilo de paleta y `StatusBadge` usa dorado/acentos de marca.

---

## FASES 1–16 (intercalado: Lógica + UI homogénea por fase)

> Para CADA fase: subtarea **[L]** lógica/datos y **[UI]** homogeneizar su pantalla a
> los primitivos de F0.6 (sin colores fuera de paleta, `PageHeader`, `Icon`, Playfair,
> estados de carga/vacío/error).

### T1 · Configurador → lead+quote borrador
- **[L]** Verificar que el submit crea `lead(source=configurador)` + `quote(borrador)` + `event(borrador)` enlazados. **CA:** una sola fila por envío, sin duplicar cliente.
- **[UI]** `/configurador`: copys con acentos correctos; pantalla de confirmación tras submit (no error crudo).

### T2 · Presupuesto borrador + PVP por plato
- **[L]** PVP/coste por línea calculado server‑side desde catálogo. **CA:** total = Σ líneas; nunca 0 si hay platos.
- **[UI]** Vista de presupuesto (`BudgetEditor`) con primitivos.

### T3 · Cálculo de precio automático
- **[L]** Confirmar enriquecimiento en `/api/events` y `quotes`; un único helper de precio. **CA:** mismo total en configurador, kanban y ficha.

### T4 · Edición en 1ª reunión (modificaciones)
- **[L]** Editar líneas del quote recalcula totales y persiste; re‑genera escandallo previsional. **CA:** cambiar cantidades actualiza payments si aún no hay señal.
- **[UI]** Editor de líneas homogéneo.

### T5 · Señal 40% → FWD‑2 (atómica) ★ crítica
- **[L]** `/api/payments/signal` dispara la transacción FWD‑2 completa del spec §2.3 (idempotente). Usar `src/lib/operations.ts` y constantes 40/60. **CA:** aceptar crea event_order + 2 payments + escandallo + staffing + lead=convertido, todo o nada; repetir no duplica.
- **[UI]** Botón "Registrar señal" en pipeline/ficha con feedback y estado resultante.

### T6 · Mesas y camareros (fórmula única)
- **[L]** Sustituir todos los cálculos por `src/lib/operations.ts` (F0.2). **CA:** 100 adultos ⇒ 10/15 en quote, event_order, staffing y UI.
- **[UI]** `EventStaffingPanel`/operaciones muestran los mismos números.

### T7 · Enlace invitados
- **[L]** `/invitados/[token]` + `/api/admin/guest-forms` (GET/PATCH). **CA:** token único por evento; guardar invitados persiste.
- **[UI]** Formulario público con paleta y validación.

### T8 · Recalcular escandallo (converger a sistema B) ★
- **[L]** Canónico `/api/escandallo/[eventId]/recalc` (recipe_items + theoretical_qty); `/api/shopping` se alinea (fallback JSONB solo si no hay receta) o se deprecia. **CA:** recalc produce cantidades = Σ(qty_receta × raciones); coste teórico calculado.
- **[UI]** Escandallo en Operaciones con coste teórico vs real.

### T9 · T‑7 confirmación de invitados
- **[L]** `/admin/confirmacion`: invitados confirmados vs mesas/comensales; alerta a T‑7. **CA:** muestra desviación y recalcula mesas si cambia el nº.
- **[UI]** `ConfirmacionDashboard` homogéneo.

### T10 · Hoja de operación
- **[L]** `/api/hoja-operacion/[eventId]` consolida menú+mesas+camareros+escandallo+timing. **CA:** PDF/print con datos reales del evento.
- **[UI]** `HojaOperativaPDF` con marca.

### T11 · Briefing camareros (Sección 7 ficha)
- **[L]** Datos de briefing (timing, zonas, asignación) por evento. **CA:** refleja staffing_lines confirmadas.
- **[UI]** `BriefingCamareros` dentro de `EventDetail` (`/admin/evento`).

### T12 · Checklist por áreas
- **[L]** `ChecklistPanel`: cocina/servicio/montaje/limpieza persistido por evento (no solo localStorage). **CA:** marcar ítems persiste en BD.
- **[UI]** Homogéneo + estado vacío.

### T13 · Cierre del evento = FWD‑4 (atómica) ★ crítica
- **[L]** Usar la ruta única (F0.4) y transacción (F0.3): freeze→completado→deduct stock→factura. **CA:** todo o nada; idempotente; deja `event_audit`.
- **[UI]** Botón "Cerrar evento" con resumen de efectos y confirmación.

### T14 · Actualización de stock
- **[L]** `/api/stock/deduct` dentro de FWD‑4, idempotente (`stock_deducted`). **CA:** stock baja una sola vez; nunca negativo.
- **[UI]** Stock muestra movimiento del cierre.

### T15 · Cobros pendientes (saldo 60%) → FWD‑5
- **[L]** Al marcar saldo cobrado → `event.status=pagado`. **CA:** dashboard "pendiente de cobro" baja; estado pasa a `pagado`.
- **[UI]** `/admin/cobros` y `BillingPanel` con paleta.

### T16 · Facturación final
- **[L]** `invoices` con nº **secuencial** (no `Math.random`), idempotente por `event_order_id`. **CA:** una factura por pedido; nº correlativo.
- **[UI]** Vista/descarga de factura con datos de negocio (`/admin/config`).

---

## CIERRE — Verificación end‑to‑end (QA)
- **QA.1** Test E2E del flujo completo (configurador → señal → pre‑evento → cierre → cobro → factura) sobre `seed-ejemplo-completo.sql`. **CA:** el evento recorre `borrador→…→pagado` sin intervención manual fuera de los puntos previstos.
- **QA.2** Auditoría de diseño: `grep` sin colores fuera de paleta en `src/components/b2b`; todos los paneles con `PageHeader` + `Icon` + estados carga/vacío/error.
- **QA.3** `npm run build` limpio + Playwright recorre los ~16 paneles sin 500 ni consola en rojo.
- **QA.4** Migración en BD limpia (`schema.sql` + `scripts/*.sql`) sin errores.

## Dependencias
`F0.* (todas) → antes que T1–T16`. Dentro de fases, las marcadas ★ (T5, T8, T13) son
las que hoy impiden "completar las fases": priorizarlas tras F0.
