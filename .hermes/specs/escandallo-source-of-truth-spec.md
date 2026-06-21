# Especificación: Escandallo como Fuente de Verdad — Versionado, Teórico vs Real

**Versión:** 1.0.0  
**Depende de:** Motor de costes unificado (costing.ts + ingredient_price_history) + modelo conexo (quote como raíz)  
**Feature:** Heart del módulo de cocina — de aquí derivan compras, producción y costes.

---

## 1. Diagnóstico del estado actual

### Lo que YA existe (aprovechable):
| Componente | Estado | Notas |
|---|---|---|
| `recipe_items` | ✅ Tabla vacía (0 filas) | `catalog_item_id` + `ingredient_id` + `quantity` por ración |
| `ingredient_price_history` | ✅ Tabla vacía | `ingredient_id` + `old_price` + `new_price` + `recorded_at` |
| `event_shopping_items` | ✅ Tiene `actual_quantity`, `actual_unit`, `actual_cost`, `cost_per_unit` | Estructura para real vs teórico ya existe |
| `event_costs` | ✅ Tiene coste por ingrediente por evento | Con los campos que usamos |
| `ingredients.unit_cost` | ✅ Precio actual del ingrediente | Se usa para costing |
| `events.guest_count` | ✅ Número de comensales | Base del escalado |

### Lo que FALTA:
| Componente | Por qué falta |
|---|---|
| **Versión en recipe_items** | No hay `version` ni `version_notes` para versionar recetas |
| **Instanciación al asignar plato** | Cuando se asigna un plato a un evento, no se copian `recipe_items` a `event_shopping_items` |
| **Escalado automático** | `event_shopping_items.theoretical_qty` no se recalcula al cambiar `guest_count` |
| **Desviación Teórico vs Real** | No hay cálculo comparativo ni freeze al cerrar evento |
| **Propagación de cambios de precio** | `unit_cost` cambia pero no recalcula `event_costs` ni alerta por margen |
| **Margin alert** | No hay disparador que avise si un plato cae por debajo de margen mínimo |

---

## 2. Decisiones adoptadas

| Pregunta | Decisión |
|---|---|
| Q1 — Plantilla por plato o libre por evento | **Plantilla por plato** (`recipe_items`) que se instancia por evento. Si se modifica en un evento, queda como versión derivada (no muta el catálogo) |
| Q2 — OCR/voz o manual | **Entrada manual asistida** en esta fase. OCR/voz es fase 2. Aquí se implementa el modelo completo con formularios que muestran desviación teórico vs real y alertas de margen |

---

## 3. Modelo de datos

### 3.1. `recipe_items` — Receta plantilla (escandallo teórico por plato)

Se añade columna `version` y se unifica con `unit_dimension` para escalado automático:

```sql
ALTER TABLE recipe_items ADD COLUMN version       INT NOT NULL DEFAULT 1;
ALTER TABLE recipe_items ADD COLUMN version_note  TEXT; -- motivo del cambio de versión
ALTER TABLE recipe_items ADD COLUMN unit_dimension TEXT CHECK (unit_dimension IN ('mass','volume','count'));
ALTER TABLE recipe_items ADD COLUMN unit           TEXT; -- g / ml / ud
-- unit_dimension y quantity definen la cantidad POR RACIÓN (por comensal)
-- Ejemplo: quantity=200, unit='g', unit_dimension='mass' → 200g por persona
```

**Nueva tabla — versiones históricas de cada receta:**
```sql
CREATE TABLE recipe_item_versions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_item_id  UUID NOT NULL REFERENCES recipe_items(id) ON DELETE CASCADE,
  version         INT NOT NULL,
  quantity        NUMERIC(10,2) NOT NULL,
  unit            TEXT,
  unit_dimension  TEXT,
  changed_by      TEXT DEFAULT 'system',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.2. `event_shopping_items` — Escandallo del evento

Se añaden columnas para **teórico, real y versión**:

```sql
ALTER TABLE event_shopping_items ADD COLUMN recipe_item_id    UUID REFERENCES recipe_items(id) ON DELETE SET NULL;
ALTER TABLE event_shopping_items ADD COLUMN recipe_version    INT NOT NULL DEFAULT 1;  -- versión de la plantilla en el momento de instanciar
ALTER TABLE event_shopping_items ADD COLUMN theoretical_qty   NUMERIC(10,2);           -- cantidad escalada (qty_por_ración * guest_count)
ALTER TABLE event_shopping_items ADD COLUMN theoretical_unit  VARCHAR(20);             -- unidad teórica
-- actual_quantity / actual_unit ya existen — se renombran conceptualmente como 'real'
ALTER TABLE event_shopping_items ADD COLUMN deviation_qty     NUMERIC(10,2);           -- actual_qty - theoretical_qty (calculado)
ALTER TABLE event_shopping_items ADD COLUMN estimated_cost    NUMERIC(10,2);           -- theoretical_qty * cost_per_unit
ALTER TABLE event_shopping_items ADD COLUMN actual_cost_new   NUMERIC(10,2);           -- actual_quantity * unit_cost (real)
ALTER TABLE event_shopping_items ADD COLUMN frozen            BOOLEAN NOT NULL DEFAULT false; -- congelado al cerrar evento
```

### 3.3. `ingredient_price_history` — Historial de precios (ya existe, vacía)

Se completa con un trigger que registra automáticamente cada cambio de `unit_cost`:

```sql
CREATE OR REPLACE FUNCTION record_price_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.unit_cost IS DISTINCT FROM NEW.unit_cost THEN
    INSERT INTO ingredient_price_history (ingredient_id, old_price, new_price, changed_by)
    VALUES (NEW.id, OLD.unit_cost, NEW.unit_cost, 'system');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_record_price
  AFTER UPDATE OF unit_cost ON ingredients
  FOR EACH ROW EXECUTE FUNCTION record_price_change();
```

---

## 4. Reglas de negocio

### 4.1. Instanciación al asignar plato a evento

Cuando se asigna un `catalog_item` a un evento (vía `selected_items` o directamente):

1. Buscar todos los `recipe_items` para ese `catalog_item_id`
2. Para cada ingrediente:
   - `theoretical_qty = recipe_item.quantity * event.guest_count`
   - `theoretical_unit = recipe_item.unit`
   - `cost_per_unit = ingredients.unit_cost`
   - `estimated_cost = theoretical_qty * cost_per_unit`
   - `recipe_item_id = recipe_item.id`
   - `recipe_version = recipe_item.version`
3. Insertar en `event_shopping_items`
4. Recalcular `event_costs` desde cero

### 4.2. Escalado automático al cambiar comensales

Cuando se actualiza `events.guest_count`:

1. Por cada `event_shopping_items` con `recipe_item_id NOT NULL` **y** `frozen = false`:
   - `theoretical_qty = recipe_item.quantity * new_guest_count`
   - `estimated_cost = theoretical_qty * cost_per_unit`
2. Recalcular `event_costs` (total del evento)

### 4.3. Propagación de cambios de precio de ingrediente

Cuando se actualiza `ingredients.unit_cost`:

1. Registrar en `ingredient_price_history` (trigger)
2. Actualizar `cost_per_unit` en todos los `event_shopping_items` donde `ingredient_id = el ingrediente` **y** `frozen = false`
3. Recalcular `estimated_cost` = `theoretical_qty * new_cost_per_unit`
4. Recalcular `event_costs`
5. Para cada plato afectado:
   - Si el nuevo coste hace que **PVP - coste_total < margen_mínimo** → generar **alerta de margen**

### 4.4. Congelación al cerrar evento

Cuando un evento pasa a `status = 'completado'`:

1. Marcar `frozen = true` en todas las `event_shopping_items`
2. Guardar el `actual_qty` final (si se registró)
3. Calcular desviación final:
   - `deviation_qty = actual_qty - theoretical_qty`
   - `deviation_cost = actual_cost_new - estimated_cost`
4. Guardar en tabla nueva `event_cost_deviation`

### 4.5. Notificaciones de margen

Cuando se propaga un precio y un plato cae por debajo de su margen mínimo:

| Campo | Detalle |
|---|---|
| **Disparador** | propagación de precio de ingrediente |
| **Destino** | panel de admin + webhook BUDGET_UPDATE |
| **Frecuencia** | cada vez que ocurre (no batch diario) |
| **Contenido** | "El plato X ha caído por debajo del margen mínimo del 15%. Coste: Y €, PVP: Z €, Margen: W%" |

---

## 5. Nuevas tablas

### `event_cost_deviations`
```sql
CREATE TABLE event_cost_deviations (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id                UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  estimated_total_cost    NUMERIC(12,2) NOT NULL DEFAULT 0,
  actual_total_cost       NUMERIC(12,2) NOT NULL DEFAULT 0,
  deviation_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  deviation_pct           NUMERIC(5,2),
  closed_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes                   TEXT
);
```

---

## 6. API endpoints

| Endpoint | Método | Función |
|---|---|---|
| `/api/escandallo/recipe/[catalogItemId]` | GET | Devuelve recipe_items con versión actual |
| `/api/escandallo/recipe/[catalogItemId]` | PUT | Actualiza recipe_items (crea nueva versión) |
| `/api/escandallo/recipe/[catalogItemId]/versions` | GET | Lista versiones históricas |
| `/api/escandallo/event/[eventId]` | GET | Escandallo del evento (teórico + real + desviación) |
| `/api/escandallo/event/[eventId]/freeze` | POST | Congela escandallo al cerrar evento |
| `/api/escandallo/event/[eventId]/recalc` | POST | Recalcula escalado manualmente |
| `/api/escandallo/deviation/[eventId]` | GET | Devuelve desviación teórico vs real del evento |
| `/api/escandallo/margin-alerts` | GET | Lista alertas de margen activas |

---

## 7. Integración con componentes existentes

| Componente | Cambio |
|---|---|
| `src/lib/costing.ts` | `computeEventCost()` debe usar `theoretical_qty` de `event_shopping_items` si existe, y respetar `frozen` flag |
| `src/app/api/events/[id]/route.ts` | Al hacer GET, incluir `escandallo` en la respuesta con desglose teórico vs real |
| `src/app/api/events/route.ts` | Al actualizar `guest_count` (PUT), disparar recálculo de escandallo |
| `OperationsManager` | Mostrar tabla con teórico vs real, desviación, y botón para registrar `actual_qty` |
| `BudgetEditor` | Incorporar coste del escandallo usando `estimated_cost` |
| `BillingPanel` | Incorporar `actual_total_cost` del `event_cost_deviations` |

---

## 8. Criterios de aceptación

- ✅ Al cambiar `guest_count` en un evento, todas las `theoretical_qty` se recalculan automáticamente
- ✅ Al cambiar `unit_cost` de un ingrediente, todos los `estimated_cost` se propagan y se genera alerta si algún plato cae por debajo de su margen mínimo
- ✅ Al cerrar un evento, su escandallo se congela y se calcula la desviación final
- ✅ Desde un evento se ve en todo momento: teórico vs real, desviación unitaria y total
- ✅ Las versiones de recetas se almacenan y se puede consultar el histórico
- ✅ Cada evento cerrado muestra `deviation_amount` y `deviation_pct`

---

## 9. No Alcance (futuro)

- OCR/voz para registrar consumos reales (fase 2)
- Hojas de producción impresas o PDF exportable (dependiente de este módulo)
- Logística / carga directa desde escandallo (siguiente feature)
- Previsiones de compra desde escandallo (siguiente feature)