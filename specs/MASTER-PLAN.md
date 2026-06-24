# EventFlow — Plan maestro integrado (spec-kit)

> Integra **todo lo aportado**: la spec funcional de Cocina & Catering
> (documento del usuario `speceventflowcocina.md` → FR-A/C/R/S), los prompts
> spec-kit (`speckitspecifyprompts.md` → ramas 001–010), el ciclo de vida de 16
> fases (`lifecycle-16-fases/`) y la homogeneización de diseño (`design-system/`).
>
> ⤷ **Acción:** guarda esos dos documentos del usuario en `specs/cocina/` para
> versionarlos (son la fuente literal que se pega en `/speckit.specify`). Este
> plan ya integra su contenido.
>
> **Fuente de verdad de requisitos:** la spec funcional (FR-*). Este plan ordena,
> reconcilia contradicciones y mapea estado actual → rama spec-kit → mis tareas.

## 1. Orden autoritativo (= ramas spec-kit; supersede mi orden previo)

| Fase | Rama spec-kit | Contenido | FR | Por qué aquí |
|---|---|---|---|---|
| **0** | 001 + 002 | **Saneamiento**: unidades base + costing único + ingrediente unificado + tests | FR-S01…S06 | Fundacional: hoy el escandallo calcula mal; todo deriva de esto |
| 1 | 003 | **RBAC** (4 roles, doble verificación) | FR-R01…R04 | Transversal; los módulos nuevos nacen ya con control de acceso |
| 2 | 004 + 005 | **Workflow presupuestos** (4 fases ES) + **ratios camareros por servicio** | FR-A01…A05 | Núcleo comercial; alinea estados (= mi trabajo de estados ES) |
| 3 | 006 + 007 | **Escandallo versionado** (teórico vs real, coste) + **import recetas Excel** | FR-C01…C04, C10 | Corazón de cocina; sobre el costing saneado |
| 4 | 008 | **Hojas** producción / carga / logística | FR-C05…C07 | Derivan del escandallo |
| 5 | 009 | **APPCC** + recibido↔inventario | FR-C08…C09 | Trazabilidad y cierre del círculo |
| 6 | 010 | **Operativos**: firma nómina, proveedores (debe), memo/briefing, sitting externo, gastos previos, ubicación, menú seleccionado/sugerencia | FR-A06…A12 | Complementos sobre módulos existentes |

> **Las 16 fases del ciclo de vida** (`lifecycle-16-fases/`) NO son una fase aparte:
> se reparten en estas ramas (workflow→2, escandallo→3, cierre/stock/factura→3-5,
> cobros→2/6). Mi `tasks.md` de 16 fases queda como **checklist de aceptación del
> flujo extremo-a-extremo** (QA del recorrido borrador→realizado).

## 2. Estado actual por requisito (revisión)

Leyenda: ✅ existe · 🟡 parcial · ❌ falta.

**Saneamiento (Fase 0) — crítico**
| FR | Estado | Evidencia / gap |
|---|---|---|
| S01 unidad base + conversión | ❌ | No existe conversión g↔kg/ml↔l en ningún sitio |
| S02 prohibir sumas entre dimensiones | ❌ | `StockManager.tsx:~380` suma `grams+units+ml` en un nº |
| S03 costing único (`costing.ts`) | 🟡 | cálculo disperso (webhooks/StockManager/cost_desglose); `/api/stock/escandallos` no calcula coste |
| S04 cantidades NUMERIC + formato es-ES | 🟡 | `event_shopping_items.total_units INT` fuerza enteros |
| S05 ingrediente único por id | 🟡 | conviven `ingredients` (tabla) + `catalog_items.ingredients` (JSONB) + `ingredient_name` (texto) |
| S06 tests de cálculo | 🟡 | hay vitest/Playwright; falta suite de cálculo |

**RBAC (Fase 1)**
| FR | Estado | Gap |
|---|---|---|
| R01–R04 | ❌ | `admins.role` es texto libre sin uso; todos ven todo |

**Ajustes comerciales (Fase 2)**
| FR | Estado | Gap |
|---|---|---|
| A01 workflow 4 fases (ES) | 🟡 | doble máquina de estados desalineada (es/en) → unificar |
| A02 borrador: ocultar unidades | ❌ | el desglose se muestra siempre |
| A03 cancelar con motivo | ❌ | falta `quotes.cancel_reason` |
| A04 ocultar cancelar en aceptado | ❌ | botón visible siempre |
| A05 ratios camareros por servicio | 🟡 | hoy `ceil(pax/15)` fijo; falta `service_type` y fórmula nueva |

**Cocina (Fases 3–5)**
| FR | Estado | Gap |
|---|---|---|
| C01 escandallo versionado teórico/real | 🟡 | hay `event_shopping_items`+`frozen`+`recipe_item_id`; falta versión + qty_real + scope plato/evento |
| C02 escala por pax | 🟡 | escala parcial; depende de S03 |
| C03 coste estimado vs real + desviación | ❌ | no se calcula coste de escandallo |
| C04 actualización continua por precio ingrediente | 🟡 | existe `price-history`; falta propagación + aviso margen |
| C05–C07 hojas producción/carga/logística | 🟡/❌ | hoja operación existe; falta carga por pase y logística (equipamiento/seco) |
| C08 APPCC (lotes/fecha/temp) | ❌ | no existe `appcc_records` |
| C09 recibido↔inventario por escaneo | ❌ | recepción no actualiza stock automáticamente |
| C10 import recetas Excel | ❌ | no hay import; estructura `recipe_items` lista como destino |

**Operativos (Fase 6)**
| FR | Estado | Gap |
|---|---|---|
| A06 gastos previos en presupuesto | 🟡 | `cost_desglose.line_type=extras` existe; falta subtipo + suma |
| A07 ubicación/venue_type | 🟡 | `events.location` existe; falta `venue_type`/`service_type` |
| A08 menú seleccionado vs sugerencia | ❌ | falta `event_menu_items.kind` |
| A09 firma tras pago nómina | ❌ | faltan `signature_url/signed_at/signed_by` |
| A10 proveedores: debe/vencimientos/justificantes | ❌ | falta tabla `provider_invoices` |
| A11 sitting externo (PDF) | 🟡 | editor mesas existe; falta capa PDF para venue externo (3D = diferido) |
| A12 briefing + memo camareros | 🟡 | hay `whatsapp-staffing`+crons; falta plantilla memo + cron T-1 |

## 3. Decisiones reconciliadas (cambios respecto a acuerdos previos)

1. **Camareros (SUPERSEDE la decisión anterior `ceil(mesas×1.5)`).** Ahora por
   `service_type` (FR-A05):
   - **Cóctel:** `ceil(pax/12)`.
   - **Menú sentado:** `ceil(pax/10) + floor(pax/25)`.
   - Mesas: `ceil(pax_adultos/10)` (sin cambio). Ratios **editables en `settings`**.
   - ⚠️ *Confirmar:* esto reemplaza el ×1.5 que fijamos antes.
2. **Estados en español** (constitución §8). El workflow comercial son 4 fases:
   `borrador → contacto → aceptado → realizado` (+ `rechazado`). Mi trabajo previo
   de "estados ES" se integra aquí (rama 004), con estos labels (no `enviado`).
3. **Iconos = lucide** (constitución §9). `Icon.tsx` ya es wrapper de lucide → es
   válido; solo eliminar `<svg>` inline y emojis. (Resuelve el "2 sistemas de iconos".)
4. **Ingrediente único por id** (FR-S05): el escandallo referencia `ingredient_id`,
   no `ingredient_name`; se deprecan `catalog_items.ingredients` (JSONB) y los
   nombres sueltos. (Esto **cambia** la convergencia que propuse antes hacia JSONB.)
5. **Costing y unidades** centralizados en `src/lib/costing.ts` + `src/lib/units.ts`
   (constitución §1-2). Reemplazan los cálculos dispersos.

## 4. Cambios de esquema (resumen, todos por migración idempotente)
- `quotes`: nuevo CHECK 4 fases (ES) + `cancel_reason`.
- `events`: `service_type ('coctel'|'menu')`, `venue_type ('benitez'|'externo')` (location ya existe).
- `event_menu_items`: `kind ('seleccionado'|'sugerencia')`, `service_round` (pase).
- staffing payments: `signature_url`, `signed_at`, `signed_by`.
- `ingredients`: factor de conversión a unidad base; flags `is_equipment`/`is_dry` (o tabla `material_items`).
- `admins.role`: CHECK `('admin','cocina','camareros','clientes')` (+ opcional `role_permissions`).
- `event_shopping_items.total_units`: `INT → NUMERIC`; usar `ingredient_id` (no `ingredient_name`).
- Migrar `catalog_items.ingredients JSONB` → `recipe_items`→`ingredients`.
- **Crear:** `escandallos` + `escandallo_lines`, `provider_invoices`, `appcc_records`, (opc.) `material_items`, `role_permissions`.
- **Código estructural:** `src/lib/units.ts`, `src/lib/costing.ts`, `POST /api/recipes/import` + plantilla Excel (SheetJS).

## 5. [NEEDS CLARIFICATION] consolidados (responder en /speckit.clarify)
1. **Ingredientes vivos (S05):** ¿migrar los de `JSONB`/`ingredient_name` a `ingredients` por id, o partir de catálogo limpio? (define el esfuerzo de Fase 0).
2. **Unidades enteras (S04):** ¿algún ingrediente obligatorio entero (tartas) o todos a NUMERIC?
3. **Decimales por dimensión (S04):** propuesta masa/volumen 0–1, conteo 0, dinero 2.
4. **Camareros refuerzo (A05):** ¿`+1 cada 25` es sumatorio al `1/10` (asumido) o sustituye tramos?
5. **RBAC (R01):** ¿4 roles fijos (recomendado) o `role_permissions` por módulo?
6. **Escandallo (C01):** ¿plantilla a nivel plato que se instancia por evento (recomendado) o libre por evento?
7. **Pase/service_round (C06):** ¿manual por evento o derivado de la categoría del plato?
8. **Voz/escáner Tipi (C04/C08):** ¿integración OCR/voz externa o entrada manual asistida en v1?
9. **Material/equipamiento (C07):** ¿stock con existencias o checklist de carga?
10. **Import recetas (C10):** ¿Excel con formato existente o plantilla desde cero? ¿contemplar **merma %** (bruto vs neto)?
11. **3D/360 venue externo (A11):** ¿v1 o diferido? (recomendado: PDF + sitting 2D ahora).

## 6. Cómo ejecutar (spec-kit, en este chat con Sonnet)
1. `/speckit.constitution` ← pegar `specs/constitution.md`.
2. Por rama, en orden (001→010): `git checkout -b 00N-...`, `/speckit.specify`
   (pegar el bloque de `cocina/speckit-prompts.md`), luego
   `/speckit.clarify → checklist → plan → tasks → analyze → implement`.
3. **No saltarse Fase 0** (001+002): sin unidades+costing saneados, las hojas de
   cocina heredan los errores.
4. Tras cada rama, recorrer el checklist E2E de `lifecycle-16-fases/tasks.md`
   (sección QA) para confirmar que el flujo borrador→realizado sigue íntegro.
5. Diseño: aplicar `design-system/spec.md` (lucide + primitivos + paleta) en la UI
   de cada rama, no al final.
