# EventFlow — Especificaciones SDD

Artefactos Spec-Driven-Development para estabilizar y homogeneizar EventFlow.

## Estructura
- `lifecycle-16-fases/spec.md` — **fuente de verdad**: modelo, máquina de estados
  (español), fórmulas, las 16 fases con criterios de aceptación, invariantes.
- `lifecycle-16-fases/tasks.md` — **plan ejecutable** (Fase 0 fundamentos + T1–T16
  intercalando lógica y UI + QA). Una tarea = un commit.
- `design-system/spec.md` — patrón de diseño canónico + inventario de infractores.

## Cómo ejecutar con Sonnet (en este mismo chat)
1. Cambia el modelo a Sonnet.
2. Pídele, por bloques:
   > «Lee `specs/lifecycle-16-fases/spec.md` y `tasks.md`. Implementa **Fase 0**
   > completa (F0.1→F0.6), una tarea por commit, probando cada criterio de
   > aceptación. No empieces T1–T16 hasta que Fase 0 esté verde (`npm run build`).»
3. Luego, fase a fase: «Implementa T5 (señal→FWD‑2 atómica) según el spec».
   Prioriza las marcadas ★ (T5, T8, T13): son las que hoy impiden completar el flujo.
4. Cierra con el bloque **QA** (E2E + auditoría de diseño + build + migración limpia).

## Decisiones bloqueadas (no re-preguntar)
- Estados en **español** (BD+API+UI), set único del spec §2.
- Mesas `ceil(adultos/10)`, camareros `ceil(mesas×1.5)` — módulo `src/lib/operations.ts`.
- Señal **40%** / saldo **60%**.
- Escandallo canónico = sistema **B** (`recipe_items` + `frozen`); `/api/shopping` fallback.
- FWD‑2 y FWD‑4 **atómicas e idempotentes**; una sola ruta de cierre y de aceptación.
