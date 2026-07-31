# Análisis: Hojas de Eventos vs EventFlow Actual

## 📋 Documentos Analizados

| Documento | Contenido Principal |
|-----------|---------------------|
| **Audi Madrid 28.xlsx** | Hoja completa de evento: vajilla, personal, timing, platos |
| **CDE OF 3028 Madrid Fusion** | Similar a Audi Madrid - estructura estándar |
| **CHECKLIST INDIVIDUAL PRODUCCIÓN 2019** | Lista de platos con acciones, unidades, checks |
| **CHECKLIST SEMANAL PRODUCCIÓN 2019** | Planificación semanal de preparativos |
| **Inventario Bebidas Eventos** | Control de stock de bebidas |
| **INVENTARIO COCINA DICIEMBRE** | Control de stock de cocina |
| **ORGANIGRAMA COCINA EVENTOS** | Estructura del equipo de cocina |
| **PARTE FINANCIERA y TABLAS SALARIALES** | Control financiero y nóminas |

---

## 🔍 Estructura de las Hojas de Eventos

### Secciones identificadas en los Excel:

```
┌─────────────────────────────────────────────────────────────────┐
│                    HOJA DE EVENTO                               │
├─────────────────────────────────────────────────────────────────┤
│ 1. DATOS BÁSICOS                                               │
│    - Fecha                                                      │
│    - Evento (nombre)                                            │
│    - Nº Pax                                                     │
├─────────────────────────────────────────────────────────────────┤
│ 2. CHECKLIST VAJILLA                                            │
│    - Tipo de vajilla                                            │
│    - Proveedor                                                  │
│    - Cantidad                                                   │
│    - Estado (previsión/real)                                    │
├─────────────────────────────────────────────────────────────────┤
│ 3. DISTRIBUCIÓN DEL PERSONAL                                    │
│    - Aperitivos                                                 │
│    - Frío                                                       │
│    - Caliente                                                   │
│    - Frito                                                      │
│    - Principales (Entrante/Primero/Segundo/Postre)              │
│    - Recena                                                     │
├─────────────────────────────────────────────────────────────────┤
│ 4. TIMING DEL EVENTO                                            │
│    - Llegada personal DG                                        │
│    - Llegada camión                                             │
│    - Llegada extras                                             │
│    - Inicio/Final                                               │
│    - Salida personal/camión/extras                              │
├─────────────────────────────────────────────────────────────────┤
│ 5. CRONOGRAMA DE SERVICIO                                       │
│    - Aperitivo                                                  │
│    - Salida primer plato                                        │
│    - Salida segundo plato                                       │
│    - Salida tercer plato                                        │
│    - Salida postre                                              │
├─────────────────────────────────────────────────────────────────┤
│ 6. LISTA DE PLATOS (por categoría)                              │
│    - Nombre elaboración                                         │
│    - Acción (Hacer/Cortar/Envasar/etc)                         │
│    - Unidad (UD/K/L)                                            │
│    - Check                                                      │
│    - Observaciones                                              │
├─────────────────────────────────────────────────────────────────┤
│ 7. MATERIAL DE COCINA                                           │
│    - Producto                                                   │
│    - Cantidad                                                   │
│    - Proveedor                                                  │
├─────────────────────────────────────────────────────────────────┤
│ 8. PACKS ESPECIALES                                             │
│    - Pack Camareros                                             │
│    - Pack Alérgenos                                             │
│    - Pack Supervivencia                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 Comparativa: Lo que muestran vs Lo que tiene EventFlow

### ✅ LO QUE EVENTFLOW YA TIENE (y está bien implementado)

| Funcionalidad | Estado EventFlow | Observaciones |
|---------------|------------------|---------------|
| **Escandallo (ingredientes × pax)** | ✅ Robusto | Coste teórico vs real con desviación |
| **Hoja de Producción** | ✅ Implementada | Generada desde escandallo |
| **Hoja de Carga** | ✅ Implementada | Organizada por pases |
| **Hoja de Logística** | ✅ Implementada | Equipamiento y producto seco |
| **APPCC / Trazabilidad** | ✅ Implementada | Recepción, almacenamiento, elaboración |
| **Stock de ingredientes** | ✅ Implementado | Con alertas de stock bajo |
| **Proveedores** | ✅ CRUD completo | Vinculado a ingredientes |
| **Staffing básico** | ✅ Implementado | Asignación por evento |
| **Cálculo de costes** | ✅ Robusto | Escandallo automático |

### 🔴 LO QUE LAS HOJAS MUESTRAN Y EVENTFLOW NO TIENE

#### 1. **Checklist de Vajilla/Loza** (CRÍTICO)
```
LO QUE MUESTRAN LAS HOJAS:
┌─────────────────────────────────────────────────┐
│ TIPO      │ VAJILLA      │ PROVEEDOR │ CANTIDAD │
├─────────────────────────────────────────────────┤
│ Plato     │ Plato fondo  │ Interno   │ 120      │
│ Plato     │ Plato postre │ Interno   │ 120      │
│ Cubiertos │ Tenedor      │ Interno   │ 120      │
│ Cristal   │ Copa vino    │ Alquiler  │ 80       │
│ Cristal   │ Copa agua    │ Alquiler  │ 120      │
└─────────────────────────────────────────────────┘

LO QUE FALTA EN EVENTFLOW:
- No hay entidad "vajilla" o "loza"
- No hay control de stock de vajilla
- No hay vinculación evento ↔ vajilla
- No hay cálculo automático según pax
```

**Propuesta:** Crear módulo `tableware` con:
- `tableware_items` (tipo, nombre, stock_total, stock_disponible)
- `event_tableware` (event_id, item_id, cantidad_necesaria, proveedor, alquilado)

#### 2. **Distribución del Personal por Zona de Cocina** (ALTO)
```
LO QUE MUESTRAN LAS HOJAS:
┌─────────────────────────────────────────────────┐
│ ZONA         │ RESPONSABLE │ PREVISIÓN │ REAL   │
├─────────────────────────────────────────────────┤
│ Aperitivos   │ Carlos      │ 3         │ 3      │
│ Frío         │ Ana         │ 2         │ 2      │
│ Caliente     │ Pedro       │ 4         │ 4      │
│ Frito        │ María       │ 2         │ 2      │
│ Entrante     │ Luis        │ 2         │ 2      │
│ Primero      │ Ana         │ 2         │ 2      │
│ Segundo      │ Pedro       │ 2         │ 2      │
│ Postre       │ Laura       │ 2         │ 2      │
└─────────────────────────────────────────────────┘

LO QUE FALTA EN EVENTFLOW:
- Solo asigna "cocinero" sin especificar zona
- No hay distribución por estación de trabajo
- No hay tracking de previsión vs real
```

**Propuesta:** Añadir a `staffing_lines`:
- Campo `kitchen_zone` (aperitivos, frio, caliente, frito, etc.)
- Tracking previsión vs real

#### 3. **Timing Detallado del Evento** (ALTO)
```
LO QUE MUESTRAN LAS HOJAS:
┌─────────────────────────────────────────────────┐
│ CONCEPTO                    │ HORA    │ MIN  │
├─────────────────────────────────────────────────┤
│ Llegada personal DG         │ 08:00   │ -    │
│ Llegada camión              │ 08:30   │ -    │
│ Llegada extras              │ 09:00   │ -    │
│ Inicio preparación          │ 09:00   │ 180  │
│ Fin preparación             │ 12:00   │ -    │
│ Salida primer plato         │ 13:30   │ -    │
│ Salida segundo plato        │ 14:15   │ -    │
│ Salida postre               │ 15:00   │ -    │
│ Inicio limpieza             │ 15:30   │ 60   │
│ Salida personal             │ 16:30   │ -    │
│ Salida camión               │ 17:00   │ -    │
└─────────────────────────────────────────────────┘

LO QUE FALTA EN EVENTFLOW:
- Solo tiene hora_inicio y hora_fin del evento
- No hay timing por fase (llegada, preparación, servicio, limpieza)
- No hay tracking de minutos necesarios
```

**Propuesta:** Crear tabla `event_timeline`:
```sql
event_timeline (
  id, event_id,
  phase text, -- 'llegada', 'preparacion', 'servicio', 'limpieza', 'salida'
  concept text, -- 'personal_dg', 'camion', 'extras', etc.
  planned_time time,
  actual_time time,
  duration_minutes int,
  notes text
)
```

#### 4. **Lista de Platos con Acciones Específicas** (MEDIO)
```
LO QUE MUESTRAN LAS HOJAS:
┌─────────────────────────────────────────────────────────────┐
│ ELABORACIÓN              │ ACCIÓN              │ UD │ CHECK │
├─────────────────────────────────────────────────────────────┤
│ Gilda de lubina          │ Hacer               │ ud │ ☐     │
│ Ensaladilla              │ Cortar/Envasar      │ kg │ ☐     │
│ Mini brioche de rabo     │ Hacer/Marcar        │ ud │ ☐     │
│ Quiche Lorraine          │ Hornear/Guardar      │ ud │ ☐     │
│ Croquetas de jamón       │ Hacer/Congelar      │ ud │ ☐     │
│ Tartar de solomillo      │ Sacar/Marcar        │ ud │ ☐     │
│ Puré Robuchón            │ Descongelar         │ kg │ ☐     │
└─────────────────────────────────────────────────────────────┘

LO QUE FALTA EN EVENTFLOW:
- Las recetas tienen ingredientes pero NO acciones de preparación
- No hay checklist de tareas de cocina
- No hay tracking de qué está hecho y qué pendiente
```

**Propuesta:** Añadir a `recipes` o crear `recipe_steps`:
- `preparation_action` (Hacer, Cortar, Envasar, Hornear, etc.)
- `prep_days_before` (días antes que se prepara)
- `storage_method` (Congelar, Refrigerar, Ambiente)

#### 5. **Packs Especiales** (MEDIO)
```
LO QUE MUESTRAN LAS HOJAS:
┌─────────────────────────────────────────────────┐
│ PACK CAMAREROS:                                  │
│ - Pan, mantequilla, agua, café                   │
│                                                  │
│ PACK ALÉRGENOS:                                  │
│ - Pan sin gluten, leche soja, etc.               │
│                                                  │
│ PACK SUPERVIVENCIA:                              │
│ - Sal, pimienta, aove, film, aluminio            │
└─────────────────────────────────────────────────┘

LO QUE FALTA EN EVENTFLOW:
- No hay concepto de "packs" predefinidos
- No hay generación automática de packs según evento
```

**Propuesta:** Crear `packing_lists`:
- `pack_templates` (nombre, items[])
- `event_packs` (event_id, pack_id, items_personalizados)

#### 6. **Checklist Semanal de Producción** (MEDIO)
```
LO QUE MUESTRAN LAS HOJAS:
┌─────────────────────────────────────────────────────────────┐
│ SEMANA DEL: 21 AL 27 MAYO                                   │
├─────────────────────────────────────────────────────────────┤
│ LUNES 21    │ MARTES 22   │ MIÉRCOLES 23  │ JUEVES 24      │
├─────────────────────────────────────────────────────────────┤
│ Hacer croquetas │ Cortar verduras │ Hornear quiches │ ...   │
│ 500 ud          │ 10 kg           │ 200 ud          │       │
└─────────────────────────────────────────────────────────────┘

LO QUE FALTA EN EVENTFLOW:
- Solo tiene hojas de producción por evento
- No hay vista semanal que aggregue múltiples eventos
```

**Propuesta:** Crear vista `weekly_production` que聚合:
- Todas las tareas de producción de la semana
- Agrupadas por día y tipo de elaboración
- Con cantidades totales

---

## 🎯 PRIORIDADES DE IMPLEMENTACIÓN

### 🔴 P0 — Críticos (añadir inmediatamente)

| # | Funcionalidad | Justificación | Esfuerzo |
|---|---------------|---------------|----------|
| 1 | **Checklist Vajilla/Loza** | Sin control de vajilla, no se puede cargar correctamente | Medio |
| 2 | **Timing Detallado** | El día del evento es caótico sin timing preciso | Bajo |
| 3 | **Distribución Personal por Zona** | Necesario para asignar correctamente | Bajo |

### 🟡 P1 — Importantes (siguiente sprint)

| # | Funcionalidad | Justificación | Esfuerzo |
|---|---------------|---------------|----------|
| 4 | **Lista Platos con Acciones** | Mejora producción significativamente | Medio |
| 5 | **Packs Especiales** | Ahorra tiempo en eventos repetitivos | Bajo |
| 6 | **Checklist Semanal** | Visibilidad de carga de trabajo semanal | Medio |

### 🟢 P2 — Mejoras (futuro)

| # | Funcionalidad | Justificación | Esfuerzo |
|---|---------------|---------------|----------|
| 7 | **Organigrama visual** | Referencia visual del equipo | Bajo |
| 8 | **Partes financieros detallados** | Análisis de rentabilidad por evento | Medio |

---

## 📐 PROPUESTA DE MODELO DE DATOS

### Nuevas tablas necesarias:

```sql
-- 1. Vajilla/Loza
CREATE TABLE tableware_items (
  id uuid PRIMARY KEY,
  tipo text NOT NULL, -- 'plato', 'cubiertos', 'cristaleria', 'textil'
  nombre text NOT NULL,
  stock_total int DEFAULT 0,
  stock_disponible int DEFAULT 0,
  proveedor text,
  coste_alquiler numeric,
  active boolean DEFAULT true
);

CREATE TABLE event_tableware (
  id uuid PRIMARY KEY,
  event_id uuid REFERENCES events(id),
  item_id uuid REFERENCES tableware_items(id),
  cantidad_necesaria int NOT NULL,
  cantidad_cargada int DEFAULT 0,
  proveedor text,
  alquilado boolean DEFAULT false,
  notas text
);

-- 2. Timeline del evento
CREATE TABLE event_timeline (
  id uuid PRIMARY KEY,
  event_id uuid REFERENCES events(id),
  phase text NOT NULL, -- 'llegada', 'preparacion', 'servicio', 'limpieza', 'salida'
  concepto text NOT NULL, -- 'personal_dg', 'camion', 'extras', 'aperitivo', etc.
  planned_time time,
  actual_time time,
  duration_minutes int,
  notes text,
  orden int
);

-- 3. Zonas de cocina (lookup)
CREATE TABLE kitchen_zones (
  id uuid PRIMARY KEY,
  nombre text NOT NULL,
  descripcion text,
  orden int
);

-- Datos iniciales
INSERT INTO kitchen_zones (nombre, orden) VALUES
('aperitivos', 1), ('frio', 2), ('caliente', 3), ('frito', 4),
('entrante', 5), ('primero', 6), ('segundo', 7), ('postre', 8), ('recena', 9);

-- 4. Packs predefinidos
CREATE TABLE pack_templates (
  id uuid PRIMARY KEY,
  nombre text NOT NULL,
  items jsonb NOT NULL, -- [{nombre, cantidad, unidad}]
  active boolean DEFAULT true
);

CREATE TABLE event_packs (
  id uuid PRIMARY KEY,
  event_id uuid REFERENCES events(id),
  pack_id uuid REFERENCES pack_templates(id),
  items_personalizados jsonb,
  completado boolean DEFAULT false
);
```

---

## 🔧 CAMBIOS EN TABLAS EXISTENTES

```sql
-- Añadir a staffing_lines
ALTER TABLE staffing_lines ADD COLUMN IF NOT EXISTS kitchen_zone text;
ALTER TABLE staffing_lines ADD COLUMN IF NOT EXISTS previsto int;
ALTER TABLE staffing_lines ADD COLUMN IF NOT EXISTS real int;

-- Añadir a recipes
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS preparation_action text;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS prep_days_before int;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS storage_method text;

-- Añadir a events
ALTER TABLE events ADD COLUMN IF NOT EXISTS setup_time_minutes int;
ALTER TABLE events ADD COLUMN IF NOT EXISTS service_start time;
ALTER TABLE events ADD COLUMN IF NOT EXISTS service_end time;
```

---

## 📋 RESUMEN EJECUTIVO

### Lo que EventFlow tiene bien:
✅ Escandallo robusto
✅ Producción/Carga/Logística implementadas
✅ APPCC completa
✅ Stock y proveedores
✅ Staffing básico

### Lo que FALTA según las hojas de eventos:
❌ **Vajilla/Loza** — No existe control
❌ **Timing detallado** — Solo hora inicio/fin
❌ **Distribución por zona cocina** — Solo asigna "cocinero"
❌ **Acciones de preparación** — Recetas no tienen pasos
❌ **Packs predefinidos** — No existe concepto
❌ **Vista semanal** — Solo por evento

### Impacto en el negocio:
- **Sin control de vajilla**: Se pueden quedar sin platos el día del evento
- **Sin timing**: El equipo no sabe cuándo llegar o salir
- **Sin distribución**: No se asigna correctamente por zona
- **Sin acciones**: El equipo no sabe qué preparar antes

### Recomendación:
Implementar en este orden:
1. **Timing + Distribución** (1-2 días) — Impacto inmediato
2. **Vajilla** (2-3 días) — Control esencial
3. **Acciones de preparación** (2-3 días) — Mejora productividad
4. **Packs** (1 día) — Ahorro de tiempo
