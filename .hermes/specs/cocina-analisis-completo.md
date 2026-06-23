# Análisis de Cocina — EventFlow ERP
## Recetas · Escandallos · Hojas de Operación · APPCC

### Estado Actual (22/06/2026)
**60 tablas** en PostgreSQL — la BD está completa. Lo que falta es el **Frontend operativo** y los **flujos de control**.

---

## 1. RECETAS (Hecho — necesita pulir)
- ✅ `recipes` — tabla con campos básicos (name, category, version, published, ingredients jsonb)
- ✅ `recipe_templates` — plantillas por pax base (50 pax)
- ✅ `recipe_template_items` — items por plantilla (ingredient_name, quantity_per_pax)
- ✅ `recipe_items` — items de receta individual (FK → catalog_items, versionado)
- ✅ `recipe_item_versions` — versionado histórico
- ✅ `catalog_items` — catálogo de platos
- ✅ `catalog_item_id` FK en recipes
- ❌ **Falta**: `recipe_categories` (tipos: entrante, principal, postre, guarnición, salsa)
- ❌ **Falta**: `recipe_allergens` (alérgenos por receta)
- ❌ **Falta**: `recipe_nutrition` (valores nutricionales por comensal)
- ❌ **Falta**: `recipe_cost_history` (histórico de coste de plato por cambio de ingrediente)

## 2. ESCANDALLO DE ALIMENTOS (Hecho)
- ✅ `event_shopping_items` — tabla central de escandallo por evento
  - `theoretical_qty`, `actual_quantity`, `estimated_cost`, `actual_cost_total`
  - `frozen` (congelado al cerrar evento)
  - `recipe_version` (versionado de la receta en el momento)
- ✅ `recipe_item_id` FK → recipe_items
- ✅ `deviation_qty`, `deviation_cost` — desviaciones
- ✅ `unit_dimension` (mass/volume/count)
- ❌ **Falta**: API de escandallo para evento (GET/PUT `event_shopping_items`)
- ❌ **Falta**: UI de escandallo en EventDetail (ver/editar cantidades reales)
- ❌ **Falta**: Cálculo automático de coste por ingrediente (escala por guest_count)

## 3. ESCANDALLO DE MATERIAL (Hecho)
- ✅ `cost_desglose` — tabla con line_type y total por evento
  - `line_type` = plato, servicio, personal, montaje, extras, margen
- ✅ `event_costs` — costes reales registrados
- ✅ `event_cost_deviations` — desviaciones
- ❌ **Falta**: UI para registrar material (vajilla, mantelería, mobiliario)
- ❌ **Falta**: Asignación automática de material por tipo de plato

## 4. HOJAS DE OPERACIONES (Hecho — parcial)
- ✅ `event_plans` — tabla de planificación
- ✅ `event_orders` — pedidos con estado (in_progress, completed, cancelled, reopened)
- ✅ `checklist_tasks`, `checklist_templates` — checklist por evento
- ✅ `staffing_assignments` — asignación de personal
- ✅ `automation_rules` — reglas de automatización
- ✅ `automation_logs` — logs de automatización
- ❌ **Falta**: **Hoja de Operación PDF** (imprimible con: recetas, personal, cronograma, planos)
- ❌ **Falta**: **Cronograma de evento** (timeline tipo Gantt: mise-en-place → servicio → recogida)
- ❌ **Falta**: **Trazabilidad de plato** (qué lote de qué ingrediente fue a qué plato)

## 5. APPCC — Análisis de Peligros y Puntos Críticos (No existe)
- ❌ **No existe**: `haccp_plans` — tabla de plan APPCC
- ❌ **No existe**: `haccp_critical_limits` — límites críticos (temperatura, pH, tiempo)
- ❌ **No existe**: `haccp_monitoring_log` — registro diario de monitorización
- ❌ **No existe**: `haccp_corrective_actions` — acciones correctivas
- ❌ **No existe**: `haccp_verification` — verificación (fechas, responsable, resultado)
- ❌ **No existe**: `fridge_temperature_log` — registro de temperaturas de neveras
- ❌ **No existe**: `cleaning_log` — registro de limpieza (FIFO, plan de limpieza)
- ❌ **No existe**: `supplier_approval` — proveedores homologados con criterios APPCC
- ❌ **No existe**: `traceability_log` — trazabilidad completa lote→plato

## 6. FLUJO COMPLETO COCINA
- ❌ **Falta**: **Dashboard cocina** con:
  - ⏱ Tiempo real: qué eventos están en curso (cronograma)
  - 🧮 Escandallo pendiente vs completado
  - 📋 Checklist de operaciones
  - 🌡 Alertas APPCC (temperatura fuera de rango)
  - 🧾 Alertas de lote próximo a caducar (ya existe `CocinaAlerts`)
  - 🔔 Alertas de stock bajo (ya existe)
- ❌ **Falta**: **Vista de evento en cocina** (un solo espacio con: mapa mesas, escandallo, recetas, hojas, APPCC)
- ❌ **Falta**: **Vista de producción** (qué se está cocinando ahora)

---

## Plan de Implementación

### Fase 1 — APPCC (Modelo de datos)
**Crear tablas:**
```sql
-- Planes APPCC por establecimiento/evento
CREATE TABLE haccp_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id),
  plan_type TEXT NOT NULL CHECK (plan_type IN ('general','catering','specific')),
  version INT NOT NULL DEFAULT 1,
  approved_by TEXT,
  approval_date DATE,
  valid_until DATE,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Límites críticos
CREATE TABLE haccp_critical_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES haccp_plans(id),
  parameter TEXT NOT NULL,  -- 'temp_fridge','temp_cook','temp_reheat','ph','time','storage'
  min_value NUMERIC(6,2),
  max_value NUMERIC(6,2),
  unit TEXT,
  corrective_action TEXT,
  frequency TEXT  -- 'cada_30min','por_lote','diario'
);

-- Monitorización
CREATE TABLE haccp_monitoring (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  limit_id UUID REFERENCES haccp_critical_limits(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by TEXT,
  value NUMERIC(6,2),
  unit TEXT,
  status TEXT CHECK (status IN ('ok','warning','critical')),
  notes TEXT
);

-- Temperaturas de neveras
CREATE TABLE fridge_temperature_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fridge_name TEXT NOT NULL,
  fridge_type TEXT CHECK (fridge_type IN ('fridge','freezer','cold_room')),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  temperature NUMERIC(5,2),
  target_min NUMERIC(5,2),
  target_max NUMERIC(5,2),
  status TEXT,
  recorded_by TEXT,
  notes TEXT
);

-- Plan de limpieza
CREATE TABLE cleaning_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area TEXT NOT NULL,
  schedule TEXT,  -- 'diario','semanal','mensual'
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  performed_by TEXT,
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  products_used TEXT[],
  notes TEXT
);

-- Proveedores homologados
CREATE TABLE supplier_approval (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES suppliers(id),
  approved_at DATE,
  expires_at DATE,
  approved_by TEXT,
  criteria_met TEXT[],
  status TEXT DEFAULT 'active'
);

-- Trazabilidad lote → plato
CREATE TABLE traceability_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id),
  ingredient_id UUID REFERENCES ingredients(id),
  lot_number TEXT,
  batch_quantity NUMERIC,
  used_at TIMESTAMPTZ,
  used_by TEXT,
  recipe_id UUID REFERENCES recipes(id),
  guest_served INT,
  is_critical BOOLEAN DEFAULT false,
  notes TEXT
);
```

### Fase 2 — APPCC Frontend
- `HACCPPanel` — panel de control APPCC en cocina
- `FridgeTemperatureMonitor` — entrada de temperaturas (formulario)
- `CleaningSchedule` — plan de limpieza con checklist
- `SupplierApprovalView` — proveedores homologados

### Fase 3 — Dashboard Cocina completo
- Unificar `CocinaPanel` → vistas por pestaña:
  - **Producción** (qué se cocina ahora)
  - **APPCC** (temperaturas, límites críticos)
  - **Escandallo** (pendiente vs completado)
  - **Alertas** (caducidad, stock bajo)
  - **OCR** (escanear tickets)
- **Vista de evento en cocina**: mapa mesas + escandallo + recetas + checklist