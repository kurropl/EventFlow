# Especificación: Módulo Cocina — Hojas Operativas y Gestión de Escandallos

**Versión:** 1.0.0  
**Depende de:** Escandallo como Fuente de Verdad (versionado, teórico vs real) + Motor de costes unificado  
**Feature:** Generación automática de hojas de producción, carga y logística desde el escandallo del evento. Gestión de recetas con importación manual/Excel. Gestión de equipamiento con stock real.

---

## 1. Decisiones adoptadas

| Pregunta | Decisión |
|---|---|
| Q1 — Pases de servicio | **Automático por categoría** con mapeo por defecto, reasignable manualmente en cada evento |
| Q2 — Equipamiento | **Gestión con stock real**: tabla propia con unidades disponibles, editable desde admin |

---

## 2. Diagnóstico del estado actual

### Lo que YA existe:
| Componente | Estado |
|---|---|
| `catalog_items` con categoría | ✅ 10 categorías, cada plato tiene categoría |
| `recipe_items` con ingredientes por ración | ✅ Estructura creada (vacía 0 filas) |
| `event_shopping_items` con teórico/real | ✅ Columnas migradas |
| `events.selected_items` con items del menú | ✅ JSONB con name, category, quantity por plato |

### Lo que FALTA:
| Componente | Por qué falta |
|---|---|
| Mapeo categoría → pase de servicio | No existe tabla ni configuración |
| Asignación de pase por evento | `selected_items` no tiene campo `service_pass` |
| Tabla de recetas subidas | No hay entidad para recetas independientes (PDF/Excel) |
| Tabla de equipamiento | No hay catálogo de equipos con stock |
| Reglas de equipamiento por plato/categoría | No existe mapeo plato → utensilios necesarios |
| Generación de hojas | Endpoints de producción, carga y logística |

---

## 3. Modelo de datos

### 3.1. `service_passes` — Pases de servicio (mapeo por defecto)

```sql
CREATE TABLE IF NOT EXISTS service_passes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pass_number INT NOT NULL,        -- 1, 2, 3, 4, 5
    name TEXT NOT NULL,               -- 'Aperitivos', 'Principales', etc.
    icon TEXT DEFAULT '🍽️',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Pases por defecto
INSERT INTO service_passes (pass_number, name, icon, sort_order) VALUES
    (1, 'Aperitivos y entrantes', '🥟', 1),
    (2, 'Mesas y compartidos', '🥘', 2),
    (3, 'Principal', '🥩', 3),
    (4, 'Dulce y final', '🍰', 4),
    (5, 'Bebidas', '🥂', 5),
    (99, 'Complementos', '🧂', 99);
```

### 3.2. `category_pass_mapping` — Mapeo categoría → pase (por defecto)

```sql
CREATE TABLE IF NOT EXISTS category_pass_mapping (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category TEXT NOT NULL UNIQUE,    -- 'aperitivo-frio', 'carne', etc.
    pass_id UUID NOT NULL REFERENCES service_passes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Mapeo por defecto
INSERT INTO category_pass_mapping (category, pass_id) VALUES
    ('aperitivo-frio',    (SELECT id FROM service_passes WHERE pass_number = 1)),
    ('aperitivo-caliente', (SELECT id FROM service_passes WHERE pass_number = 1)),
    ('compartir-mesa',    (SELECT id FROM service_passes WHERE pass_number = 2)),
    ('arroz',             (SELECT id FROM service_passes WHERE pass_number = 3)),
    ('carne',             (SELECT id FROM service_passes WHERE pass_number = 3)),
    ('pescado',           (SELECT id FROM service_passes WHERE pass_number = 3)),
    ('sorbete',           (SELECT id FROM service_passes WHERE pass_number = 4)),
    ('postre',            (SELECT id FROM service_passes WHERE pass_number = 4)),
    ('bebida',            (SELECT id FROM service_passes WHERE pass_number = 5)),
    ('complemento',       (SELECT id FROM service_passes WHERE pass_number = 99));
```

### 3.3. `events` — Añadir `service_passes` personalizado por evento

```sql
ALTER TABLE events ADD COLUMN IF NOT EXISTS custom_pass_order JSONB;
-- Formato: [{"item_name": "Carrillera", "pass_number": 3}, ...]
-- Sobrescribe el mapeo por defecto de categoría→pase para platos concretos
```

### 3.4. `equipment` — Catálogo de equipamiento con stock

```sql
CREATE TABLE IF NOT EXISTS equipment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,               -- 'Freidora industrial', 'Bandeja de horno'
    category TEXT NOT NULL,           -- 'utensilio', 'vajilla', 'maquinaria', 'textil', 'mobiliario'
    unit TEXT NOT NULL DEFAULT 'ud',  -- ud, par, m2, juego
    stock_quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
    min_stock NUMERIC(10,2) DEFAULT 0,
    notes TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment(category);
```

### 3.5. `equipment_rules` — Reglas: qué equipamiento necesita cada plato/categoría

```sql
CREATE TABLE IF NOT EXISTS equipment_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category TEXT,                    -- NULL = aplica a todos, sino: 'fritura', 'horno', etc. 
    catalog_item_id UUID REFERENCES catalog_items(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    quantity_per_use NUMERIC(10,2) NOT NULL DEFAULT 1,  -- unidades por plato o por evento
    per_guest BOOLEAN DEFAULT false,  -- true = escalar por comensal, false = 1 por evento
    notes TEXT
);
```

### 3.6. `recipes` — Recetas subidas (independientes del catálogo)

```sql
CREATE TABLE IF NOT EXISTS recipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    source TEXT,                      -- 'manual', 'excel', 'pdf', 'scanned'
    source_file TEXT,                 -- ruta al archivo original
    servings INT DEFAULT 1,           -- número de raciones de la receta
    category TEXT,
    ingredients JSONB DEFAULT '[]',   -- copia de los ingredientes con cantidades
    -- Formato: [{"name": "harina", "quantity": 500, "unit": "g", "ingredient_id": "uuid"}, ...]
    instructions TEXT,
    prep_time INT,                    -- minutos
    cook_time INT,                    -- minutos
    difficulty TEXT DEFAULT 'media',  -- 'facil', 'media', 'dificil'
    version INT NOT NULL DEFAULT 1,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.7. `event_production_sheets` — Hojas operativas generadas (cache)

```sql
CREATE TABLE IF NOT EXISTS event_production_sheets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    sheet_type TEXT NOT NULL,         -- 'production', 'loading', 'logistics'
    content JSONB NOT NULL,           -- datos precalculados de la hoja
    generated_at TIMESTAMPTZ DEFAULT now(),
    regenerated_at TIMESTAMPTZ,
    UNIQUE(event_id, sheet_type)
);
```

---

## 4. Reglas de negocio

### 4.1. Asignación de pase de servicio

Cuando se muestra el menú de un evento:
1. Por defecto, cada plato hereda su pase del `category_pass_mapping` según su categoría
2. Si el evento tiene `custom_pass_order`, los platos mencionados usan su pase personalizado
3. El frontend muestra un selector de pase para cada plato, permitiendo reasignación manual
4. Al guardar, se actualiza `events.custom_pass_order`

### 4.2. Hoja de producción

Se genera **N días antes del evento** (N configurable, por defecto 3):

| Sección | Contenido | Origen |
|---|---|---|
| Partida 1 (Pase 1) | Platos del pase 1 con ingredientes y cantidades | escandallo × guest_count |
| Partida 2 (Pase 2) | Platos del pase 2 | escandallo × guest_count |
| ... | ... | ... |
| Total por ingrediente | Suma de cantidades de cada ingrediente en todos los pases | agregación |

Formato: tabla con columnas `Ingrediente | Cantidad Total | Unidad | Plato(s) | Pase`

### 4.3. Hoja de carga

Se genera **el mismo día del evento**, para cargar la furgoneta:

- Cada plato desglosado por **pase** y por **número de unidades** (ración × comensales)
- Agrupa todos los ingredientes de todos los escandallos en una sola lista de "producto a cargar"
- Columnas: `Producto | Cantidad | Unidad | Perecedero/No | Pase | Plato`

### 4.4. Hoja logística

Lista de todo lo necesario que **no son ingredientes**:

| Sección | Contenido |
|---|---|
| **Equipamiento reutilizable** | De `equipment_rules` según platos del evento. Se descuenta del stock disponible |
| **Producto seco** (no perecedero) | Ingredientes del escandallo con `unit IN ('kg','gr')` y que no perecen (harina, sal, azúcar) |
| **Perecedero** | Ingredientes frescos que requieren nevera (carne, pescado, verduras, lácteos) |
| **Descartables** (un solo uso) | Papel film, papel de horno, servilletas, guantes |

### 4.5. Gestión de stock de equipamiento

- Cada evento "reserva" unidades de equipamiento (se descuentan virtualmente del stock)
- Al cerrar el evento, se liberan
- Si no hay stock suficiente, se muestra alerta en la hoja logística
- Se puede editar el stock manualmente desde el panel de admin

### 4.6. Apartado Receta

Panel independiente en el admin con:
- **Lista de recetas**: tabla con nombre, categoría, ingredientes, tiempo de preparación
- **Subir receta**: formulario manual con campos de ingredientes y pasos
- **Importar Excel**: subir archivo XLSX con columnas: nombre, ingrediente, cantidad, unidad, pasos
- **Crear escandallo desde receta**: botón para copiar los ingredientes de una receta a `recipe_items` de un `catalog_item`
- **Versionado**: cada modificación incrementa versión, se guarda histórico (reutiliza `recipe_item_versions`)

---

## 5. Nuevas tablas (resumen)

| Tabla | Propósito |
|---|---|
| `service_passes` | Catálogo de pases de servicio (1-5 + complementos) |
| `category_pass_mapping` | Mapeo categoría de plato → pase por defecto |
| `equipment` | Catálogo de equipamiento con stock |
| `equipment_rules` | Reglas: qué equipo necesita cada plato/categoría |
| `recipes` | Recetas subidas (manual/Excel) |
| `event_production_sheets` | Cache de hojas generadas |

---

## 6. API endpoints

| Endpoint | Método | Función |
|---|---|---|
| `/api/cocina/passes` | GET | Lista pases de servicio con mapeo por defecto |
| `/api/cocina/passes` | PUT | Actualizar mapeo categoría → pase |
| `/api/cocina/event/[eventId]/passes` | GET | Pases del evento con platos asignados |
| `/api/cocina/event/[eventId]/passes` | PUT | Guardar reasignación manual de pases |
| `/api/cocina/event/[eventId]/production-sheet` | GET | Hoja de producción (JSON + CSV/PDF) |
| `/api/cocina/event/[eventId]/loading-sheet` | GET | Hoja de carga |
| `/api/cocina/event/[eventId]/logistics-sheet` | GET | Hoja logística con equipamiento |
| `/api/cocina/equipment` | GET/POST | CRUD equipamiento |
| `/api/cocina/equipment-rules` | GET/POST | CRUD reglas de equipamiento |
| `/api/cocina/recipes` | GET/POST | CRUD recetas |
| `/api/cocina/recipes/import` | POST | Importar Excel |
| `/api/cocina/recipes/[id]/to-escandallo` | POST | Copiar receta a recipe_items de un catalog_item |

---

## 7. Criterios de aceptación

- ✅ La hoja de producción se genera desde el escandallo sin reintroducir datos
- ✅ La hoja de carga muestra cada plato desglosado por pase y número de unidades
- ✅ La hoja logística separa equipamiento, producto seco y perecederos
- ✅ El equipamiento tiene stock real, se descuenta al generar hoja y se alerta si falta
- ✅ Se pueden subir recetas manualmente o por Excel
- ✅ Desde una receta se puede crear un escandallo de catálogo con un clic
- ✅ Los pases de servicio se asignan por defecto según categoría, pero se reasignan manualmente en cada evento

---

## 8. No Alcance (futuro)

- Impresión nativa a PDF (se usa print del navegador por ahora)
- Integración con API de cáterin externo
- Planificación de rutas de carga
- Control de temperatura de perecederos durante el transporte