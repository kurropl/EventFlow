# Propuesta: Reestructuración del Módulo Cocina

## 📊 Estado Actual (7 secciones)

```
NAVEGACIÓN ACTUAL:
┌─────────────────────────────────────────────────────────────────┐
│ 🏠 Panel │ 📖 Recetas │ 💰 Escandallos │ 🍳 Producción │ 🚚 Carga │ 📦 Logística │ 📦 Stock │ 🛡 APPCC │
└─────────────────────────────────────────────────────────────────┘

PROBLEMAS DETECTADOS:
1. Stock separado pero se usa en Escandallos y Logística
2. Carga y Logística se superponen (¿dónde va la vajilla?)
3. Producción no tiene timing ni distribución por zona
4. Falta checklist de vajilla
5. Falta planificación detallada del día D
```

---

## 🔄 Flujo Natural del Trabajo de Cocina

```
FLUJO DE UN EVENTO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    ┌─────────────┐
    │   RECETAS   │  ← ¿QUÉ podemos cocinar?
    │  (Catálogo) │
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ ESCANDALLOS │  ← ¿CUÁNTO cuesta?
    │  (Costes)   │
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ PRODUCCIÓN  │  ← ¿QUIÉN hace QUÉ y CUÁNDO?
    │(Planificación│
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │    CARGA    │  ← ¿QUÉ se lleva al evento?
    │(Preparación)│
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │  LOGÍSTICA  │  ← ¿QUÉ material se usa?
    │(Equipamiento│
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │    APPCC    │  ← ¿SEGURO? (temperaturas, limpieza)
    │ (Sanitario) │
    └─────────────┘
```

---

## 🎯 Propuesta: 6 Secciones (eliminando Stock)

### Nueva estructura:

```
NAVEGACIÓN PROPUESTA:
┌─────────────────────────────────────────────────────────────────┐
│ 🏠 Panel │ 📖 Recetas │ 💰 Escandallos │ 🍳 Producción │ 🚚 Carga │ 🛡 APPCC │
└─────────────────────────────────────────────────────────────────┘

Stock se INTEGRA en:
- Escandallos → Check de disponibilidad
- Logística → Control de equipamiento
```

---

## 📋 Detalle por Sección

### 1. 📖 RECETAS (Catálogo de platos)
**Función:** Definir qué podemos cocinar y cómo

| Sección | Función | Estado |
|---------|---------|--------|
| Lista de platos | Catálogo completo | ✅ Existe |
| Ingredientes por plato | Receta desglosada | ✅ Existe |
| Coste por plato | Cálculo automático | ✅ Existe |
| **Acciones de preparación** | Cómo se hace cada plato | 🔴 NUEVO |
| **Días de anticipación** | Cuándo empezar a preparar | 🔴 NUEVO |
| **Tiempo estimado** | Cuánto tarda cada acción | 🔴 NUEVO |

**Campos nuevos en `recipes`:**
```sql
ALTER TABLE recipes ADD COLUMN preparation_steps jsonb;
-- Ejemplo: [{"action": "Cortar", "detail": "Bastones 5mm", "time_min": 15}]

ALTER TABLE recipes ADD COLUMN prep_days_before int;
-- Ejemplo: 2 (empezar 2 días antes)

ALTER TABLE recipes ADD COLUMN estimated_time_minutes int;
-- Ejemplo: 45
```

---

### 2. 💰 ESCANDALLOS (Costes)
**Función:** Calcular cuánto cuesta el evento

| Sección | Función | Estado |
|---------|---------|--------|
| Coste alimentos | Ingredientes × pax | ✅ Existe |
| Motor de bebidas | Cálculo automático | ✅ Existe |
| Margen/PVP | Precio de venta | ✅ Existe |
| **Check stock** | ¿Tenemos lo necesario? | 🔴 NUEVO (movido de Stock) |
| **Desviación teórico/real** | Comparar presupuesto vs real | 🟡 Mejorar |

**Integración de Stock:**
- Al calcular escandallo, mostrar alertas de stock bajo
- No necesidad de sección separada de Stock

---

### 3. 🍳 PRODUCCIÓN (Planificación del día D) ← MÁS CAMBIOS
**Función:** Planificar quién hace qué, dónde y cuándo

| Sección | Función | Estado |
|---------|---------|--------|
| Lista de tareas | Qué se cocinará | ✅ Existe |
| Asignación de personal | Quién hace qué | ✅ Existe |
| **Timing del evento** | Horarios detallados | 🔴 NUEVO |
| **Distribución por zona** | Aperitivos, frío, caliente, etc. | 🔴 NUEVO |
| **Checklist de avance** | Qué está hecho | 🔴 NUEVO |
| **Vista semanal** | Múltiples eventos | 🔴 NUEVO |

**Nueva estructura de Producción:**

```
PRODUCCIÓN - VISTA POR EVENTO:
┌─────────────────────────────────────────────────────────────────┐
│ Evento: Boda García - 15 Septiembre - 120 pax                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ⏰ TIMING                    │  👥 DISTRIBUCIÓN POR ZONA       │
│  ───────────────────────────  │  ─────────────────────────────  │
│  08:00 Llegada personal DG    │  🥗 Aperitivos: Carlos (2)     │
│  08:30 Llegada camión         │  ❄️  Frío: Ana (2)             │
│  09:00 Inicio preparación     │  🔥 Caliente: Pedro (4)        │
│  13:00 Fin preparación        │  🍟 Frito: María (2)           │
│  13:30 Salida aperitivos      │  🍽 Entrante: Luis (2)         │
│  14:00 Salida primero         │  🥘 Primero: Ana (2)           │
│  14:30 Salida segundo         │  🥩 Segundo: Pedro (2)         │
│  15:00 Salida postre          │  🍰 Postre: Laura (2)          │
│  16:00 Inicio limpieza        │                                │
│  17:00 Salida                 │  TOTAL: 16 personas            │
│                                │                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📋 CHECKLIST DE TAREAS                                        │
│  ─────────────────────────────────────────────────────────────  │
│  ☑ Cortar verduras aperitivos          Carlos - 09:00           │
│  ☑ Preparar ensaladilla base           Ana - 09:30              │
│  ☐ Hornear quiches                     María - 10:00            │
│  ☐ Marcar carne principal              Pedro - 11:00            │
│  ☐ Preparar salsas                     Laura - 11:30            │
│                                                                  │
│  Progreso: ████████████░░░░░ 65%                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Nuevas tablas:**

```sql
-- Timeline del evento
CREATE TABLE event_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id),
  phase text NOT NULL, -- 'llegada', 'preparacion', 'servicio', 'limpieza', 'salida'
  concepto text NOT NULL, -- 'personal_dg', 'camion', 'extras', 'aperitivo', etc.
  planned_time time,
  actual_time time,
  duration_minutes int,
  notes text,
  orden int
);

-- Zonas de cocina
CREATE TABLE kitchen_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  icon text,
  orden int
);

-- Datos iniciales
INSERT INTO kitchen_zones (nombre, icon, orden) VALUES
('aperitivos', '🥗', 1),
('frio', '❄️', 2),
('caliente', '🔥', 3),
('frito', '🍟', 4),
('entrante', '🍽', 5),
('primero', '🥘', 6),
('segundo', '🥩', 7),
('postre', '🍰', 8),
('recena', '🌙', 9);
```

**Añadir a `staffing_lines`:**
```sql
ALTER TABLE staffing_lines ADD COLUMN kitchen_zone text;
ALTER TABLE staffing_lines ADD COLUMN previsto int;
ALTER TABLE staffing_lines ADD COLUMN real int;
```

---

### 4. 🚚 CARGA (Preparación del camión)
**Función:** Preparar todo lo que se lleva al evento

| Sección | Función | Estado |
|---------|---------|--------|
| Comida por pases | Qué platos se llevan | ✅ Existe |
| **Vajilla/Loza** | Plato, cubiertos, cristalería | 🔴 NUEVO |
| **Packs especiales** | Camareros, alérgenos, supervivencia | 🔴 NUEVO |
| **Material cocina** | Sartenes, bandejas, etc. | ✅ Existe (mejorar) |

**Nueva estructura de Carga:**

```
CARGA - VISTA POR EVENTO:
┌─────────────────────────────────────────────────────────────────┐
│ Evento: Boda García - 15 Septiembre                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  🍽 COMIDA POR PASES                 │  🍴 VAJILLA             │
│  ──────────────────────────────────  │  ──────────────────────  │
│  1er Pase: Aperitivos fríos         │  Plato fondo: 120 ✅     │
│  2do Pase: Calientes                │  Plato postre: 120 ✅    │
│  3er Pase: Postre                   │  Tenedores: 120 ✅       │
│                                      │  Copa vino: 80 ✅        │
│                                      │  Copa agua: 120 ✅       │
├─────────────────────────────────────┼───────────────────────────┤
│                                      │                           │
│  📦 PACKS ESPECIALES                │  🍳 MATERIAL COCINA      │
│  ──────────────────────────────────  │  ──────────────────────  │
│  ☑ Pack Camareros (pan, mantequilla)│  Sartén grande: 2 ✅     │
│  ☑ Pack Alérgenos (sin gluten)      │  Bandejas horno: 4 ✅    │
│  ☐ Pack Supervivencia (sal, pimienta)│ Papel absorbente: 1 ✅  │
│                                      │                           │
└─────────────────────────────────────────────────────────────────┘
```

**Nuevas tablas:**

```sql
-- Vajilla/Loza
CREATE TABLE tableware_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL, -- 'plato', 'cubiertos', 'cristaleria', 'textil'
  nombre text NOT NULL,
  stock_total int DEFAULT 0,
  stock_disponible int DEFAULT 0,
  proveedor text,
  coste_alquiler numeric,
  active boolean DEFAULT true
);

CREATE TABLE event_tableware (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id),
  item_id uuid NOT NULL REFERENCES tableware_items(id),
  cantidad_necesaria int NOT NULL,
  cantidad_cargada int DEFAULT 0,
  proveedor text,
  alquilado boolean DEFAULT false,
  notas text
);

-- Packs predefinidos
CREATE TABLE pack_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  items jsonb NOT NULL, -- [{nombre: "Pan", cantidad: 10, unidad: "ud"}]
  active boolean DEFAULT true
);

-- Datos iniciales
INSERT INTO pack_templates (nombre, items) VALUES
('Pack Camareros', '[{"nombre":"Pan","cantidad":10,"unidad":"ud"},{"nombre":"Mantequilla","cantidad":10,"unidad":"ud"},{"nombre":"Agua","cantidad":5,"unidad":"botella"},{"nombre":"Café","cantidad":10,"unidad":"taza"}]'),
('Pack Alérgenos', '[{"nombre":"Pan sin gluten","cantidad":5,"unidad":"ud"},{"nombre":"Leche soja","cantidad":2,"unidad":"litro"},{"nombre":"Postre sin lactosa","cantidad":5,"unidad":"ud"}]'),
('Pack Supervivencia', '[{"nombre":"Sal","cantidad":1,"unidad":"kg"},{"nombre":"Pimienta","cantidad":1,"unidad":"kg"},{"nombre":"AOVE","cantidad":1,"unidad":"litro"},{"nombre":"Film","cantidad":1,"unidad":"rollo"},{"nombre":"Aluminio","cantidad":1,"unidad":"rollo"}]');
```

---

### 5. 📦 LOGÍSTICA (Equipamiento)
**Función:** Controlar el material reutilizable

| Sección | Función | Estado |
|---------|---------|--------|
| Equipamiento por evento | Qué se necesita | ✅ Existe |
| Control ida/vuelta | Qué sale y qué vuelve | ✅ Existe |
| **Stock equipamiento** | Inventario de material | 🔴 MOVIDO de Stock |

**Integración de Stock de equipamiento:**
- Logística ahora incluye el inventario de equipamiento
- Se elimina la sección separada de Stock

---

### 6. 🛡 APPCC (Sanitario)
**Función:** Control de seguridad alimentaria

| Sección | Función | Estado |
|---------|---------|--------|
| Recepción | Temperatura, embalaje | ✅ Existe |
| Almacenamiento | Cámaras, temperaturas | ✅ Existe |
| Elaboración | Puntos críticos | ✅ Existe |
| Servicio | Temperatura platos | ✅ Existe |
| Limpieza | Tareas de limpieza | ✅ Existe |
| Incidencias | Registro problemas | ✅ Existe |
| Aceite | Control fritura | ✅ Existe |

**Sin cambios** - Ya está completo

---

## 📊 Resumen de Cambios

| Sección | Cambios | Estado |
|---------|---------|--------|
| **Recetas** | +Acciones preparación, +días anticipación | 🟡 Ampliar |
| **Escandallos** | +Check stock integrado | 🟡 Ampliar |
| **Producción** | +Timing, +distribución zona, +checklist | 🔴 Reescribir |
| **Carga** | +Vajilla, +packs | 🔴 Ampliar |
| **Logística** | +Stock equipamiento integrado | 🟡 Ampliar |
| **APPCC** | Sin cambios | ✅ Mantener |
| **Stock** | ELIMINAR (integrar en otros) | 🔴 Eliminar |

---

## 🗑 Sección Eliminada: Stock

**¿Por qué?**
- Stock de ingredientes → Se consulta en Escandallos
- Stock de equipamiento → Se consulta en Logística

**¿Dónde va cada cosa?**
- Ver stock de ingredientes → Pestaña "Stock" dentro de Escandallos
- Ver stock de equipamiento → Pestaña "Inventario" dentro de Logística
- Alertas de stock bajo → Dashboard de Cocina

---

## 🎯 Plan de Implementación

### Fase 1: Producción (2-3 días)
1. Crear tabla `event_timeline`
2. Crear tabla `kitchen_zones`
3. Añadir `kitchen_zone` a `staffing_lines`
4. Reescribir página de Producción con timing y distribución

### Fase 2: Carga (1-2 días)
1. Crear tabla `tableware_items`
2. Crear tabla `event_tableware`
3. Crear tabla `pack_templates`
4. Ampliar página de Carga con vajilla y packs

### Fase 3: Recetas (1 día)
1. Añadir `preparation_steps` a `recipes`
2. Añadir `prep_days_before` a `recipes`
3. Actualizar UI de recetas

### Fase 4: Logística (1 día)
1. Mover inventario de equipamiento a Logística
2. Eliminar sección de Stock
3. Actualizar navegación

---

## ✅ Resultado Final

```
NAVEGACIÓN FINAL (6 secciones):
┌─────────────────────────────────────────────────────────────────┐
│ 🏠 Panel │ 📖 Recetas │ 💰 Escandallos │ 🍳 Producción │ 🚚 Carga │ 🛡 APPCC │
└─────────────────────────────────────────────────────────────────┘

- Menos secciones (7 → 6)
- Más funcionalidades integradas
- Flujo lógico: Recetas → Escandallos → Producción → Carga → APPCC
- Stock integrado donde se usa
```
