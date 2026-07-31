# EventFlow — SDD + TDD: Módulo Cocina (Rediseño Completo)

> **Fecha:** 21/07/2026
> **Estado:** 🔴 Roto — SDD para reconstrucción completa
> **Base:** Servidor producción (ramas 011-018 aplicadas)
> **Principio:** Spec-Driven Development + Test-Driven Development

---

## 1. DIAGNÓSTICO DE ERRORES (fuente de verdad)

### 1.1 Errores en producción

```sql
-- ERROR 1: Dashboard API
SELECT e.name, e.pax FROM events e
--            ↑        ↑
--     NO EXISTE   NO EXISTE
--   La columna es: client_name, guest_count

-- ERROR 2: Escandallos API
SELECT ev.name, ev.pax, ev.event_date FROM events ev
--        ↑      ↑
--   NO EXISTEN (mismo problema)

-- ERROR 3: Produccion API
SELECT e.name FROM events e
--        ↑ NO EXISTE

-- ERROR 4: recipe_ingredients no tiene datos
-- La tabla recipe_ingredients se creó vacía
-- Las recetas reales están en catalog_items.ingredients (JSONB)
```

### 1.2 Mapa de tablas reales vs esperadas por API

| API espera | Tabla real | Columna real | Solución |
|-----------|-----------|-------------|----------|
| `events.name` | `events` | `client_name` | Usar `client_name` o `COALESCE(client_name, 'Evento')` |
| `events.pax` | `events` | `guest_count` | Usar `guest_count` |
| `events.evento_fecha` | `events` | `event_date` | Usar `event_date` |
| `recipe_ingredients` | `catalog_items.ingredients` (JSONB) | `ingredients` | Parsear JSONB o migrar datos |
| `escandallos.pax` | `escandallos` | `pax` | ✅ Existe |
| `escandallos.total_cost` | `escandallos` | `total_cost` | ✅ Existe |

---

## 2. SDD — ESPECIFICACIÓN DEL MÓDULO COCINA

### 2.1 Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                   UI (Páginas Cocina)                     │
│  Dashboard | Recetas | Escandallos | Producción | Carga  │
│  Logística | APPCC                                        │
└──────────────────────┬──────────────────────────────────┘
                       │ fetch()
┌──────────────────────▼──────────────────────────────────┐
│              API Routes (Next.js App Router)              │
│  /api/cocina/dashboard   /api/cocina/recetas             │
│  /api/cocina/escandallos /api/cocina/produccion          │
│  /api/cocina/carga       /api/cocina/logistica           │
│  /api/cocina/appcc                                       │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│              Domain Services (src/lib/domain/cocina/)    │
│  recetaService.ts  escandalloService.ts                  │
│  produccionService.ts  logisticaService.ts               │
│  appccService.ts                                         │
└──────────────────────┬──────────────────────────────────┘
                       │ SQL queries
┌──────────────────────▼──────────────────────────────────┐
│     Base de Datos (PostgreSQL)                           │
│  Tablas: recipes, escandallos, escandallo_lines,         │
│  hojas_produccion, tareas_produccion, hojas_carga,       │
│  items_carga, hojas_logistica, appcc_registros           │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Flujo de trabajo (5 pasos)

```
Receta → Escandallo → Producción → Carga → APPCC
  1         2             3          4        5
```

Cada paso se apoya en el anterior:
1. **Receta**: Ficha técnica del plato (ingredientes, cantidades, alérgenos)
2. **Escandallo**: Receta × pax del evento = necesidades totales
3. **Producción**: Tareas de cocina agrupadas por turno
4. **Carga**: Material e ingredientes a llevar al evento
5. **APPCC**: Trazabilidad sanitaria (lotes, temperaturas)

### 2.3 Modelo de datos (corregido)

#### Tablas existentes (ya creadas por migraciones)

```sql
-- RECETAS (corazón del módulo)
recipes (id, name, description, category, catalog_item_id, 
         servings, instructions, prep_time, cook_time, difficulty,
         published, active, created_at, updated_at)
recipe_ingredients (id, recipe_id, ingredient_id, quantity, unit, per_guest, cost)

-- ESCANDALLOS
escandallos (id, event_id, name, version, status, pax, 
             total_cost, cost_per_pax, desviacion, notes, created_at, updated_at)
escandallo_lines (id, escandallo_id, catalog_item_id, plato_name, 
                  cantidad, unit, cost_unit, cost_total, per_guest, orden)

-- HOJAS DE PRODUCCIÓN
hojas_produccion (id, event_id, escandallo_id, fecha, turno, status, pax, notas)
tareas_produccion (id, hoja_id, catalog_item_id, plato_name, ingrediente,
                   cantidad, unit, pase, orden, asignado_a, completado)

-- HOJAS DE CARGA
hojas_carga (id, event_id, escandallo_id, fecha, status, notas)
items_carga (id, hoja_id, tipo, catalog_item_id, nombre, cantidad, 
             unit, verificado, observaciones)
```

### 2.4 API Contract (corregido)

#### GET /api/cocina/dashboard

```typescript
// Response
{
  success: true,
  data: {
    kpis: {
      recetas_activas: number,      // COUNT FROM catalog_items WHERE active=true
      escandallos_activos: number,  // COUNT FROM escandallos WHERE status IN ('borrador','aprobado')
      produccion_hoy: number,       // COUNT FROM hojas_produccion WHERE fecha=CURRENT_DATE
      alertas_stock: number,        // COUNT FROM inventory WHERE quantity <= min_stock
      eventos_semana: number,       // COUNT FROM events WHERE event_date IN next 7 days
      pax_semana: number            // SUM guest_count FROM those events
    },
    actividad: Array<{
      id: string, tipo: string, descripcion: string,
      evento: string|null, fecha: string, href: string
    }>
  }
}
```

#### GET /api/cocina/recetas

```typescript
// Query params: ?category=carne&search=solomillo
// Response
{
  success: true,
  data: Array<{
    id: string, name: string, category: string, pvp: number, cost: number,
    description: string|null, active: boolean,
    ingredient_count: number,  // COUNT de ingredientes
    recipe_id: string|null     // id de recipes si existe ficha técnica
  }>
}
```

---

## 3. TDD — PLAN DE TESTS

### 3.1 Tests Unitarios (Vitest)

```typescript
// src/lib/__tests__/cocina-recetas.test.ts
describe('Módulo Cocina - Recetas', () => {
  test('listar recetas activas devuelve array')
  test('filtrar por categoría devuelve solo esa categoría')
  test('buscar por nombre con ILIKE')
  test('crear receta con datos válidos')
  test('crear receta sin nombre devuelve error 400')
})

// src/lib/__tests__/cocina-escandallos.test.ts
describe('Módulo Cocina - Escandallos', () => {
  test('escandallos por evento lista correctamente')
  test('necesidades agregadas calcula multiplicación × pax')
  test('resumen global devuelve totales')
  test('escandallo escala cantidades por guest_count')
  test('escandallo usa guest_count, no pax')
})

// src/lib/__tests__/cocina-produccion.test.ts
describe('Módulo Cocina - Producción', () => {
  test('hojas de producción por fecha')
  test('crear hoja de producción requiere evento')
  test('tareas de producción se agrupan por turno')
})

// src/lib/__tests__/cocina-dashboard.test.ts
describe('Módulo Cocina - Dashboard', () => {
  test('KPIs devuelven conteos correctos')
  test('actividad reciente últimos 7 días')
  test('eventos_semana usa guest_count, no pax')
  test('eventos_semana usa client_name, no name')
})
```

### 3.2 Tests de Integración (Playwright)

```typescript
// tests/cocina-flujo-completo.spec.ts
describe('Flujo completo cocina', () => {
  test('login como admin')
  test('navegar a cocina dashboard')
  test('ver KPIs cargados')
  test('navegar a recetas')
  test('navegar a escandallos')
  test('navegar a producción')
  test('navegar a carga')
  test('navegar a logística')
  test('navegar a APPCC')
})
```

### 3.3 Script de Verificación

```bash
# scripts/verify-cocina.sh
echo "=== Verificación Módulo Cocina ==="
BASE="http://localhost:${APP_PORT:-3020}"

# 1. Dashboard API
echo "Dashboard API: $(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/cocina/dashboard")"

# 2. Recetas API
echo "Recetas API: $(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/cocina/recetas")"

# 3. Escandallos API
echo "Escandallos API: $(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/cocina/escandallos")"

# 4. Producción API
echo "Producción API: $(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/cocina/produccion")"

# 5. Verificar columnas correctas en DB
docker exec eventflow-postgres psql -U postgres -d eventflow -c "
  SELECT 'events.client_name' as columna, COUNT(*) FROM events WHERE client_name IS NOT NULL
  UNION ALL
  SELECT 'events.guest_count', COUNT(*) FROM events WHERE guest_count > 0
  UNION ALL
  SELECT 'catalog_items.active', COUNT(*) FROM catalog_items WHERE active = true
"
```

---

## 4. PLAN DE IMPLEMENTACIÓN

### Fase 1: 🟢 Tests (TDD) — Escribir tests que fallen

```bash
# 1. Crear tests unitarios
src/lib/__tests__/cocina-recetas.test.ts
src/lib/__tests__/cocina-escandallos.test.ts
src/lib/__tests__/cocina-produccion.test.ts
src/lib/__tests__/cocina-dashboard.test.ts

# 2. Ejecutar: npm run test:unit
#    → Todos fallan (aún no hay implementación correcta)
```

### Fase 2: 🟡 Corregir APIs (implementación)

```bash
# Archivos a corregir (por orden):

# 1. Dashboard API - corregir columnas
src/app/api/cocina/dashboard/route.ts
#  → e.name → e.client_name
#  → e.pax  → e.guest_count

# 2. Recetas API - usar columnas correctas
src/app/api/cocina/recetas/route.ts
#  → recipe_ingredients → catalog_items.ingredients (JSONB)
#  → O migrar datos de JSONB a recipe_ingredients

# 3. Escandallos API - corregir joins
src/app/api/cocina/escandallos/route.ts
#  → ev.name → ev.client_name
#  → ev.pax  → ev.guest_count

# 4. Producción API - corregir columnas
src/app/api/cocina/produccion/route.ts
#  → e.name → e.client_name
```

### Fase 3: 🔵 Páginas UI (rediseño)

```bash
# Layout y dashboard ya tienen buen diseño
# Solo corregir datos que muestran

src/app/admin/cocina/page.tsx        # Dashboard
src/app/admin/cocina/recetas/page.tsx # Lista recetas
src/app/admin/cocina/escandallos/    # Escandallos
src/app/admin/cocina/produccion/     # Producción
src/app/admin/cocina/carga/          # Carga
src/app/admin/cocina/logistica/      # Logística
src/app/admin/cocina/appcc/          # APPCC
```

### Fase 4: 🟣 Verificación

```bash
# 1. Tests unitarios pasan
npm run test:unit

# 2. Script de verificación
bash scripts/verify-cocina.sh

# 3. Build
npm run build

# 4. Deploy
sh deploy.sh
```

---

## 5. CRONOGRAMA

| Fase | Tarea | Archivos | Esfuerzo |
|------|-------|----------|----------|
| 🟢 TDD | Escribir tests | 4 test files | 2h |
| 🟡 API | Corregir dashboard | 1 route | 30min |
| 🟡 API | Corregir recetas | 1 route | 1h |
| 🟡 API | Corregir escandallos | 1 route | 1h |
| 🟡 API | Corregir producción | 1 route | 30min |
| 🟡 API | Corregir carga/logística/appcc | 3 routes | 1h |
| 🔵 UI | Ajustar páginas | 7 pages | 3h |
| 🟣 Verif | Tests + verify + build | — | 1h |
| **Total** | | | **~10h** |