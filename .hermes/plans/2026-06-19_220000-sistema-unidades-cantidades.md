# Plan: Sistema de Unidades y Cantidades Unificado (pre-Cocina)

## Problema actual
- El sistema suma gramos, unidades y mililitros en un mismo total (cifras sin sentido)
- No existe conversión entre unidades (kilos y gramos no se normalizan)
- Las cantidades se formatean distinto en cada pantalla (unos `9000.00`, otros `9.000`)
- Fraccionables se fuerzan a enteros en algunos sitios

## Regla fija aprobada
- **2 decimales siempre** cuando hay decimales (masa, volumen, dinero)
- **0 decimales** en conteos (ud, piezas)
- Se almacena todo en unidad base (gramos, mililitros, unidades) y se convierte al mostrar
- Prohibido sumar dimensiones distintas

## Alcance
Feature de infraestructura base — no incluye el módulo Cocina (será otra feature).
Tampoco incluye cálculo de coste (eso es feature aparte).

## Archivos a crear / modificar

### 1. Librería de unidades (`src/lib/units.ts`) — NUEVO
- `convertUnit(value, from, to)` — conversión entre unidades de misma dimensión
- `normalizeUnit(value, unit)` — pasa a unidad base (g, ml, ud)
- `displayUnit(value, unit, decimals)` — formatea con locale es-ES y sufijo
- `formatCantidad(value, unit)` — wrapper con 2 decimales si hay, 0 si entero

### 2. Test de unidades (`src/lib/__tests__/units.test.ts`) — NUEVO
- `1.5 kg + 300 g = 1.8 kg`
- `750 ml + 250 ml = 1 L`
- `2 docenas + 3 ud = 27 ud`
- `0.5 kg = 500 g`
- `suma entre dimensiones → error`

### 3. Schema SQL (`schema.sql`) — MODIFICAR (vista shopping_list)
- Reemplazar `ROUND(...)` actual por `ROUND(COALESCE(..., 0), 2)` con 2 decimales fijos
- Añadir columna `unit_dimension` para saber qué dimensión es cada ingrediente

### 4. Shopping API (`/api/shopping/route.ts`) — MODIFICAR
- Validar que `total_grams` + `total_ml` + `total_units` nunca se suman entre sí
- En `regenerateShoppingList`: pasar cada cantidad por `normalizeUnit()` primero

### 5. OperationsManager (`src/components/b2b/OperationsManager.tsx`) — MODIFICAR
- Los inputs `total_grams`, `total_ml` ahora muestran con 2 decimales fijos
- Los inputs `total_units` sin decimales (entero)
- Columna separadora visual entre dimensiones (no mezclar en totales)

### 6. BillingPanel (`src/components/b2b/BillingPanel.tsx`) — MODIFICAR
- Separar totales por dimensión en la tabla de facturación

## Migración DB
- `ALTER TABLE event_shopping_items ADD COLUMN IF NOT EXISTS unit_dimension TEXT CHECK (unit_dimension IN ('mass', 'volume', 'count', 'currency'))`
- Actualizar registros existentes con la dimensión correcta según su `total_grams` / `total_ml` / `total_units`

## Tests
- `npx vitest run src/lib/__tests__/units.test.ts` — debe pasar antes de hacer deploy
- `curl /api/shopping?event_id=X` — verificar que los totales están separados
- `curl /api/events?limit=1` — verificar que `total_pvp` tiene 2 decimales

## Riesgos
- Si un ingrediente tiene gramos > 0 y ml > 0 (ej: caldo con peso y volumen), asignar `dimension = 'mass'` y `dimension = 'volume'` como dos registros separados
- Redondeo a 2 decimales puede perder precisión en sumas largas — usar `toFixed(2)` solo en display, mantener `Math.round(float64 * 100) / 100` en almacenamiento

## Preguntas pendientes
- ¿Los ingredientes del catálogo (`catalog_items.ingredients`) tienen ya una `dimension`? Si no, la migración debe asignarla según qué campos tienen > 0.