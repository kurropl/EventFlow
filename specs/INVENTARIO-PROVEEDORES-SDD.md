# SDD: Inventario y Proveedores — EventFlow

## 1. Análisis del Estado Actual

### Tablas Existentes
| Tabla | Registros | Estado |
|-------|-----------|--------|
| `providers` | 6 | ✅ Con datos, API GET/POST |
| `ingredients` | 124 | ✅ Con datos, sin API CRUD completa |
| `supplier_orders` | 31 | ✅ Con datos |
| `supplier_order_items` | - | ✅ Estructura OK |
| `equipment` | 0 | ✅ Nuestra tabla de stock cocina |
| `inventory` | - | ⚠️ Estructura existe, sin datos |
| `inventory_items` | 0 | ⚠️ Tabla vacía |
| `inventory_movements` | 0 | ⚠️ Tabla vacía |

### APIs Existentes
| API | Métodos | Estado |
|-----|---------|--------|
| `/api/providers` | GET, POST | ⚠️ Falta PUT, DELETE |
| `/api/providers/[id]` | GET, PUT, DELETE | ✅ Existe |
| `/api/inventario` | GET (movements, alerts, summary) | ✅ Parcial |
| `/api/stock/*` | Varios | ✅ APIs de stock general |

### Páginas Actuales
| Ruta | Estado |
|------|--------|
| `/admin/stock` | ❌ Solo re-exporta admin page |
| `/admin/proveedores` | ❌ Solo re-exporta admin page |
| `/admin/cocina/stock` | ✅ Stock de cocina (equipment) funcionando |

---

## 2. Diseño de Especificación

### 2.1 INVENTARIO — Módulo de Gestión de Stock de Ingredientes

**Objetivo:** Gestión completa del inventario de ingredientes con trazabilidad de movimientos, vinculación a producción y alertas automáticas.

#### Funcionalidades
1. **Vista Principal** — Lista de ingredientes con stock actual, mínimo, estado
2. **CRUD Ingredientes** — Alta, edición, baja de ingredientes
3. **Movimientos** — Registro de entradas/salidas/ajustes con trazabilidad
4. **Alertas** — Stock bajo automático, pedidos pendientes
5. **Vinculación Producción** — Descuento automático al cerrar eventos
6. **Vinculación Logística** — Stock disponible para carga de eventos
7. **Historial Precios** — Tracking de costes por ingrediente

#### Tablas Impactadas
- `ingredients` — Principal (CRUD completo)
- `inventory` — Vista resumen por ingrediente
- `inventory_movements` — Trazabilidad de movimientos
- `ingredient_price_history` — Histórico de precios
- `recipe_ingredients` — Vinculación con recetas

#### API Endpoints
```
GET    /api/inventario              — Lista ingredientes con stock
POST   /api/inventario              — Crear ingrediente
PUT    /api/inventario/[id]         — Actualizar ingrediente
DELETE /api/inventario/[id]         — Dar de baja (soft delete)

GET    /api/inventario/movements    — Historial de movimientos
POST   /api/inventario/movements    — Registrar movimiento

GET    /api/inventario/alerts       — Alertas de stock bajo
GET    /api/inventario/summary      — Resumen por categorías
```

---

### 2.2 PROVEEDORES — Módulo de Gestión de Suministros

**Objetivo:** Gestión de proveedores con vinculación completa a toda la cadena: ingredientes → recetas → escandallos → producción → APPCC.

#### Funcionalidades
1. **CRUD Proveedores** — Alta, edición, baja
2. **Categorías** — Carnes, Pescados, Verduras, Lácteos, Bebidas, Utensilios, etc.
3. **Vinculación Ingredientes** — Qué proveedor suministra qué ingrediente
4. **Historial Precios** — Precio por proveedor × ingrediente × fecha
5. **Pedidos** — Generación de pedidos a proveedores
6. **Certificaciones** — Links a certificados APPCC por proveedor
7. **Métricas** — Volumen de compra, frecuencia,-rating

#### Tablas Impactadas
- `providers` — Principal (CRUD completo)
- `ingredients` — FK `supplier_id` → `providers.id`
- `supplier_orders` — Pedidos a proveedores
- `supplier_order_items` — Detalle de pedidos
- `ingredient_price_history` — Precios por proveedor

#### API Endpoints
```
GET    /api/providers               — Lista proveedores
POST   /api/providers               — Crear proveedor
PUT    /api/providers/[id]          — Actualizar proveedor
DELETE /api/providers/[id]          — Dar de baja

GET    /api/providers/[id]/ingredients  — Ingredientes del proveedor
GET    /api/providers/[id]/orders       — Pedidos del proveedor
GET    /api/providers/[id]/prices       — Historial de precios
```

---

## 3. Diagrama de Relaciones

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│    PROVIDERS    │────▶│    INGREDIENTS   │◀────│    RECIPES      │
│                 │     │                  │     │                 │
│ - name          │     │ - name           │     │ - name          │
│ - category      │     │ - cost_per_unit  │     │ - category      │
│ - contact       │     │ - quantity (stock)│    │ - instructions  │
│ - certifications│     │ - min_stock      │     └────────┬────────┘
└────────┬────────┘     │ - supplier_id FK │              │
         │              └────────┬─────────┘              │
         │                       │                        │
         ▼                       ▼                        ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ SUPPLIER_ORDERS │     │    INVENTORY     │     │RECIPE_INGREDIENTS│
│                 │     │   _MOVEMENTS     │     │                 │
│ - status        │     │                  │     │ - quantity      │
│ - total_cost    │     │ - movement_type  │     │ - unit          │
│ - expected_date │     │ - quantity       │     └─────────────────┘
└─────────────────┘     │ - previous_stock │
                        │ - new_stock      │
                        └──────────────────┘
                                │
                                ▼
                        ┌──────────────────┐
                        │   ESCANDALLOS    │
                        │   (eventos)      │
                        │                  │
                        │ - ingredients×pax│
                        └──────────────────┘
```

---

## 4. Implementación

### Fase 1: API Providers (COMPLETA CRUD)
- Añadir PUT y DELETE a `/api/providers/[id]`

### Fase 2: API Inventario (CRUD + Movimientos)
- Endpoint CRUD para ingredients
- Endpoint para movimientos de inventario
- Endpoint de alertas

### Fase 3: Página Proveedores
- Lista con búsqueda y filtros
- Modal crear/editar
- Panel de detalle con ingredientes vinculados
- Historial de pedidos

### Fase 4: Página Inventario
- Lista de ingredientes con indicadores de stock
- Modal crear/editar ingrediente
- Registro de movimientos (entrada/salida/ajuste)
- Alertas de stock bajo
- Dashboard con métricas

### Fase 5: Vinculación Cruzada
- Proveedores → Ingredientes → Recetas → Escandallos
- Stock → Logística → Carga de eventos
- APPCC → Proveedores (certificaciones)
