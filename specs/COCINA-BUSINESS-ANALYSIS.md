# EventFlow — Análisis de Negocio: Módulo Cocina & Catering

> **Fecha:** 21/07/2026
> **Propósito:** Entender el negocio de catering antes de diseñar el software
> **Base:** Spec funcional del cliente + migraciones aplicadas en servidor + datos reales en BD

---

## 1. EL NEGOCIO: Cómo funciona un catering de eventos

### 1.1 El ciclo completo de un evento

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CICLO DE CATERING                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. VENTA             2. RECETAS        3. PLANIFICACIÓN            │
│  ┌─────────────┐     ┌────────────┐     ┌──────────────────┐       │
│  │ Cliente      │     │ Chef crea   │     │ Escandallo:       │      │
│  │ elige menú   │────▶│ fichas      │────▶│ receta × pax     │      │
│  │ (134 platos) │     │ técnicas    │     │ = necesidades     │      │
│  └─────────────┘     └────────────┘     └────────┬─────────┘       │
│                                                   │                 │
│                    ┌──────────────────────────────┼──────────┐      │
│                    │                              │          │      │
│                    ▼                              ▼          ▼      │
│  ┌─────────────────────┐  ┌────────────────┐  ┌──────────────┐     │
│  │ 4. HOJA PRODUCCIÓN  │  │ 5. HOJA CARGA  │  │ 6. LOGÍSTICA │     │
│  │ "Qué cocinar y       │  │ "Qué llevar    │  │ "Qué comprar  │     │
│  │  quién lo hace"      │  │  en la furgo"  │  │  y cuándo"    │     │
│  └─────────────────────┘  └────────────────┘  └──────────────┘     │
│                                                   │                 │
│                                                   ▼                 │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              7. APPCC (Trazabilidad sanitaria)               │   │
│  │  "Lotes, temperaturas, alérgenos, limpieza — obligatorio     │   │
│  │   por ley RD 109/2010"                                       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Los 5 pilares del módulo cocina

#### Pilar 1: RECETAS (Fichas Técnicas)
**Qué es:** La definición de un plato con todos sus ingredientes y cantidades **por ración**.

**Ejemplo real** (del catálogo actual, 134 platos):
```
Plato: "Croquetas de jamón ibérico"
Categoría: aperitivo-caliente
PVP: 2.20 €/ud
Coste: 0.70 €/ud
Ingredientes por ración:
  - jamón ibérico: 30g
  - bechamel: 80g
  - (harina, leche, mantequilla: 60g)
  - huevo: 0.5 ud
  - pan rallado: 15g
```

**Para el negocio:** El chef define estas cantidades. Una vez definidas, el sistema **autocalcula** el coste del plato sumando ingredientes × precio unitario.

#### Pilar 2: ESCANDALLO
**Qué es:** La multiplicación de la receta por el número de comensales.

**Ejemplo:**
```
Evento: "Boda María y Carlos" — 120 comensales
Menú seleccionado:
  - Croquetas de jamón (2 ud/pax) → 120 × 2 = 240 uds
  - Solomillo al PX (180g/pax) → 120 × 180g = 21.6 kg
  - Tarta de queso (1 ración/pax) → 120 raciones
```

**Para el negocio:** El escandallo responde: "¿cuánto tengo que comprar/cocinar?". Es la **fuente de verdad** de la que derivan producción, carga y logística.

#### Pilar 3: HOJA DE PRODUCCIÓN
**Qué es:** Las tareas de cocina para el día del evento, organizadas por turno.

**Ejemplo:**
```
Evento: "Boda María y Carlos" — Fecha: 15 Agosto
Turno MAÑANA (8:00-14:00):
  - Preparar 240 croquetas de jamón → Cocinero: Juan
  - Cocinar 21.6 kg de solomillo → Cocinero: Pedro
  - Elaborar 120 tartas de queso → Cocinero: María
Turno TARDE (14:00-20:00):
  - Montaje de platos para servicio
  - Emplatado y acabado
```

#### Pilar 4: HOJA DE CARGA
**Qué es:** Lista de todo lo que hay que llevar al evento (comida preparada, materia prima, equipamiento, menaje).

**Ejemplo:**
```
Furgoneta #1 — Carga para Boda María y Carlos:
  - 240 croquetas (cocidas y empanadas, fritas in situ)
  - 21.6 kg solomillo (sellado, cocción final in situ)
  - 120 raciones de tarta de queso
  - 200 platos llanos
  - 200 copas de vino
  - 40 botellas de vino tinto
  - 2 freidoras industriales
  - 1 plancha
```

#### Pilar 5: APPCC (Análisis de Peligros y Puntos de Control Críticos)
**Qué es:** Obligación legal (RD 109/2010). Trazabilidad de cada ingrediente desde que entra por la puerta hasta que se sirve.

**Datos obligatorios:**
- Lote de cada ingrediente
- Fecha de recepción
- Temperatura de recepción (cámaras)
- Caducidad
- Proveedor
- Trazabilidad: "este solomillo del lote X se sirvió en la mesa 5 de la boda de los García"

---

## 2. DIAGNÓSTICO DEL ESTADO ACTUAL

### 2.1 Datos reales en la BD (producción)

| Tabla | Registros | Estado |
|-------|-----------|--------|
| `catalog_items` | **134** | ✅ Datos reales de platos (con ingredientes en JSONB) |
| `events` | **5** | ✅ Eventos activos |
| `event_shopping_items` | **36** | ✅ Escandallos generados (sistema viejo) |
| `recipes` | **0** | ❌ Vacío — sistema nuevo sin datos |
| `recipe_ingredients` | **0** | ❌ Vacío |
| `escandallos` | **0** | ❌ Vacío |
| `escandallo_lines` | **0** | ❌ Vacío |
| `hojas_produccion` | **0** | ❌ Vacío |
| `tareas_produccion` | **0** | ❌ Vacío |

### 2.2 Problemas identificados

| # | Problema | Impacto | Causa raíz |
|---|----------|---------|------------|
| 1 | APIs de cocina devuelven 500 | 🚫 No funciona nada | Columnas incorrectas en queries (`e.name` vs `e.client_name`) |
| 2 | `recipes` vacía | 🚫 No hay recetas en sistema nuevo | Migración creó tablas pero no migró datos |
| 3 | `escandallos` vacía | 🚫 No hay escandallos en sistema nuevo | APIs nuevas no conectan con datos viejos |
| 4 | Dos sistemas de recetas | 🚫 Confusión y duplicidad | `catalog_items.ingredients` (JSONB) vs `recipes` + `recipe_ingredients` |
| 5 | Import Excel no existe | 🚫 Chef no puede cargar recetas | Funcionalidad no implementada |

---

## 3. DECISIONES DE DISEÑO (ya tomadas ✅)

### Decisión 1: Sistema nuevo para todo
Usamos `recipes` + `recipe_ingredients` para las fichas técnicas.
**Implica:** Migrar los 134 platos del JSONB a las tablas nuevas.

### Decisión 2: Escandallos en sistema nuevo
Usamos `escandallos` + `escandallo_lines` para los cálculos.
**Implica:** Generar escandallos desde `recipes` × `guest_count`.

### Decisión 3: Vistas para compatibilidad
Las vistas creadas (`event_escandallos`, `event_escandallo_recetas`) se mantienen como capa de compatibilidad.

---

## 4. PLAN DE IMPLEMENTACIÓN (SDD + TDD)

### Fase 0: 🟣 Migración de datos (IMPORTANTE: hacer primero)

```
OBJETIVO: Poblar recipes + recipe_ingredients desde catalog_items.ingredients (JSONB)

Para cada catalog_item:
  1. Crear recipe con catalog_item_id, name, category
  2. Para cada ingrediente en el JSONB:
     - Buscar ingredient_id por nombre en ingredients table
     - Insertar en recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
  3. Calcular coste de la receta = Σ(ingredient_quantity × ingredient.cost_per_unit)
  4. Actualizar catalog_items.cost con el coste calculado

Script: scripts/2026-07-21-migrate-jsonb-to-recipes.sql
```

### Fase 1: 🟢 Tests (TDD)

```bash
src/lib/__tests__/cocina-recetas.test.ts      # 5 tests
src/lib/__tests__/cocina-escandallos.test.ts   # 5 tests
src/lib/__tests__/cocina-produccion.test.ts    # 3 tests
src/lib/__tests__/cocina-dashboard.test.ts     # 4 tests
```

### Fase 2: 🟡 Corregir APIs

```bash
src/app/api/cocina/dashboard/route.ts     # Corregir columnas
src/app/api/cocina/recetas/route.ts       # Usar recipes + recipe_ingredients
src/app/api/cocina/escandallos/route.ts   # Corregir columnas + joins
src/app/api/cocina/produccion/route.ts    # Corregir columnas
src/app/api/cocina/carga/route.ts         # Corregir
src/app/api/cocina/logistica/route.ts     # Corregir
src/app/api/cocina/appcc/route.ts         # Corregir
```

### Fase 3: 🔵 Import Excel

```bash
src/app/api/recipes/import/route.ts        # POST - importar Excel
src/lib/domain/recipeImport.ts             # Lógica de importación
# Plantilla: plato, categoría, ingrediente, cantidad, unidad, merma_%
```

### Fase 4: 🟠 UI (Páginas de cocina)

```bash
src/app/admin/cocina/layout.tsx            # ✅ Ya tiene buen diseño
src/app/admin/cocina/page.tsx              # Dashboard - conectar a API
src/app/admin/cocina/recetas/page.tsx      # Lista + import Excel
src/app/admin/cocina/escandallos/page.tsx   # Escandallos por evento
src/app/admin/cocina/produccion/page.tsx   # Hojas de producción
src/app/admin/cocina/carga/page.tsx        # Hojas de carga
src/app/admin/cocina/logistica/page.tsx    # Logística
src/app/admin/cocina/appcc/page.tsx        # APPCC
```

### Fase 5: 🟢 Verificación

```bash
npm run test:unit          # Tests unitarios pasan
bash scripts/verify-cocina.sh  # APIs responden 200
npm run build              # Build exitoso
```

---

## 5. PREGUNTAS PENDIENTES (para ti)

1. **Merma:** En catering profesional, se suele añadir un % de merma al escandallo (ej: 10% más de solomillo porque se pierde al recortar). ¿Quieres incluir `merma_pct` en `recipe_ingredients`?

2. **Pases (service_round):** Los eventos pueden tener varios pases (aperitivo, primero, segundo, postre). ¿Quieres que la hoja de carga agrupe por pase?

3. **Alérgenos:** Los 14 alérgenos legales (UE 1169/2011). ¿Quieres incluirlos en las fichas técnicas desde el principio?

4. **Categorías de cocina:** Las categorías actuales son de venta (aperitivo-frio, carne, etc.). ¿Quieres categorías de cocina (entrante, principal, postre) para organizar la producción?