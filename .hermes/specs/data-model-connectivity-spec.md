# Especificación: Saneamiento del Modelo de Datos — Grafo Conexo con Presupuesto como Raíz

**Versión:** 1.0.0  
**Depende de:** Motor de costes unificado (costing.ts + event_costs + ingrediente único)  
**Feature transversal:** NO añade módulos — reordena y completa las relaciones existentes.

---

## 1. Diagnóstico del modelo actual

### 1.1 Entidades existentes (catalogadas)

#### Entidades maestras (genéricas del negocio)
| Entidad | Estado | Problema |
|---------|--------|----------|
| `catalog_items` | ✅ | Sin FK a transacciones (correcto — se vincula por uso en `recipe_items`) |
| `ingredients` | ✅ creada | 120 registros, 88 **sin uso** en ningún evento/receta/pedido |
| `providers` | ✅ | Sin FK desde ingredients (120/120 sin `supplier_id`) |
| `clients` | ✅ | Conectada desde `events(client_id)` y `invoices(client_id)` |
| `leads` | ✅ | FK a `clients(converted_to_client_id)`. Sin FK a `events` |
| `workers` | ✅ | 4 sin asignación en ningún staffing_line |
| `recipe_templates` | ✅ | Desconectada de eventos (es plantilla, correcto) |

#### Entidades transaccionales (del ciclo de evento)
| Entidad | FK a events | Problema |
|---------|-------------|----------|
| `quotes` | ✅ (FK) | **Orientación invertida**: quote tiene `event_id`, pero el evento no tiene `quote_id` — el evento es la raíz de facto |
| `events` | — (es la raíz) | 3 eventos sin quote (huérfanos de presupuesto) |
| `event_orders` | ✅ | Correcto, vinculado a quote vía `quote_id FK` |
| `event_shopping_items` | ✅ | Correcto (ingredient_id FK añadido en fase costing) |
| `event_costs` | ✅ | Creada en fase costing |
| `payments` | ✅ | Correcto |
| `invoices` | ✅ | Correcto |
| `staffing_lines` | ✅ | Correcto |
| `worker_event_pay` | ✅ | Correcto |
| `guest_forms` | ✅ | Correcto |
| `guests` | ✅ | Correcto |
| `tables` | ✅ | Correcto |
| `table_plans` | ✅ | Correcto |
| `checklist_tasks` | ✅ | Correcto |
| `email_queue` | ✅ | Correcto |
| `supplier_orders` | ❌ | **Sin event_id** — no se puede remontar al evento que originó el pedido |
| `supplier_order_items` | ❌ | Sin FK a ingredients — usa `ingredient_name text NOT NULL` |
| `cost_desglose` | ✅ | Correcto |
| `event_menu_items` | ✅ | Correcto |

### 1.2 Problemas identificados (ordenados por gravedad)

**🔴 P1 — Orientación Quotes↔Events invertida**  
El quote tiene `event_id FK` (quote cuelga de evento). La spec exige que el **presupuesto (quote) sea la raíz**: evento cuelga de quote. Hoy 3 eventos sin quote confirman que el modelo permite eventos sin presupuesto.

**🔴 P2 — Leads↔Events sin FK**  
Se unen por `LOWER(client_name) = LOWER(lead_name)` o por `client_email`. Sin integridad referencial. Una reasignación de nombre rompe el vínculo.

**🔴 P3 — `selected_items` duplicado**  
Existe como JSONB en `events.selected_items` Y como `quotes.items`. Un concepto, dos sitios — pueden divergir.

**🟡 P4 — `staff_assignments` vs `staffing_assignments`**  
Dos tablas para el mismo concepto. `staff_assignments` tiene 0 filas, está muerta.

**🟡 P5 — `supplier_orders` sin event_id**  
Un pedido a proveedor se origina en un evento (por su escandallo), pero no se puede remontar al evento que lo generó.

**🟡 P6 — `supplier_order_items` usa `ingredient_name` text**  
En lugar de `ingredient_id FK`. Mismo síntoma que `event_shopping_items` antes de la fase costing.

**🟡 P7 — 88 ingredientes sin uso**  
De 120, solo 32 aparecen en escandallos/pedidos/recetas. Los 88 restantes existen en el catálogo de platos pero no se han usado.

**🟡 P8 — 120 ingredientes sin proveedor**  
Ningún ingrediente tiene `supplier_id` poblado. La cadena ingrediente→proveedor no existe.

**🟢 P9 — No hay stock (movimientos)**  
Tabla `stock_entries` o similar no existe. El stock se gestiona en `ingredients.quantity`. Sin trazabilidad de movimientos.

---

## 2. Decisiones adoptadas (respuesta a preguntas de aclaración)

### Q1: ¿Evento sin presupuesto previo?
**Decisión:** Obligatorio hacia adelante. Los 3 huérfanos existentes reciben un `quote` implícito al migrar (con status `historical`). Nuevos eventos NO pueden crearse sin quote.

### Q2: ¿Maestras sin uso?
**Decisión:** Aceptadas como "disponibles" (dadas de alta, no usadas). El sistema debe DETECTARLAS y señalarlas (badge en inventario: "88 ingredientes sin usar"), pero no impedir su existencia. Una maestra que lleva >90 días sin usarse se marca como "inactiva" pero no se borra.

### Q3: ¿Movimientos de stock sin evento?
**Decisión:** Los movimientos de stock se dividen en dos clases:
- **Movimientos operativos**: vinculados a un evento (consumo de escandallo, recepción de pedido a proveedor del evento)
- **Movimientos generales**: compras de previsión, mermas, ajustes de inventario — se permiten sin evento, pero vinculados a un `movement_reason` ('compra_prevision', 'merma', 'ajuste_inventario', 'inventario_inicial')

### Q4: ¿Borrar presupuesto raíz?
**Decisión:** **Archivar en cascada.** No se permite DELETE físico del quote raíz si hay operaciones en marcha (staffing abierto, pedidos pendientes, pagos realizados). Se implementa como `status = 'archived'` con soft-cascade al evento y su descendencia. Los movimientos de stock ya realizados NO se reverten — quedan registrados con `event_id` para trazabilidad histórica.

### Q5: ¿Migrar datos huérfanos?
**Decisión:** **Migrar todo.** Los 3 eventos sin quote reciben presupuesto implícito. Las relaciones leads↔events se materializan en `quotes.lead_id`. `selected_items` se consolida en `quotes.items`. `staff_assignments` (muerta) se elimina. `supplier_order_items` se migra a `ingredient_id`.

---

## 3. Modelo de datos propuesto — Grafo conexo

### 3.1 Clasificación de entidades

#### MAESTRAS (genéricas del negocio, persistentes entre eventos)
```
catalog_items       — Platos del menú (conectados por recipe_items.ingredient_id)
ingredients         — Ingredientes (conectados por event_shopping_items, supplier_order_items, recipe_items)
providers           — Proveedores (conectados por ingredients.supplier_id)
workers             — Trabajadores (conectados por staffing_assignments.worker_id)
clients             — Clientes (conectados por events.client_id)
leads               — Prospectos (conectados por quotes.lead_id → FK materializada)
recipe_templates    — Plantillas de receta (maestra, no cuelga de evento)
uniform_catalog     — Catálogo de uniformes (maestra)
```

#### TRANSACCIONALES (nacen del presupuesto)
```
quotes (presupuesto) ← RAÍZ del ciclo transaccional
  └── events
        ├── event_orders
        │     ├── event_shopping_items → ingredients (maestra)
        │     ├── supplier_orders → supplier_order_items → ingredients (maestra)
        │     ├── event_costs → ingredients (maestra)
        │     └── cost_desglose
        ├── event_menu_items → catalog_items (maestra)
        ├── event_plans
        ├── staffing_lines → staffing_assignments → workers (maestra) → worker_event_pay
        ├── payments
        ├── invoices → clients (maestra)
        ├── guest_forms → guests
        ├── tables / table_plans
        ├── checklist_tasks
        ├── email_queue
        └── audit_log
```

### 3.2 Cambios en el esquema

#### `quotes` → pasa a ser la raíz
```sql
-- quotes.lead_id FK (materializar la relación leads↔events)
-- events NUEVA columna: quote_id UUID NOT NULL REFERENCES quotes(id)
ALTER TABLE events ADD COLUMN quote_id UUID REFERENCES quotes(id);
ALTER TABLE events ALTER COLUMN quote_id SET NOT NULL; -- después de migrar

-- consolidated selected_items: SOLO en quotes, eliminar de events
-- Migrar: INSERT INTO quotes.items SELECT selected_items FROM events WHERE id = quote.event_id
```

#### `leads` → FK materializada a `quotes`
```sql
ALTER TABLE leads ADD COLUMN quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL;
-- Permite remontar lead→quote→event→todo_lo_transaccional
```

#### Eliminar duplicidad `staff_assignments`
```sql
DROP TABLE IF EXISTS staff_assignments; -- muerta, 0 filas
```

#### `supplier_orders` → añadir event_id
```sql
ALTER TABLE supplier_orders ADD COLUMN event_id UUID REFERENCES events(id) ON DELETE SET NULL;
-- NOT NULL para pedidos operativos, NULL para pedidos generales (compras de previsión)
ALTER TABLE supplier_orders ADD COLUMN origin TEXT CHECK (origin IN ('escandallo', 'manual', 'reaprovisionamiento'));
```

#### `supplier_order_items` → migrar a ingredient_id
```sql
ALTER TABLE supplier_order_items ADD COLUMN ingredient_id UUID REFERENCES ingredients(id);
-- Migrar: SET ingredient_id = (SELECT id FROM ingredients WHERE LOWER(name) = LOWER(supplier_order_items.ingredient_name))
-- Luego: ALTER TABLE supplier_order_items ALTER COLUMN ingredient_id SET NOT NULL;
```

#### `ingredients` → conectar a providers
```sql
-- supplier_id ya existe en ingredients, solo poblarla
-- Los 120 ingredientes sin supplier se marcan como alerts en el panel
```

#### `events` → quote_id NOT NULL + eliminar selected_items si migrado
```sql
-- selected_items se conserva temporalmente durante migración, luego se elimina
-- Alternativa: mantener selected_items como cache desnormalizada (mejor para queries)
-- NOTA: Si se mantiene, sincronizar con quotes.items vía trigger o punto único de escritura
```

---

## 4. Cadena de trazabilidad

### 4.1 Desde presupuesto → toda la descendencia

```
quote(id=X)
  → events WHERE quote_id = X
    → event_orders WHERE event_id = Y
      → event_shopping_items → ingredients → providers
      → supplier_orders → supplier_order_items → ingredients
      → event_costs → ingredients
      → cost_desglose
    → event_menu_items → catalog_items
    → staffing_lines → staffing_assignments → workers → worker_event_pay
    → payments
    → invoices → clients
    → guest_forms → guests
    → tables, table_plans
    → checklist_tasks
    → audit_log
    → email_queue
    → leads (vía quotes.lead_id)
```

### 4.2 Desde entidad maestra → eventos/presupuestos donde participa

**Ingrediente:**
```sql
SELECT DISTINCT e.id AS event_id, q.id AS quote_id
FROM ingredients i
JOIN event_shopping_items esi ON esi.ingredient_id = i.id
JOIN events e ON e.id = esi.event_id
JOIN quotes q ON q.id = e.quote_id
WHERE i.id = $1
UNION
SELECT DISTINCT e.id, q.id
FROM ingredients i
JOIN supplier_order_items soi ON soi.ingredient_id = i.id
JOIN supplier_orders so ON so.id = soi.order_id
LEFT JOIN events e ON e.id = so.event_id
LEFT JOIN quotes q ON q.id = e.quote_id
WHERE i.id = $1;
```

**Trabajador:**
```sql
SELECT DISTINCT e.id AS event_id, q.id AS quote_id
FROM workers w
JOIN staffing_assignments sa ON sa.worker_id = w.id
JOIN staffing_lines sl ON sl.id = sa.staffing_line_id
JOIN events e ON e.id = sl.event_id
JOIN quotes q ON q.id = e.quote_id
WHERE w.id = $1;
```

**Plato del catálogo:**
```sql
SELECT DISTINCT e.id AS event_id, q.id AS quote_id
FROM catalog_items ci
JOIN event_menu_items emi ON emi.catalog_item_id = ci.id
JOIN events e ON e.id = emi.event_id
JOIN quotes q ON q.id = e.quote_id
WHERE ci.id = $1;
```

---

## 5. Reglas de integridad (CHECK y triggers)

### 5.1 No crear transaccional sin vínculo al presupuesto
```sql
-- Trigger: antes de INSERT en events, quote_id debe existir
CREATE OR REPLACE FUNCTION check_event_has_quote()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quote_id IS NULL THEN
    RAISE EXCEPTION 'Un evento debe tener un quote_id (presupuesto raíz)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM quotes WHERE id = NEW.quote_id) THEN
    RAISE EXCEPTION 'El quote_id % no existe', NEW.quote_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_event_quote BEFORE INSERT OR UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION check_event_has_quote();
```

### 5.2 No referenciar maestra inexistente
```sql
-- Ya existen FKs para la mayoría. Faltan:
-- supplier_order_items.ingredient_id → ingredients(id) FK (añadir)
-- supplier_orders.event_id → events(id) FK (añadir)
```

### 5.3 Borrado/desactivación de maestras en uso
```sql
-- NO se permite DELETE de ingredients con event_shopping_items activos
-- Usar ON DELETE RESTRICT donde corresponda
-- Alternativa: ON DELETE SET NULL + alerta en UI "Ingrediente en uso en X eventos"
```

---

## 6. Criterios de aceptación (QA)

- [ ] Desde cualquier presupuesto (`quote.id`) se puede recorrer toda la descendencia transaccional por FKs reales
- [ ] Desde cualquier ingrediente se responde en qué eventos y presupuestos ha intervenido
- [ ] Desde cualquier trabajador se responde en qué eventos y presupuestos ha trabajado
- [ ] No existe ninguna entidad transaccional que no remonte a un presupuesto (FK != NULL)
- [ ] `staff_assignments` eliminada sin pérdida de datos (0 filas)
- [ ] `supplier_orders` tiene event_id poblado para pedidos operativos
- [ ] `supplier_order_items` usa ingredient_id (FK), no ingredient_name text
- [ ] Los 3 eventos huérfanos migrados con quote implícito
- [ ] Los leads tienen FK materializada a quotes (lead→quote→event→todo)
- [ ] El inventario muestra alerta: "88 ingredientes sin uso", "4 trabajadores sin asignar", "120 ingredientes sin proveedor"
- [ ] La UI impide crear evento sin presupuesto (quote)
