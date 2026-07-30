# TEST-BASELINE.md — Baseline de Tests de EventFlow

**Generado por:** WP-00 Reconocimiento del Sistema  
**Fecha:** 2026-07-30

---

## Framework

- **Unit tests:** Vitest (v4.1.7)
- **E2E tests:** Playwright
- **Config:** `vitest.config.ts`
- **Directorio unit:** `__tests__/**/*.test.ts` + `src/**/*.test.ts`
- **Timeout:** 20s por test (tests de integración con Postgres)

---

## Ejecución

```bash
# Tests unitarios + integración
npx vitest run

# Solo un archivo
npx vitest run __tests__/operations.test.ts

# Con coverage
npx vitest run --coverage
```

---

## Resultado del Baseline (2026-07-30)

### Suite: 12 archivos de test

| Archivo | Tests | Pasan | Fallan | Saltados |
|---------|-------|-------|--------|----------|
| `__tests__/characterization.test.ts` | 13 | 0 | 0 | 13 |
| `__tests__/operations.test.ts` | 11 | 11 | 0 | 0 |
| `__tests__/staffing.test.ts` | 8 | 0 | 0 | 8 |
| `src/lib/__tests__/data-model-integrity.test.ts` | 9 | 0 | 9 | 0 |
| `src/lib/__tests__/escandallo.test.ts` | 8 | 0 | 8 | 0 |
| (8 archivos más) | ~94 | ~94 | 0 | 0 |
| **TOTAL** | **143** | **105** | **17** | **21** |

### Tests que fallan (17 — preexistentes, requieren BD/Server)

| Archivo | Tests fallidos | Motivo |
|---------|---------------|--------|
| `characterization.test.ts` | 13 (skipped) | Requiere server corriendo en `localhost:3020` |
| `data-model-integrity.test.ts` | 9 | `pool.query()` falla: `Cannot read properties of undefined` — BD no disponible |
| `escandallo.test.ts` | 8 | `connect ECONNREFUSED ::1:5432` — BD no disponible |
| `staffing.test.ts` | 8 (skipped) | `connect ECONNREFUSED ::1:5432` — BD no disponible |

### Tests que pasan (105)

- `operations.test.ts` — 11/11 ✅ (cálculo mesas, camareros, operaciones)
- Tests puros de lógica de negocio sin dependencia de BD
- Tests de importación de módulos

### Tests saltados (21)

- `characterization.test.ts` — 13 tests (requieren server HTTP)
- `staffing.test.ts` — 8 tests (requieren BD)

---

## Tests Rojos Preexistentes (Aceptados)

Los siguientes tests fallan por falta de infraestructura (BD/Server), NO por bugs en código:

1. **data-model-integrity.test.ts** (9 tests) — Falla al conectar con Postgres
   - Causa: `pool` es `undefined` cuando la BD no está disponible
   - Acción: Estos tests requieren que el servidor esté corriendo con BD activa

2. **escandallo.test.ts** (8 tests) — Falla al conectar con Postgres
   - Causa: `connect ECONNREFUSED ::1:5432`
   - Acción: Estos tests requieren BD PostgreSQL activa

3. **characterization.test.ts** (13 tests) — Skipped, requiere server HTTP
   - Causa: `fetch` falla con `ECONNREFUSED ::1:3020`
   - Acción: Estos tests requieren `npm run dev` corriendo

4. **staffing.test.ts** (8 tests) — Skipped, requiere BD
   - Causa: `connect ECONNREFUSED ::1:5432`
   - Acción: Estos tests requieren BD PostgreSQL activa

---

## Conclusión del Baseline

- **Tests puros:** 105 pasan ✅
- **Tests de integración:** 17 fallan por infraestructura (BD/Server apagados)
- **Tests saltados:** 21 requieren infraestructura
- **Tests con bugs reales:** 0 detectados

Los tests de integración que fallan son **aceptables** como baseline: cuando la BD y el server están corriendo (producción o `npm run dev` + Docker), estos tests deberían pasar. El WP-00 no cambia esto.
