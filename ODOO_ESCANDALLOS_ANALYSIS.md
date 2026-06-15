# Análisis: Escandallos — EventFlow vs Odoo (BoM/MRP)

> **Objetivo**: Comparar la gestión de escandallos (cost sheets / bills of materials) entre EventFlow y Odoo, identificando gaps y mejoras priorizadas.

---

## 1. QUÉ ES UN ESCANDALLO EN CATERING

Un escandallo es la desglose detallado de ingredientes necesarios para preparar un evento de catering. Equivale al **Bill of Materials (BoM)** de Odoo pero adaptado al sector hostelería:
- **Plato base** → conjuntos de ingredientes con cantidades
- **Escala por comensales** → cantidades multiplicadas por N pax
- **Proveedores** → de dónde viene cada ingrediente
- **Coste** → cuánto cuesta preparar el menú completo

---

## 2. CÓMO LO HACE ODOO

### 2.1 Bill of Materials (Manufacturing module)

| Característica | Descripción |
|---|---|
| **Componentes** | Cada BoM lista ingredientes con cantidad + unidad de medida |
| **Operaciones** | Pasos de producción (preparar, cocinar, emplatar) con centro de trabajo |
| **Coste por componente** | Precio medio de compra automático (basado en POs) |
| **Coste por operación** | Coste/hora del centro de trabajo × duración |
| **Coste total BoM** | Suma componentes + operaciones = coste estimado |
| **Coste real** | Se actualiza cuando se completa la orden de fabricación |
| **Variante de producto** | Componentes pueden ser específicos por variante |
| **Consumo flexible** | Configurable: bloqueado / permitido / permitido con aviso |
| **By-products** | Productos residuales (ej: huesos de carne → caldo) |
| **Versionado** | BoM tiene número de versión, visible con PLM |
| **Multi-BOM** | Un producto puede tener múltiples BoMs (por variante, por ubicación) |
| **Reordenamiento** | Reglas de reordenamiento automáticas basadas en stock mínimo/máximo |
| **Routing** | Ruta de fabricación por almacén |

### 2.2 Manufacturing Order Costs

| Característica | Descripción |
|---|---|
| **MO Cost (estimado)** | Coste según BoM: componentes + operaciones |
| **Real Cost (real)** | Coste real al completar la MO |
| **Desviación** | Diferencia estimado vs real visible en overview |
| **Coste medio** | Promedio de todas las MOs completadas para un producto |
| **Analytic distribution** | Asignación automática a diarios contables |

### 2.3 Restaurant POS (escandallo en tiempo real)

| Característica | Descripción |
|---|---|
| **Mesas y pisos** | Mapa de salón con mesas arrastrables |
| **Órdenes por mesa** | Cada mesa tiene su cuenta abierta |
| **Impresión cocina** | Envío directo a impresora de cocina/barra |
| **División de cuenta** | Split por items o por comensales |
| **Propinas** | Gestión de propinas integrada |
| **Self-ordering** | QR por mesa → cliente pide desde el móvil |

---

## 3. CÓMO LO HACE EVENTFLOW

### 3.1 Catálogo (CatalogCRUD)

| Característica | Estado |
|---|---|
| 10 categorías de platos | ✅ Implementado |
| CRUD de items (nombre, PVP, coste) | ✅ Implementado |
| Margen % calculado | ✅ Implementado |
| Precio estimado por keyword | ✅ Implementado |
| Active/Inactive toggle | ✅ Implementado |
| Búsqueda + filtros | ✅ Implementado |

### 3.2 Escandallos (StockManager → pestaña Escandallos)

| Característica | Estado |
|---|---|
| Generación desde catálogo | ✅ Auto-generado al aceptar presupuesto |
| Items con cantidades (g, u, ml) | ✅ Implementado |
| Edición inline de cantidades | ✅ Implementado |
| Agrupación por proveedor | ✅ Implementado |
| Stock check vs escandallo | ✅ Warning si stock insuficiente |
| Añadir ingredientes custom | ✅ Implementado |
| Totales por unidad | ✅ Gramos, unidades, ml |

### 3.3 Stock (StockManager → pestaña Stock)

| Característica | Estado |
|---|---|
| Ingredientes con quantity, min_stock | ✅ Implementado |
| Coste por unidad | ✅ Implementado |
| Restock action | ✅ Implementado |
| Proveedores inline | ✅ Implementado |
| Alertas stock bajo/agotado | ✅ Implementado |

### 3.4 Pedidos a Proveedor (StockManager → pestaña Pedidos)

| Característica | Estado |
|---|---|
| Crear pedido a proveedor | ✅ Implementado |
| Tracking de estado | ✅ Básico |
| Auto-restock on delivery | ✅ Implementado |

---

## 4. GAP ANALYSIS — Escandallos

### 🔴 GAPS CRÍTICOS

#### 4.1 **Sin recetas/plantillas reutilizables**
- **Odoo**: Cada BoM es una plantilla reutilizable. Puedes tener "Menú Boda Premium" como BoM y usarla para N eventos.
- **EventFlow**: Los escandallos se generan *per event* desde el catálogo. No hay plantilla reutilizable. Si cambias la receta de un plato, no se propaga a escandallos existentes.
- **Impacto**: Alta. Cada evento requiere reconfigurar cantidades desde cero.

#### 4.2 **Sin operaciones/pasos de producción**
- **Odoo**: Cada BoM tiene pestaña "Operaciones" con pasos: preparar → cocinar → emplatar. Cada paso tiene centro de trabajo, duración estimada, instrucciones.
- **EventFlow**: Solo lista ingredientes. Sin pasos de preparación, sin tiempos, sin instrucciones de cocina.
- **Impacto**: Media. Útil para catering grande con cocina industrial.

#### 4.3 **Sin coste real vs estimado**
- **Odoo**: MO tiene "MO Cost" (estimado según BoM) y "Real Cost" (real al completar). Diferencia visible.
- **EventFlow**: Coste del escandallo es estático (suma de costes unitarios). Sin tracking de coste real por evento.
- **Impacto**: Alta. No sabes si el evento fue más caro de lo previsto.

#### 4.4 **Sin desviación de consumo**
- **Odoo**: "Flexible Consumption" — permite que el operario use más/menos cantidad de la BoM. Registra la desviación.
- **EventFlow**: Cantidades fijas. No hay registro de cuánto se usó realmente vs cuánto se planificó.
- **Impacto**: Media. En catering real siempre hay mermas.

#### 4.5 **Sin historial de precios por proveedor**
- **Odoo**: Cada producto tiene historial de precios por proveedor (último precio, media, tendencia). Alerta si el precio sube.
- **EventFlow**: cost_per_unit es un valor estático. Sin historial, sin tracking de variaciones.
- **Impacto**: Alta. Los precios de ingredientes fluctúan mucho (frutas, mariscos, etc.).

#### 4.6 **Sin multi-unidad de medida**
- **Odoo**: Cada componente tiene unidad de medida (kg, g, L, ml, ud) con conversión automática. Puedes comprar en kg y usar en g.
- **EventFlow**: Tiene g/u/ml pero sin conversión automática entre unidades. No puedes comprar "5 kg de harina" y usar "200 g por receta".
- **Impacto**: Media. Causa confusión en pedidos a proveedor.

### 🟡 GAPS MEDIOS

#### 4.7 **Sin by-products (productos residuales)**
- **Odoo**: Permite definir productos residuales (ej: huesos → caldo, cáscaras → compost).
- **EventFlow**: No existe concepto. Todo es lineal (ingrediente → plato).

#### 4.8 **Sin versionado de recetas**
- **Odoo**: BoM tiene número de versión. Puedes ver el historial de cambios.
- **EventFlow**: Sin versionado. Si editas un ingrediente del catálogo, se pierde el valor anterior.

#### 4.9 **Sin conexión directa con pedidos de compra**
- **Odoo**: Desde la BoM se puede generar directamente un RFQ (Request for Quotation) a proveedor.
- **EventFlow**: Los pedidos a proveedor son manuales. No se generan automáticamente desde el escandallo.

#### 4.10 **Sin alertas de precio por proveedor**
- **Odoo**: Si el precio de un componente sube > X%, alerta automática.
- **EventFlow**: Sin alertas de precio. Solo alertas de stock bajo.

### 🟢 GAPS MENORES

#### 4.11 **Sin analytical distribution**
- **Odoo**: Asigna automáticamente el coste del escandallo a diarios contables.
- **EventFlow**: Sin integración contable.

#### 4.12 **Sin forecast de demanda**
- **Odoo**: Predice cuánto stock necesitarás basado en MOs programadas.
- **EventFlow**: Solo calcula necesidad actual, no forecast.

---

## 5. MEJORAS PRIORIZADAS

### Sprint E1 — Plantillas de Escandallo (2-3 días)
**Lo más impactante**: Crear recetas reutilizables.

1. Nueva tabla `recipe_templates`:
   - id, name (ej: "Menú Boda Premium 50 pax")
   - category (boda, corporativo, etc.)
   - base_pax (pax base para la receta)
   - items[] → ingredient_id, quantity_per_pax, unit
   - created_at, updated_at

2. Endpoint: `GET/POST/PUT/DELETE /api/recipes`

3. StockManager: nueva sub-pestaña "Recetas" donde:
   - Crear/editar recetas plantilla
   - Duplicar receta existente
   - Generar escandallo desde receta (escala por pax del evento)
   - Ver todas las veces que se usó una receta

4. Al aceptar presupuesto → generar escandallo desde receta plantilla (no desde catálogo directamente)

### Sprint E2 — Coste Real vs Estimado (1-2 días)
**Tracking de desviaciones**.

1. Nueva columna `event_shopping_items`:
   - `actual_quantity` (cantidad real usada, nullable)
   - `actual_cost` (coste real, nullable)

2. En OperationsManager, pestaña "Escandallo":
   - Columna "Real" al lado de "Planificado"
   - Input para registrar cantidad real usada
   - Cálculo automático de desviación (€ y %)

3. En el resumen del evento:
   - Coste estimado vs coste real
   - Desviación total
   - Ingredientes con mayor desviación

### Sprint E3 — Historial de Precios por Proveedor (2 días)
**Tracking de fluctuaciones de precio**.

1. Nueva tabla `ingredient_price_history`:
   - ingredient_id, supplier_id, price, recorded_at

2. Cada vez que se edita `cost_per_unit` de un ingrediente → registrar en historial

3. En StockManager, al editar precio:
   - Mostrar gráfico de tendencia (últimos 6 meses)
   - Mostrar precio anterior y variación %
   - Alerta si subida > 15%

4. Endpoint: `GET /api/stock/price-history?ingredient_id=X`

### Sprint E4 — Pedidos Automáticos desde Escandallo (2-3 días)
**Generación automática de RFQ**.

1. En OperationsManager → pestaña Escandallo:
   - Botón "Generar pedido a proveedor"
   - Agrupa ingredientes por proveedor
   - Calcula cantidades necesarias (escandallo - stock actual)
   - Crea supplier_order con items

2. Flujo:
   ```
   Escandallo → Check stock → Diferencia → Agrupar por proveedor → Crear pedido
   ```

3. En el pedido:
   - Cada item muestra: ingrediente, cantidad necesaria, stock actual, cantidad a pedir
   - Editable antes de confirmar

### Sprint E5 — Unidades de Medida con Conversión (1 día)
**Multi-UoM inteligente**.

1. Tabla `units_of_measure`:
   - id, name (kg, g, L, ml, ud)
   - category (weight, volume, unit)
   - factor (1 kg = 1000 g)

2. En ingredientes:
   - Campo `uom_purchase` (unidad de compra) y `uom_usage` (unidad de uso)
   - Conversión automática en escandallos y pedidos

3. Ejemplo:
   - Compras harina en `kg` (5 kg)
   - Usas en receta en `g` (200 g por ración)
   - Sistema convierte automáticamente

---

## 6. RESUMEN COMPARATIVO

| Funcionalidad | Odoo | EventFlow actual | Impacto |
|---|---|---|---|
| Plantillas reutilizables | ✅ BoM | ❌ Genera per-event | 🔴 |
| Pasos de producción | ✅ Operaciones | ❌ Solo ingredientes | 🟡 |
| Coste real vs estimado | ✅ MO overview | ❌ Solo coste estático | 🔴 |
| Desviación de consumo | ✅ Flexible | ❌ Cantidades fijas | 🟡 |
| Historial precios proveedor | ✅ Auto | ❌ Sin historial | 🔴 |
| Multi-unidad medida | ✅ Conversión | ⚠️ g/u/ml sin conversión | 🟡 |
| By-products | ✅ | ❌ | 🟢 |
| Versionado | ✅ PLM | ❌ | 🟢 |
| Generación RFQ desde BoM | ✅ Auto | ❌ Manual | 🟡 |
| Alertas precio | ✅ | ❌ | 🟡 |
| Analytic distribution | ✅ | ❌ | 🟢 |
| Forecast demanda | ✅ MPS | ❌ | 🟢 |
| **Lo que EventFlow tiene que Odoo NO** | | | |
| Generación auto desde presupuesto | ❌ | ✅ | — |
| Escandallo por evento específico | ⚠️ | ✅ | — |
| Stock check inline | ❌ | ✅ | — |
| Categorías de menú (aperitivo, etc.) | ❌ | ✅ | — |

---

## 7. CONCLUSIÓN

**El mayor gap** es la falta de **plantillas de escandallo** (BoM templates). En Odoo, defines una receta una vez y la usas N veces. En EventFlow, cada evento genera su escandallo desde cero, lo que es propenso a errores y no permite estandarización.

**Sprint E1 (Plantillas)** debería ser la prioridad #1 — es el cambio que más impacta en la productividad diaria.

**Sprint E2 (Coste real)** es la prioridad #2 — sin tracking de coste real, no puedes saber si un evento fue rentable.

**Sprint E3 (Historial precios)** es la prioridad #3 — los precios de ingredientes fluctúan mucho en catering, y sin historial estás "a ciegas".
