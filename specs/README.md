# EventFlow — Especificaciones SDD / spec-kit

Artefactos para estabilizar y ampliar EventFlow (catering de eventos).

## Índice (orden de lectura)
1. **`constitution.md`** — principios no negociables (pegar en `/speckit.constitution`).
2. **`MASTER-PLAN.md`** — plan maestro integrado: orden autoritativo (ramas 001–010),
   estado actual por requisito, decisiones reconciliadas y clarificaciones abiertas.
   **Empieza aquí.**
3. **`cocina/`** — documentos del usuario (fuente de verdad de requisitos):
   `speceventflowcocina.md` (FR-A/C/R/S) + `speckitspecifyprompts.md` (prompts
   `/speckit.specify` de las ramas 001–010). *Guardarlos aquí para versionar.*
4. **`design-system/spec.md`** — diseño homogéneo (paleta, primitivos, **iconos lucide**).
5. **`lifecycle-16-fases/`** — el flujo extremo-a-extremo (16 fases) como **checklist
   de aceptación/QA**; sus piezas se implementan dentro de las ramas del MASTER-PLAN.

## Decisiones bloqueadas (no re-preguntar)
- **Estados en español**, set único (constitución §8). Workflow comercial:
  `borrador → contacto → aceptado → realizado` (+ `rechazado`).
- **Camareros por tipo de servicio** (FR-A05, **supersede** el `ceil(mesas×1.5)` previo):
  cóctel `ceil(pax/12)`; menú `ceil(pax/10)+floor(pax/25)`. Mesas `ceil(pax_adultos/10)`.
  Ratios editables en `settings`.
- **Iconos = lucide** (constitución §9) — directo o vía `Icon` (ya es wrapper de lucide).
- **Ingrediente único por `id`** (FR-S05); deprecar `catalog_items.ingredients` JSONB y nombres sueltos.
- **Costing y unidades** centralizados (`src/lib/costing.ts`, `src/lib/units.ts`).
- **Transacciones atómicas** en aceptar/cerrar; **migraciones idempotentes**.

## Cómo ejecutar (spec-kit, en este chat con Sonnet)
1. `/speckit.constitution` ← pega `constitution.md`.
2. Por rama y **en orden** (Fase 0 = 001+002 primero):
   `git checkout -b 00N-<slug>` → `/speckit.specify` (pega el bloque de
   `speckitspecifyprompts.md`) → `/speckit.clarify` (responde los
   `[NEEDS CLARIFICATION]` del MASTER-PLAN §5) → `checklist → plan → tasks →
   analyze → implement`.
3. Aplica `design-system/spec.md` en la UI de **cada** rama (no al final).
4. Tras cada rama, pasa el **QA E2E** de `lifecycle-16-fases/tasks.md`.
