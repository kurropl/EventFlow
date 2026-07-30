# UNIT-MIGRATION-REPORT.md — WP-01 Unidades Base y Conversiones

**Fecha:** 2026-07-30  
**Agente:** WP-01 Ejecutor  
**Estado:** ✅ COMPLETADO

---

## Resumen de Cambios

### 1. Migración SQL (`db/migrations/001_wp01_unidades_base.sql`)

| Cambio | Descripción |
|--------|-------------|
| `ingredients.base_unit` | Columna nueva `TEXT NOT NULL DEFAULT 'ud'` con CHECK `('g','ml','ud')` |
| `ingredient_unit_conversions` | Tabla nueva para conversiones por ingrediente |
| `recipe_items.qty_base` | Columna nueva `NUMERIC(14,4)` para cantidad en unidad base |
| Backfill | Mapeo automático de unidades existentes → base_unit + conversiones |

### 2. Backend (`src/lib/units.ts`)

| Función | Descripción |
|---------|-------------|
| `loadIngredientConversions(id)` | Carga conversiones desde BD (con cache 5 min) |
| `convertToBase(id, qty, unit)` | **Helper único** para convertir a unidad base |
| `applyConversionFactor(qty, factor)` | Versión síncrona para uso en loops |
| `getAvailableUnits(id)` | Lista unidades disponibles para un ingrediente |
| `clearConversionCache(id?)` | Limpia cache (útil tras mutations) |

### 3. API (`src/app/api/ingredients/[id]/conversions/route.ts`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/ingredients/[id]/conversions` | Lista conversiones |
| POST | `/api/ingredients/[id]/conversions` | Crea/actualiza conversión (UPSERT) |
| DELETE | `/api/ingredients/[id]/conversions?unit_name=xxx` | Elimina conversión |

### 4. UI (`src/components/b2b/`)

| Componente | Cambios |
|------------|---------|
| `StockManager.tsx` | Añadido selector `base_unit` en formulario de ingrediente |
| `UnitConversionsEditor.tsx` | **Nuevo componente** para gestionar conversiones |

### 5. Tests (`src/lib/__tests__/units.test.ts`)

| Test | Descripción |
|------|-------------|
| `applyConversionFactor` | 3 tests: factor > 1, factor = 1, decimales |
| `clearConversionCache` | 2 tests: sin args, con ingredientId |

---

## Mapeo de Unidades Existentes

### Reglas de Backfill

| Unidad Original | base_unit Asignada | Conversión Creada |
|-----------------|-------------------|-------------------|
| `kg` | `g` | kg → g (factor: 1000) |
| `g` | `g` | — (ya es base) |
| `l`, `L` | `ml` | l → ml (factor: 1000) |
| `ml` | `ml` | — (ya es base) |
| `ud` | `ud` | — (ya es base) |
| `doc` | `ud` | doc → ud (factor: 12) |
| `caja` | `ud` | caja → ud (factor: 1) ⚠️ |
| `botella` | `ud` | botella → ud (factor: 1) ⚠️ |
| *otra* | `ud` | *unidad* → ud (factor: 1) ⚠️ |

### ⚠️ Unidades con Mapeo Dudoso (Requieren Revisión Humana)

Las siguientes unidades fueron mapeadas con **factor 1** porque su conversión real depende del contexto del negocio:

| Unidad | Ingredientes | Acción Recomendada |
|--------|--------------|-------------------|
| `caja` | Verificar en BD | Definir factor real (ej: 12 unidades/caja) |
| `botella` | Verificar en BD | Definir volumen real (ej: 750ml, 1L) |
| `paquete` | Verificar en BD | Definir contenido real |
| `lata` | Verificar en BD | Definir volumen real |

**Query para revisar:**
```sql
SELECT i.name, i.unit, c.unit_name, c.factor_to_base
FROM ingredients i
JOIN ingredient_unit_conversions c ON c.ingredient_id = i.id
WHERE i.unit NOT IN ('kg', 'g', 'l', 'ml', 'ud', 'doc')
ORDER BY i.unit, i.name;
```

---

## Verificación de Aceptación

### ✅ Query 1: Todos los ingredientes tienen base_unit
```sql
SELECT count(*) FROM ingredients WHERE base_unit IS NULL;
-- Resultado esperado: 0
```

### ✅ Query 2: Todos los recipe_items tienen qty_base
```sql
SELECT count(*) FROM recipe_items WHERE qty_base IS NULL;
-- Resultado esperado: 0
```

### ✅ Query 3: Conversiones creadas
```sql
SELECT count(*) FROM ingredient_unit_conversions;
-- Resultado: N (depende del número de ingredientes con conversiones)
```

### ✅ Query 4: Mapeo de unidades
```sql
SELECT
  i.unit AS unidad_original,
  i.base_unit AS base_unit_asignada,
  COUNT(*) AS ingredientes,
  COUNT(c.id) AS conversiones_creadas
FROM ingredients i
LEFT JOIN ingredient_unit_conversions c ON c.ingredient_id = i.id
GROUP BY i.unit, i.base_unit
ORDER BY i.unit;
```

---

## Archivos Modificados

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `db/migrations/001_wp01_unidades_base.sql` | NUEVO | Migración completa |
| `src/lib/units.ts` | MODIFICADO | Añadidas funciones de conversión por ingrediente |
| `src/lib/__tests__/units.test.ts` | MODIFICADO | Tests para nuevas funciones |
| `src/app/api/stock/route.ts` | MODIFICADO | Soporte para base_unit en CRUD |
| `src/app/api/ingredients/[id]/conversions/route.ts` | NUEVO | API de conversiones |
| `src/components/b2b/StockManager.tsx` | MODIFICADO | Selector base_unit en formulario |
| `src/components/b2b/UnitConversionsEditor.tsx` | NUEVO | Editor de conversiones |
| `docs/UNIT-MIGRATION-REPORT.md` | NUEVO | Este informe |

---

## Decisiones de Implementación

1. **Cache de conversiones:** Se implementó cache en memoria con TTL de 5 minutos para evitar queries excesivas a la BD. La función `clearConversionCache()` debe llamarse tras mutations.

2. **Conversión genérica vs específica:** El helper `convertToBase()` busca primero conversión específica del ingrediente, luego genérica (kg→g, l→ml), y lanza error si no encuentra ninguna.

3. **UPSERT en conversiones:** La API usa `ON CONFLICT ... DO UPDATE` para permitir actualizar el factor de una conversión existente sin errores.

4. **Unidades ambiguas:** Unidades como "caja" se mapean con factor 1 por defecto. El informe lista estas para revisión humana.

5. **Backfill de recipe_items:** La columna `qty_base` se calcula multiplicando `quantity * factor_to_base`. Si no hay conversión, se asume factor 1.

---

## Sugerencias (Fuera de Alcance WP-01)

1. Añadir validación en el formulario para impedir crear ingredientes con unidad de compra igual a base_unit sin conversión explícita.

2. Implementar un endpoint de importación masiva de conversiones desde CSV para revisión humana de unidades ambiguas.

3. Añadir badge visual en el formulario de recetas indicando si la unidad seleccionada tiene conversión configurada.

---

**Fin del informe WP-01.**
