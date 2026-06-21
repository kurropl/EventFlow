# Plan: Sistema de Unidades y Cantidades Unificado (pre-Cocina)

## Problema actual
- El sistema suma gramos, unidades y mililitros en un mismo total — cifras sin sentido
- No existe conversión entre unidades de distinta escala (kilos y gramos no se normalizan)
- Las cantidades se formatean distinto en cada pantalla (unos `9000.00`, otros `9.000`)
- Las cantidades fraccionables se fuerzan a enteros en algunos sitios, perdiendo precisión
- Los cálculos intermedios redondean **antes** de sumar, acumulando errores

## Regla de decimales (aprobada)
- Cuando una cantidad **tiene** decimales: siempre 2 (masa, volumen, dinero)
- Cuando **no tiene** decimales (conteo entero): 0
- Se almacena todo en unidad base (gramos, mililitros, unidades) y se convierte al mostrar
- Prohibido expresamente sumar dimensiones distintas

## Principios (no negociables)
1. **Cálculo centralizado**: toda función de conversión / normalización / formateo de unidades pasa por `src/lib/units.ts`. Prohibido recalcular en componentes o rutas.
2. **Migraciones versionadas**: todo cambio de esquema SQL se hace por archivo de migración, nunca editando `schema.sql` a mano.
3. **Test-first**: antes de implementar cualquier lógica de unidades, crear tests que fijen los resultados esperados.
4. **Dimensiones separadas**: nunca se suman gramos + mililitros + unidades en un mismo total. Los totales se presentan **separados por dimensión**.
5. **Redondeo único**: el redondeo a 2 decimales ocurre **una sola vez** en la presentación final. Los cálculos intermedios mantienen `float64` con toda su precisión.

## Archivos a crear / modificar

### 1. Librería de unidades (`src/lib/units.ts`) — **NUEVO**
```typescript
// Módulo único de conversión y formateo de unidades
// Dimensiones: 'mass' | 'volume' | 'count' | 'currency'
type Unit = 'g' | 'kg' | 'ml' | 'l' | 'ud' | 'doc' | 'eur';

// Convierte entre unidades de la MISMA dimensión
function convertUnit(value: number, from: Unit, to: Unit): number;
// Ej: 1500 g → 1.5 kg,  750 ml → 0.75 L

// Redondea a N decimales (solo en presentación)
function roundTo(value: number, decimals: number): number;

// Formatea con locale español (es-ES) y sufijo
function formatCantidad(value: number, unit: Unit, decimals?: number): string;
// Ej: 1500 g → "1.500",  750 ml → "0,75 L",  24 ud → "24"

// Verifica que dos unidades pertenecen a la misma dimensión
function sameDimension(a: Unit, b: Unit): boolean;
```

### 2. Test de unidades (`src/lib/__tests__/units.test.ts`) — **NUEVO**
Tests obligatorios antes de implementar:
- `1.5 kg + 300 g = 1.8 kg` (conversión entre escalas)
- `750 ml + 250 ml = 1 L` (suma de volumen)
- `2 docenas + 3 ud = 27 ud` (conteo)
- `0.5 kg = 500 g` (normalización)
- `suma entre dimensiones → error()` (protección)
- `1500 g → 1.5 kg` (formateo)
- `24.50 € → "24,50 €"` (locale)

### 3. Migración SQL (`scripts/2025-06-fix-units.sql`) — **NUEVO**
```sql
-- No usar CREATE OR REPLACE VIEW (peligroso en migraciones)
-- Usar DROP VIEW IF EXISTS + CREATE VIEW

-- 1. Columna de dimensión en event_shopping_items
ALTER TABLE event_shopping_items ADD COLUMN IF NOT EXISTS unit_dimension 
  TEXT CHECK (unit_dimension IN ('mass', 'volume', 'count', 'currency'));

-- 2. Actualizar registros existentes según su campo dominante
UPDATE event_shopping_items SET unit_dimension = 'mass' WHERE total_grams > 0;
UPDATE event_shopping_items SET unit_dimension = 'volume' WHERE total_ml > 0;
UPDATE event_shopping_items SET unit_dimension = 'count' WHERE total_units > 0 AND total_grams = 0 AND total_ml = 0;
UPDATE event_shopping_items SET unit_dimension = 'currency' WHERE total_cost > 0;

-- 3. Recrear vista shopping_list con ROUND a 2 decimales
DROP VIEW IF EXISTS shopping_list;
CREATE VIEW shopping_list AS ... (con ROUND(x, 2) en todos los totales)
```

### 4. API `/api/shopping/route.ts` — **MODIFICAR**
- Validar que `total_grams`, `total_ml`, `total_units` nunca se envían juntos en un mismo PUT
- Si se envían juntos → rechazar con `400` explicando que las dimensiones son distintas

### 5. Frontend `OperationsManager.tsx` — **MODIFICAR**
- Input editable para `total_grams`: muestra `1500.00`, guarda en unidad base (g)
- Input editable para `total_ml`: muestra `750.00`
- Input editable para `total_units`: sin decimales (entero)
- Los valores se pasan por `formatCantidad()` antes de mostrar

## Tests de validación (antes de deploy)
```bash
npx vitest run src/lib/__tests__/units.test.ts  # debe pasar
curl -s http://localhost:3020/api/shopping?event_id=X | jq '.'
# verificar que totales están separados por dimensión
```

## Riesgos y mitigaciones
| Riesgo | Mitigación |
|---|---|
| Redondeo acumulado en sumas largas | `roundTo()` solo en display; `float64` en cálculos |
| CREATE OR REPLACE VIEW en migración | Usar DROP + CREATE en su lugar |
| Ingredientes con masa+volumen (ej: caldo) | Dos filas separadas en `event_shopping_items` |
| Migración rompe datos existentes | `ADD COLUMN IF NOT EXISTS` + valores por defecto |

## Fase 2: Módulo Cocina (feature aparte)
Esta feature **no incluye** el panel de cocina. Será una feature posterior construida sobre este sistema de unidades saneado.

## Preguntas pendientes
- ¿Los ingredientes del catálogo deben tener un campo `dimension` explícito o se infiere de qué campos tienen > 0?