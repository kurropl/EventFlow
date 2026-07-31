# SDD: Reestructuración Módulo Cocina

## 1. Análisis de Fórmulas de Excel

### Fórmulas encontradas:

| Archivo | Fórmula | Lógica de Negocio |
|---------|---------|-------------------|
| INVENTARIO COCINA | `SUM(C143*0.25)` | **25% merma** — Se aplica un 25% de merma al total de inventario |
| PARTE FINANCIERA | `D4*1.1` | **10% inflación** — Incremento de costes |
| PARTE FINANCIERA | `(1+R7)^R8` | **Crecimiento compuesto** — Proyección de crecimiento |
| COMPARATIVA | `SUM(D6:E12)` | **Suma por categorías** — Comparativa anual |

### Lógica a implementar:

```typescript
// 1. Merma del 25% en inventario
const MERMA_PCT = 0.25; // 25% de merma estándar
const cantidadNeta = cantidadBruta * (1 - MERMA_PCT);

// 2. Coste con merma en escandallo
const costeConMerma = costeBase * (1 + MERMA_PCT);

// 3. Inflación para proyecciones
const costeProyectado = costeActual * (1 + inflacionPct);
```

---

## 2. Estructura Actual vs Propuesta

### ACTUAL (7 secciones):
```
Panel → Recetas → Escandallos → Producción → Carga → Logística → Stock → APPCC
```

### PROPUESTA (6 secciones):
```
Panel → Recetas → Escandallos → Producción → Carga → APPCC
```

### Cambios:
- **ELIMINAR**: Stock (se integra en Escandallos y Logística)
- **AMPLIAR**: Producción (timing, distribución, checklist)
- **AMPLIAR**: Carga (vajilla, packs)
- **AMPLIAR**: Recetas (acciones, días anticipación)

---

## 3. FASE 1: Base de Datos

### 3.1 Nuevas tablas

```sql
-- Timeline del evento
CREATE TABLE IF NOT EXISTS event_timeline (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  phase text NOT NULL CHECK (phase IN ('llegada', 'preparacion', 'servicio', 'limpieza', 'salida')),
  concepto text NOT NULL,
  planned_time time,
  actual_time time,
  duration_minutes int,
  notes text,
  orden int DEFAULT 0,
  created_at timestamptz DEFAULT NOW()
);

-- Zonas de cocina
CREATE TABLE IF NOT EXISTS kitchen_zones (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre text NOT NULL UNIQUE,
  icon text,
  orden int DEFAULT 0
);

-- Datos iniciales zonas
INSERT INTO kitchen_zones (nombre, icon, orden) VALUES
('aperitivos', '🥗', 1), ('frio', '❄️', 2), ('caliente', '🔥', 3),
('frito', '🍟', 4), ('entrante', '🍽', 5), ('primero', '🥘', 6),
('segundo', '🥩', 7), ('postre', '🍰', 8), ('recena', '🌙', 9)
ON CONFLICT (nombre) DO NOTHING;

-- Vajilla/Loza
CREATE TABLE IF NOT EXISTS tableware_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo text NOT NULL CHECK (tipo IN ('plato', 'cubiertos', 'cristaleria', 'textil', 'otros')),
  nombre text NOT NULL,
  stock_total int DEFAULT 0,
  stock_disponible int DEFAULT 0,
  proveedor text,
  coste_alquiler numeric(10,2) DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT NOW()
);

-- Vajilla por evento
CREATE TABLE IF NOT EXISTS event_tableware (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES tableware_items(id),
  cantidad_necesaria int NOT NULL,
  cantidad_cargada int DEFAULT 0,
  proveedor text,
  alquilado boolean DEFAULT false,
  notas text,
  created_at timestamptz DEFAULT NOW()
);

-- Packs predefinidos
CREATE TABLE IF NOT EXISTS pack_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT NOW()
);

-- Packs por evento
CREATE TABLE IF NOT EXISTS event_packs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  pack_id uuid NOT NULL REFERENCES pack_templates(id),
  items_personalizados jsonb,
  completado boolean DEFAULT false,
  created_at timestamptz DEFAULT NOW()
);

-- Datos iniciales packs
INSERT INTO pack_templates (nombre, items) VALUES
('Pack Camareros', '[{"nombre":"Pan","cantidad":10,"unidad":"ud"},{"nombre":"Mantequilla","cantidad":10,"unidad":"ud"},{"nombre":"Agua","cantidad":5,"unidad":"botella"},{"nombre":"Café","cantidad":10,"unidad":"taza"}]'),
('Pack Alérgenos', '[{"nombre":"Pan sin gluten","cantidad":5,"unidad":"ud"},{"nombre":"Leche soja","cantidad":2,"unidad":"litro"},{"nombre":"Postre sin lactosa","cantidad":5,"unidad":"ud"}]'),
('Pack Supervivencia', '[{"nombre":"Sal","cantidad":1,"unidad":"kg"},{"nombre":"Pimienta","cantidad":1,"unidad":"kg"},{"nombre":"AOVE","cantidad":1,"unidad":"litro"},{"nombre":"Film","cantidad":1,"unidad":"rollo"},{"nombre":"Aluminio","cantidad":1,"unidad":"rollo"}]')
ON CONFLICT DO NOTHING;
```

### 3.2 Modificaciones a tablas existentes

```sql
-- Añadir a recipes
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS preparation_steps jsonb DEFAULT '[]';
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS prep_days_before int DEFAULT 1;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS estimated_time_minutes int;

-- Añadir a staffing_lines
ALTER TABLE staffing_lines ADD COLUMN IF NOT EXISTS kitchen_zone text;
ALTER TABLE staffing_lines ADD COLUMN IF NOT EXISTS previsto int DEFAULT 0;
ALTER TABLE staffing_lines ADD COLUMN IF NOT EXISTS real int DEFAULT 0;

-- Añadir a events para timing
ALTER TABLE events ADD COLUMN IF NOT EXISTS setup_time_minutes int DEFAULT 180;
ALTER TABLE events ADD COLUMN IF NOT EXISTS service_start time;
ALTER TABLE events ADD COLUMN IF NOT EXISTS service_end time;

-- Índices
CREATE INDEX IF NOT EXISTS idx_timeline_event ON event_timeline(event_id);
CREATE INDEX IF NOT EXISTS idx_tableware_event ON event_tableware(event_id);
CREATE INDEX IF NOT EXISTS idx_packs_event ON event_packs(event_id);
```

---

## 4. FASE 2: APIs

### 4.1 Timeline API
```
GET    /api/cocina/timeline?event_id=xxx     — Obtener timeline del evento
POST   /api/cocina/timeline                  — Crear/actualizar timeline
PUT    /api/cocina/timeline/[id]             — Actualizar entrada
DELETE /api/cocina/timeline/[id]             — Eliminar entrada
```

### 4.2 Tableware API
```
GET    /api/cocina/tableware                 — Listar vajilla (inventario)
POST   /api/cocina/tableware                 — Añadir vajilla
PUT    /api/cocina/tableware/[id]            — Actualizar vajilla
GET    /api/cocina/tableware/event?event_id  — Vajilla del evento
POST   /api/cocina/tableware/event           — Asignar vajilla a evento
```

### 4.3 Packs API
```
GET    /api/cocina/packs                     — Listar plantillas de packs
POST   /api/cocina/packs                     — Crear plantilla
GET    /api/cocina/packs/event?event_id      — Packs del evento
POST   /api/cocina/packs/event               — Asignar pack a evento
```

### 4.4 Producción API (mejorar existente)
```
GET    /api/cocina/produccion?event_id       — Obtener hoja producción
POST   /api/cocina/produccion                — Crear hoja
PUT    /api/cocina/produccion/[id]           — Actualizar
GET    /api/cocina/produccion/weekly         — Vista semanal
```

---

## 5. FASE 3: Páginas

### 5.1 Producción (REESCRIBIR)

```
ESTRUCTURA NUEVA:
┌─────────────────────────────────────────────────────────────────┐
│ 🍳 PRODUCCIÓN                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ [Selector Evento]                                               │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ⏰ TIMING           │ 👥 DISTRIBUCIÓN POR ZONA             │ │
│ │                      │                                      │ │
│ │ 08:00 Llegada DG    │ 🥗 Aperitivos: Carlos (2)           │ │
│ │ 08:30 Llegada camión│ ❄️ Frío: Ana (2)                    │ │
│ │ 09:00 Inicio prep   │ 🔥 Caliente: Pedro (4)              │ │
│ │ 13:00 Fin prep      │ 🍟 Frito: María (2)                 │ │
│ │ 13:30 Servicio ini  │ 🍽 Entrante: Luis (2)               │ │
│ │ 16:00 Limpieza      │ 🥘 Primero: Ana (2)                  │ │
│ │ 17:00 Salida        │ 🥩 Segundo: Pedro (2)                │ │
│ │                      │ 🍰 Postre: Laura (2)                 │ │
│ │ [Editar Timing]     │ [Editar Distribución]                │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 📋 CHECKLIST DE TAREAS                                      │ │
│ │                                                              │ │
│ │ ☑ Cortar verduras aperitivos      Carlos - 09:00    ✅     │ │
│ │ ☑ Preparar ensaladilla base       Ana - 09:30        ✅     │ │
│ │ ☐ Hornear quiches                 María - 10:00      ⏳     │ │
│ │ ☐ Marcar carne principal          Pedro - 11:00      ⏳     │ │
│ │ ☐ Preparar salsas                 Laura - 11:30      ⏳     │ │
│ │                                                              │ │
│ │ [Añadir Tarea]                                              │ │
│ │                                                              │ │
│ │ Progreso: ████████████░░░░░ 65%                            │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Carga (AMPLIAR)

```
ESTRUCTURA NUEVA:
┌─────────────────────────────────────────────────────────────────┐
│ 🚚 CARGA                                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ [Selector Evento]                                               │
│                                                                  │
│ [Tabs: Comida | Vajilla | Packs | Material]                     │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🍽 COMIDA POR PASES                                         │ │
│ │                                                              │ │
│ │ 1er Pase: Aperitivos fríos    ☑ Cargado                   │ │
│ │ 2do Pase: Calientes           ☑ Cargado                   │ │
│ │ 3er Pase: Postre              ☐ Pendiente                  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🍴 VAJILLA                                                  │ │
│ │                                                              │ │
│ │ Tipo       │ Item          │ Necesario │ Cargado │ Estado   │ │
│ │ ───────────┼───────────────┼───────────┼─────────┼─────────│ │
│ │ Plato      │ Plato fondo   │ 120       │ 120     │ ✅      │ │
│ │ Plato      │ Plato postre  │ 120       │ 120     │ ✅      │ │
│ │ Cubiertos  │ Tenedor       │ 120       │ 120     │ ✅      │ │
│ │ Cubiertos  │ Cuchara       │ 120       │ 0       │ ❌      │ │
│ │ Cristal    │ Copa vino     │ 80        │ 80      │ ✅      │ │
│ │ Cristal    │ Copa agua     │ 120       │ 120     │ ✅      │ │
│ │                                                              │ │
│ │ [Añadir Vajilla]  [Seleccionar de Inventario]               │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 📦 PACKS ESPECIALES                                         │ │
│ │                                                              │ │
│ │ ☑ Pack Camareros (pan, mantequilla, agua, café)            │ │
│ │ ☑ Pack Alérgenos (sin gluten, leche soja)                  │ │
│ │ ☐ Pack Supervivencia (sal, pimienta, aove, film)           │ │
│ │                                                              │ │
│ │ [Añadir Pack]  [Crear Pack Personalizado]                   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Recetas (AMPLIAR)

```
CAMBIOS EN FICHA DE RECETA:
┌─────────────────────────────────────────────────────────────────┐
│ 📖 RECETA: Gilda de Lubina                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ [EXISTENTE]                                                     │
│ Ingredientes:                                                   │
│ - Lubina: 200g × 0.02€ = 4.00€                                │
│ - Aceituna: 50g × 0.01€ = 0.50€                               │
│ - Piparra: 20g × 0.005€ = 0.10€                               │
│ Coste total: 4.60€                                             │
│                                                                  │
│ [NUEVO]                                                         │
│ Acciones de Preparación:                                        │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ # │ Acción      │ Detalle              │ Tiempo │ Día prev  │ │
│ │───┼─────────────┼──────────────────────┼────────┼──────────│ │
│ │ 1 │ Cortar      │ Lubina bastones 5mm  │ 15 min │ 1 día    │ │
│ │ 2 │ Envasar     │ Vacío con aceite     │ 5 min  │ 1 día    │ │
│ │ 3 │ Montar      │ Pinchar con aceituna │ 10 min │ Día D    │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ Tiempo estimado: 30 minutos                                     │
│ Empezar: 1 día antes                                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. FASE 4: Lógica de Negocio

### 6.1 Merma (25%)
```typescript
// En escandallo, aplicar merma del 25%
const MERMA_PCT = 0.25;

function calcularCosteConMerma(cantidadNeta: number, costeUnitario: number): number {
  const cantidadBruta = cantidadNeta * (1 + MERMA_PCT);
  return cantidadBruta * costeUnitario;
}
```

### 6.2 Generación Automática de Timeline
```typescript
function generarTimeline(evento: Event): TimelineEntry[] {
  const pax = evento.guest_count;
  const setupMinutes = evento.setup_time_minutes || 180;
  
  return [
    { phase: 'llegada', concepto: 'personal_dg', planned_time: '08:00', orden: 1 },
    { phase: 'llegada', concepto: 'camion', planned_time: '08:30', orden: 2 },
    { phase: 'llegada', concepto: 'extras', planned_time: '09:00', orden: 3 },
    { phase: 'preparacion', concepto: 'inicio', planned_time: '09:00', duration_minutes: setupMinutes, orden: 4 },
    { phase: 'servicio', concepto: 'aperitivo', planned_time: calcularHoraServicio(evento), orden: 5 },
    // ... más entradas
  ];
}
```

### 6.3 Distribución por Zona
```typescript
function distribuirPersonal(staffingLines: StaffingLine[], zonas: KitchenZone[]): StaffingLine[] {
  return staffingLines.map(line => ({
    ...line,
    kitchen_zone: line.kitchen_zone || 'general',
  }));
}
```

### 6.4 Cálculo de Vajilla Automático
```typescript
function calcularVajilla(pax: number): TablewareItem[] {
  return [
    { tipo: 'plato', nombre: 'Plato fondo', cantidad: pax },
    { tipo: 'plato', nombre: 'Plato postre', cantidad: pax },
    { tipo: 'cubiertos', nombre: 'Tenedor', cantidad: pax },
    { tipo: 'cubiertos', nombre: 'Cuchara', cantidad: pax },
    { tipo: 'cristaleria', nombre: 'Copa vino', cantidad: Math.ceil(pax * 0.7) },
    { tipo: 'cristaleria', nombre: 'Copa agua', cantidad: pax },
  ];
}
```

---

## 7. FASE 5: Eliminación de Stock

### Pasos:
1. Mover consulta de stock de ingredientes a Escandallos
2. Mover inventario de equipamiento a Logística
3. Eliminar ruta `/admin/cocina/stock`
4. Actualizar navegación
5. Eliminar API `/api/cocina/stock` (o redirigir)

---

## 8. Orden de Implementación

| Fase | Descripción | Tiempo |
|------|-------------|--------|
| 1 | Base de datos (tablas + migraciones) | 0.5 día |
| 2 | APIs (timeline, tableware, packs) | 1 día |
| 3 | Página Producción (reescribir) | 1.5 días |
| 4 | Página Carga (ampliar) | 1 día |
| 5 | Página Recetas (ampliar) | 0.5 día |
| 6 | Eliminar Stock + actualizar nav | 0.5 día |
| **TOTAL** | | **5 días** |

---

## 9. Criterios de Aceptación

### Producción:
- [ ] Timeline editable con phases (llegada, preparación, servicio, limpieza, salida)
- [ ] Distribución por zona de cocina visible
- [ ] Checklist de tareas con progreso
- [ ] Vista semanal disponible

### Carga:
- [ ] Checklist de vajilla con stock
- [ ] Packs predefinidos asignables
- [ ] Control de cantidad necesaria vs cargada

### Recetas:
- [ ] Acciones de preparación editables
- [ ] Días de anticipación configurables
- [ ] Tiempo estimado calculado

### Stock:
- [ ] Sección eliminada de navegación
- [ ] Stock visible en Escandallos y Logística
