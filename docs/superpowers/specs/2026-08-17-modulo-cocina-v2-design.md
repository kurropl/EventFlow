# EventFlow — Diseño del Módulo Cocina (v3)

> **Fecha:** 2026-08-17
> **Estado:** Diseño en revisión — v3 integra la revisión del jefe de cocina/compras e inspector de sanidad
> **Principio rector:** El usuario trabaja por **flujo natural de trabajo**, no por fases legales. APPCC se organiza como "recorrido del alimento" (de la nevera al plato).
> **Decisiones clave del usuario:**
> - Escandallo es INFORMATIVO de faltantes; Stock/Compras es donde se compra con human-in-the-loop.
> - La producción y generación de platos debe quedar completa antes de abordar menús.
> - La plataforma será multi-eventos y multi-centro (Cocina Central + salones Benítez).

---

## 1. Visión general — El flujo completo de cocina

```
RECETA → ESCANDALLO → [¿FALTA STOCK?] → STOCK/COMPRAS (HITL) → RECEPCIÓN (APPCC)
   │          │              │              │                     │
   │          │              │              ├─ enviado → [confirmado*] → recibido
   │          │              └─ aviso       └─ (*opcional, ver §5.6)
   │          ▼              informativo
   └── PRODUCCIÓN (hojas: quién hace qué, cuándo, agregado multi-evento)
          │
          ▼
       CARGA (qué se lleva: pases + vajilla + packs + retornables)
          │
          ▼
       LOGÍSTICA (material: ida/vuelta + transporte APPCC)
          │
          ▼
       APPCC (recorrido del alimento + prerrequisitos del plan)
          │
          ▼
    CIERRE DE EVENTO (consumo real, vuelta, food cost real vs teórico)
```

**Regla de oro:** cada plato tiene ficha técnica (receta). Cada evento necesita ingredientes (escandallo). Si falta stock → se compra con aprobación humana. Todo lo que se cocina queda registrado en producción y trazabilidad. **Todo lo que entra en stock sale en algún momento (consumo, merma o caducidad) — el stock debe ser fiable siempre.**

---

## 2. Navegación del módulo Cocina (7 secciones)

```
Cocina:
├── 🏠 Panel          — alertas reales: cámaras sin registrar, fecha límite de pedido,
│                        lotes caducando, OCs sin recibir, hojas sin generar
├── 📖 Recetas        — fichas técnicas + elaboración (sub-recetas, variantes, alérgenos derivados)
├── 💰 Escandallos    — necesidades por tipo de pax + aviso informativo de faltantes
├── 🍳 Producción     — hojas (por evento y agregadas multi-evento): timing, zonas, checklist
├── 🚚 Carga          — qué se lleva: comida por pases + vajilla + packs + retornables
├── 📦 Stock/Compras  — inventario, propuestas de OC por proveedor (HITL), regularizaciones
└── 🛡 APPCC          — seguridad alimentaria (recorrido del alimento + prerrequisitos)
```

---

## 3. 📖 RECETAS — Fichas técnicas completas

### 3.1 Estructura de la ficha (completa)

La ficha técnica de un plato en catering NO es plana. Componentes:

| Componente | Descripción | Estado |
|---|---|---|
| Datos base | name, category, servings, pvp, cost_per_serving, foto emplatado, active | ✅ existe |
| Ingredientes | cantidad/unit/por ración, **merma por ingrediente** (rendimiento crudo→limpio→cocinado) | 🟡 parcial |
| **Sub-recetas** | elaboraciones intermedias (fondos, salsas, masas, rellenos) reutilizables en varios platos | 🔴 NUEVO |
| Alérgenos | **derivados automáticamente de los ingredientes** (14 del Reglamento 1169/2011, incl. trazas) | 🔴 NUEVO |
| **Variantes** | sin gluten, vegano, sin lactosa… cada variante con su propia lista de ingredientes | 🔴 NUEVO |
| Elaboración | preparation_steps, prep_days_before, estimated_time_minutes | ✅ en BD (verificar UI) |
| Vida útil | horas/días de vida útil de la elaboración terminada (para etiquetado + APPCC) | 🔴 NUEVO |
| Versionado | cada edición de la ficha crea versión; el escandallo **congela versión + precio del momento** | 🔴 NUEVO |
| Factor de escalado | **no lineal** para grandes pax (sal, especias, tiempos no escalan ×2 a 400 pax) | 🔴 NUEVO |

### 3.2 Alérgenos derivados (Reglamento 1169/2011 — 14 alérgenos)

- Los 14 alérgenos se registran **por ingrediente** (tabla `ingredient_allergens` o columna JSONB en `ingredients`)
- La ficha del plato **los hereda automáticamente** de la unión de sus ingredientes (incl. sub-recetas)
- No se rellenan a mano en la receta (evita errores humanos = riesgo sanitario)
- Campo "trazas" opcional para contaminación cruzada
- Las variantes del plato recalculan su perfil alérgeno (sin gluten → sin ingredientes con gluten)

### 3.3 Sub-recetas / elaboraciones intermedias

- Modelo recursivo: una sub-receta es una receta con `tipo='elaboracion'` (no plato final)
- Ejemplo: "Crema pastelera" usada en 3 postres — se define una vez, se referencia
- El coste del plato final = Σ ingredientes + Σ sub-recetas (con su propia merma)
- La producción puede fabricar la sub-receta una vez y repartirla entre platos

### 3.4 Versionado y congelación de costes

- Cada modificación de ficha → nueva `version` (tabla `recipe_versions` o version column)
- `escandallo_lines` guarda **copia del coste en el momento** (ya lo hace con cost_unit/cost_total) → el histórico no se recalcula
- El escandallo referencia `recipe_version` para auditoría

### 3.5 Datos nuevos (esquema)

```sql
ALTER TABLE ingredients ADD COLUMN allergens jsonb;      -- [{"id":"gluten","trazas":false}]
ALTER TABLE ingredients ADD COLUMN rendimiento numeric;   -- 0.75 = 75% útil tras limpieza
ALTER TABLE ingredients ADD COLUMN vida_util_horas int;
ALTER TABLE recipes ADD COLUMN tipo text DEFAULT 'plato'; -- 'plato' | 'elaboracion'
ALTER TABLE recipes ADD COLUMN escalado_no_lineal jsonb;  -- {"sal_factor":0.85,"especias_factor":0.8,"tiempo_max_min":120}
ALTER TABLE recipes ADD COLUMN foto_url text;
ALTER TABLE recipes ADD COLUMN vida_util_horas int;
ALTER TABLE recipes ADD COLUMN version_actual int;
-- Tabla nueva: variantes
CREATE TABLE recipe_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid REFERENCES recipes(id) ON DELETE CASCADE,
  nombre text NOT NULL,             -- 'Sin gluten', 'Vegano', 'Sin lactosa'
  recipe_ingredients jsonb NOT NULL -- lista de ingredientes de la variante
);
```

---

## 4. 💰 ESCANDALLOS — Necesidades por tipo de pax + aviso informativo

### 4.1 Pax por tipo (no un número)

```
pax_adultos    → receta estándar
pax_infantil   → receta infantil (o porción reducida)
pax_personal   → menú de personal (ración distinta, no cuenta en food cost del evento)
pax_proveedores→ ídem
pax_especiales → variantes de receta (sin gluten, vegano…) con recetas distintas
```

- `events.guest_count` se desglosa en columnas o en una tabla `event_pax_types`
- El escandallo calcula por grupo: `necesidad = Σ (receta_grupo × pax_grupo)`
- Los especiales van con su variante de receta

### 4.2 Margen de seguridad configurable

- `business_settings.escandallo_seguridad_pct` (default 5%): nadie compra justo para 200
- La necesidad de compra = necesidad teórica × (1 + seguridad%) — el escandallo informativo muestra ambos

### 4.3 Semi-elaborados ya en stock

- Si hay una elaboración intermedia congelada de la semana pasada (sub-receta), **cubre parte de la necesidad**
- El cálculo de faltantes descuenta stock de ingredientes Y de sub-recetas disponibles (tabla `elaboraciones_stock` o por lote)

### 4.4 Aviso informativo de faltantes (FROZEN la lógica existente)

- Al ver el escandallo: panel **"Disponibilidad"** — `✅ Suficiente` / `⚠️ Faltan X g de [ingrediente]`
- Es **solo lectura** — comprar se hace en Stock/Compras (§5)
- Muestra: necesario (con seguridad%), stock actual, comprometido (inventory_commitments de otros eventos), disponible, faltante

### 4.5 Liberación de inventory_commitments

- Cuándo se libera un compromiso: **evento cancelado** o **pax reducidos** (se recalcula el compromiso)
- También al **consumo real** (cierre de evento): el compromiso se convierte en consumo efectivo

### 4.6 Contrato API (nuevo)

```
GET /api/cocina/escandallos/[escandalloId]/disponibilidad
→ [ { ingredient_id, nombre, unidad, necesario, con_seguridad, stock, comprometido, disponible, faltante } ]
```

---

## 5. 📦 STOCK/COMPRAS — Compra con human-in-the-loop + datos maestros

### 5.1 Datos maestros proveedor × ingrediente (CRÍTICO)

Para agrupar OCs por proveedor y proponer cantidades reales:

```sql
CREATE TABLE supplier_ingredient_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES providers(id) ON DELETE CASCADE,
  ingredient_id uuid REFERENCES ingredients(id) ON DELETE CASCADE,
  precio_vigente numeric(12,4) NOT NULL,     -- € por unidad de COMPRA
  unidad_compra text NOT NULL,               -- 'caja','kg','botella'…
  cantidad_por_unidad numeric NOT NULL,      -- 6 = caja de 6 kg
  unidad_uso text NOT NULL,                  -- 'g' (unidad del ingrediente)
  factor_conversion numeric NOT NULL,        -- 6000 g por caja → factor 6000
  pedido_minimo numeric,                     -- unidades de compra
  plazo_entrega_dias int,                    -- lead time
  dias_reparto text[],                       -- ['lunes','jueves']
  preferente boolean DEFAULT false,          -- proveedor preferente
  activo boolean DEFAULT true,
  UNIQUE (supplier_id, ingredient_id)
);
```

**Por qué es crítico:**
- Sin lead time no se calcula la **fecha límite de pedido** = fecha_evento − prep_days_before − plazo_proveedor (la alerta más útil del panel)
- Las propuestas de OC deben **redondear a la unidad de compra** (necesitas 4,7 kg → compras 1 caja de 6 kg)
- Precio vigente con historial (ya existe `ingredient_price_history` para precios de ingrediente)

### 5.2 Regularizaciones de inventario (30% del trabajo real de compras)

```sql
CREATE TABLE inventory_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id uuid REFERENCES ingredients(id),
  ajuste numeric NOT NULL,              -- negativo = rotura/merma/caducado; positivo = sobrante/recuento
  tipo text NOT NULL CHECK (tipo IN ('recuento','rotura','merma','caducado','sobrante','ajuste')),
  motivo text,
  responsable uuid REFERENCES admins(id),
  created_at timestamptz DEFAULT now()
);
```

- **Recuento físico periódico**: ajuste con motivo y responsable
- **Roturas, mermas, caducados**: ajuste negativo documentado
- Esto mantiene `ingredients.quantity` fiable (ver §6 Consumo)

### 5.3 Compra sin OC previa (el día a día)

- Compras directas (Makro, mercado, urgencias) sin propuesta previa
- Registro directo: proveedor, productos, precio, albarán
- Tipo `origin='directa'` en `supplier_orders` o tabla separada de gastos de compra

### 5.4 Recepción completa (con rechazo y parciales)

- **Recepción parcial / backorder**: la OC `recibido` puede quedar con líneas pendientes (se reabre o se marca `backorder`)
- **Diferencias pedido vs recibido**: se registran (cantidad pedida vs recibida por línea)
- **Rechazo en muelle**: temperatura fuera de rango o caducidad próxima → rechazo con **devolución y no conformidad del proveedor** registrada (queda en el historial del proveedor para homologación)
- Ajuste automático de stock con lo realmente recibido

### 5.5 Ciclo de vida de la OC (corregido — sin bomba semántica)

```
propuesta → enviado → [confirmado*] → recibido
                              ↘ cancelado
* confirmado es OPCIONAL (la mitad de los proveedores nunca confirman;
  se puede pasar de enviado a recibido directamente)
```

| Estado | Significado | Quién marca |
|---|---|---|
| `propuesta` | Faltantes agrupados por proveedor, revisables línea a línea | Sistema |
| `enviado` | Pedido hecho al proveedor | Humano ("Enviar pedido") |
| `confirmado` | Proveedor confirmó (opcional) | Humano ("Proveedor confirma") |
| `recibido` | Mercancía recibida + APPCC + stock | Humano ("Recibir") |
| `cancelado` | Anulada con motivo | Humano ("Cancelar") |

**⚠️ Corrección v3 (revisión usuario):** NO mapear `confirmado`→`delivered` en BD. Es ambiguo para cualquiera que lea la tabla o una futura integración. Se **añade un valor real al enum**:

```sql
ALTER TABLE supplier_orders DROP CONSTRAINT IF EXISTS supplier_orders_status_check;
ALTER TABLE supplier_orders ADD CONSTRAINT supplier_orders_status_check
  CHECK (status IN ('propuesta','enviado','confirmado','recibido','cancelado'));
-- Migración de datos: pending→propuesta, ordered→enviado, delivered→confirmado, received→recibido, cancelled→cancelado
```

### 5.6 Human-in-the-loop (revisión línea a línea)

1. **Generar propuesta**: evento o stock bajo → faltantes → agrupar por proveedor (con datos maestros §5.1)
2. **Revisar**: quitar líneas, ajustar cantidades (redondeadas a unidad de compra), cambiar proveedor preferente/alternativo
3. **Enviar**: propuesta → `enviado` (formalizada)
4. Historial de decisiones: quién ajustó qué, cuándo

### 5.7 Ubicación de almacén y FEFO

- **Ubicación por lote**: `stock_lots` → añadir `ubicacion` (Cámara 1, Congelador, Seco)
- **FEFO por caducidad**: el consumo prioriza el lote que caduca antes; alertas de próximos a caducar
- **Conciliación albarán vs factura**: vincular `provider_invoices` a la OC recibida (importes, IVA) — tabla existe
- **Retornables**: cajas, envases que vuelven al proveedor → registro de retornables en recepción/logística

### 5.8 Contratos API

```
POST /api/stock/necesidades                       — faltantes de evento (vs stock + compromisos + semielaborados)
POST /api/stock/propuesta-oc                      — propuestas por proveedor (revisable, redondeo unidad compra)
PUT  /api/stock/supplier-orders/[id]/enviar        — propuesta → enviado
PUT  /api/stock/supplier-orders/[id]/confirmar     — enviado → confirmado (opcional)
PUT  /api/stock/supplier-orders/[id]/recibir       — confirmado|enviado → recibido (dispara APPCC + stock + backorder)
PUT  /api/stock/supplier-orders/[id]/cancelar      — → cancelado
POST /api/stock/regularizaciones                   — ajuste de inventario (recuento/rotura/merma/caducado)
POST /api/stock/compras-directas                   — compra sin OC
GET  /api/providers/[id]/pricing                   — datos maestros proveedor×ingrediente (CRUD)
```

---

## 6. 🔄 CONSUMO DE STOCK — La regla que hace fiable todo el modelo (CRÍTICO)

**Problema:** el diseño anterior definía cómo entra la mercancía pero no cuándo sale. Sin la regla de consumo, `ingredients.quantity` deja de ser fiable a la segunda semana y el panel de disponibilidad miente.

**Regla de consumo (FIFO/FEFO):**

```
1. ESCANDALLO       → crea inventory_commitments (promesa de consumo, no descuenta)
2. RECEPCIÓN        → entra stock por lote (stock_lots)
3. CIERRE OPERATIVO → al CERRAR OPERATIVO el evento (OPC-3, fin del servicio):
                      descuenta stock de las tareas completadas por lote
                      FIFO/FEFO (el que caduca antes)
4. CARGA/VUELTA     → sobrantes que vuelven → reingresan; desechados → ajuste merma
5. CIERRE CONTABLE  → el evento se cierra DEFINITIVO solo al cobrar (OPC-5)
```

**Implementación:**
- Descuento de stock por lote: `stock_lots.qty_base_remaining -= cantidad_consumida` (FEFO: primero el que caduca antes)
- `ingredients.quantity` = Σ qty_base_remaining de sus lotes (espejo consistente)
- El descuento ocurre en el **cierre operativo** (closeEvent → deductStockForEvent, que YA se llama hoy; falta hacerlo FEFO por lote)
- **Sobrantes/mermas**: en la vuelta de carga, lo no consumido reingresa; lo declarado merma → `inventory_adjustments`
- El **cierre contable** (OPC-5, cuando se cobra) NO vuelve a tocar stock — solo finanzas

**Verificación requerida antes de implementar:** revisar `src/lib/stockDeduct.ts` — hoy descuenta del global `ingredients.quantity` (no por lote FEFO). Y confirmar el criterio de "se ha cobrado" para OPC-5 (ver §7.5).

---

## 7. 🏁 CIERRE DE EVENTO — Dos etapas: operativo (parcial) y contable (cuando se cobra)

### 7.1 El evento tiene DOS cierres (ya existe en la máquina de estados WP-04)

El evento NO se cierra de golpe. Hay un estado intermedio que hace el cierre parcial (operativo) y el cierre definitivo ocurre cuando se cobra (contable):

```
in_progress → cerrado_operativo → cerrado_contable
  (día D)     (cierre parcial:      (cierre TOTAL: solo cuando
               consumo, vuelta,      se cobra el evento)
               food cost real)
```

**Transiciones ya definidas en `src/domain/eventStateMachine.ts`:**
- `OPC-3`: `in_progress → cerrado_operativo` — cierre operativo (checklist completo)
- `OPC-4`: `en_preparacion → cerrado_operativo` — sin evento físico (se cancela la parte presencial pero se factura)
- `OPC-5`: `cerrado_operativo → cerrado_contable` — cierre contable (finanzas, cobro)
- `INV-7`: `cerrado_operativo → in_progress` — reapertura para correcciones

### 7.2 Cierre OPERATIVO (parcial — al terminar el servicio)

```
CERRADO OPERATIVO (OPC-3/OPC-4):
├── Consumo real por ingrediente (stockDeduct existente — falta FEFO, ver §6)
├── Freeze del escandallo (freezeEscandallo — ya existe, congela teórico)
├── Vuelta de comida (hoja de carga "vuelta"): retornado / desechado
├── Food cost real vs teórico → desviación (event_cost_deviations)
├── Coste real por pax
├── Lotes consumidos (trazabilidad cerrada)
├── Cierre del checklist operativo (event_closure_checklists)
└── EL EVENTO SIGUE ABIERTO para finanzas (no se ha cobrado)
```

**Lo que YA hace hoy `closeEvent` (src/lib/domain/closeEvent.ts):** freezeEscandallo + deductStockForEvent + setEventStatus('completed' = cerrado_operativo). **Lo que falta:** FIFO/FEFO por lote, vuelta de comida, food cost real persistido.

### 7.3 Cierre CONTABLE (definitivo — SOLO cuando se cobra EN SU TOTALIDAD)

```
CERRADO CONTABLE (OPC-5):
├── Se ejecuta SOLO cuando el evento está cobrado EN SU TOTALIDAD
│   (todas las facturas del evento pagadas, balance_due = 0)
├── La señal NO cuenta: se paga ANTES de reservar (decisión usuario)
├── Emite factura(s) pendientes (createInvoice)
├── Marca hitos pagados → estado 'paid' de hitos
├── Cierre económico: ventas, cobros, desviación final
└── El evento queda cerrado definitivamente (cerrado_contable)
```

**Regla de cobro (decisión usuario):**
- **La señal** se cobra antes de reservar el evento (no es "cobro parcial" del cierre — es la reserva)
- **El cierre contable exige cobro TOTAL**: todas las facturas del evento pagadas (balance_due = 0)
- Mientras quede saldo pendiente, el evento permanece `cerrado_operativo`

### 7.3bis Costes directos vs compartidos (gastos que no son de un solo evento)

**Problema (decisión usuario):** los pagos de facturas NO van vinculados a un solo evento. Ejemplo: un evento necesita 100 g de gambas pero se compran 2 kg; o una freidora que se usa en varios eventos.

**Modelo — dos tipos de gasto:**

```
GASTO DIRECTO (por evento):
  · Compras de la OC del evento (supplier_orders.event_id)
  · Consumo real registrado en producción/cierre operativo
  → alimenta food_cost_real del evento directamente

GASTO COMPARTIDO (multi-evento):
  · Compras en bulk (2 kg de gambas para varios eventos)
  · Equipamiento (freidora, vajilla, menaje)
  · provider_invoices (hoy SIN event_id — gasto general)
  → se registran como gasto general y se ASIGNAN a eventos
```

**Asignación de gastos compartidos (a definir en finanzas):**
- Por consumo real (lo que cada evento usó del lote)
- O por prorrateo (peso/coste / nº de eventos que lo usan)
- El cierre contable del evento incluye: gastos directos + su parte asignada

**Cambio de esquema necesario:**
```sql
-- provider_invoices: permitir vincular a OC y/o evento
ALTER TABLE provider_invoices ADD COLUMN supplier_order_id uuid REFERENCES supplier_orders(id);
ALTER TABLE provider_invoices ADD COLUMN event_id uuid REFERENCES events(id); -- NULL = compartido
-- O: tabla de asignación de gastos compartidos
CREATE TABLE cost_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_invoice_id uuid REFERENCES provider_invoices(id),
  event_id uuid REFERENCES events(id),
  cantidad_asignada numeric(12,4),
  tipo text CHECK (tipo IN ('consumo_real','prorrateo')),
  created_at timestamptz DEFAULT now()
);
```

### 7.4 Datos

```sql
-- Ampliar hojas_carga con "vuelta"
ALTER TABLE items_carga ADD COLUMN retornado numeric DEFAULT 0;
ALTER TABLE items_carga ADD COLUMN desechado numeric DEFAULT 0;
ALTER TABLE items_carga ADD COLUMN tipo_vuelta text; -- 'comida','vajilla','equipo'

-- Cierre del evento (operativo)
ALTER TABLE events ADD COLUMN closed_at timestamptz;
ALTER TABLE events ADD COLUMN food_cost_real numeric;   -- Σ consumo real
ALTER TABLE events ADD COLUMN food_cost_teorico numeric;-- del escandallo congelado
```

- `event_closure_checklists` (existe) se amplía con la fase de vuelta/consumo
- `event_cost_deviations` (existe) alimenta la desviación real vs teórica
- El cierre contable reutiliza `createInvoice` + `payments` (ya existentes)

### 7.5 Verificación requerida

- **Criterio de cobro (RESUELTO, decisión usuario):** el cierre contable (OPC-5) exige cobro TOTAL — todas las facturas del evento pagadas (balance_due = 0). La señal se cobra antes de reservar (no cuenta como cobro parcial del cierre).
- **Costes compartidos (RESUELTO, decisión usuario):** los gastos no se vinculan a un solo evento (compras en bulk, equipamiento). Se modelan como gasto compartido y se asignan (ver §7.3bis).
- Implementar el check `balance_due = 0` en `OPC-5` de `transitions/route.ts`.

---

## 8. 🍳 PRODUCCIÓN — Hojas por evento Y agregadas multi-evento

### 8.1 Producción agregada (lo más grande que faltaba)

- El jueves haces **40 kg de salmorejo para 3 eventos del fin de semana**, no una hoja por evento
- Nueva entidad: `orden_produccion` (elaboración concreta, cantidad, fecha, destino = varios eventos)
  - o extender `hojas_produccion` con `evento_origen` opcional (NULL = agregada multi-evento)
- Las tareas de una orden multi-evento alimentan las hojas de los eventos que la consumen

### 8.2 Etiquetado de elaboraciones (obligatorio + habilita trazabilidad interna)

- Toda elaboración terminada recibe **etiqueta**: fecha elaboración, fecha caducidad (vida útil), alérgenos, lote interno
- **Impresión de etiquetas** (PDF/etiquetadora)
- El lote interno enlaza con los platos que la consumen → trazabilidad hacia adelante (§12.4)

### 8.3 Dónde se termina el plato

- **Cocina central** vs **regenerado in situ** (salón): cambia carga (hornos, equipos), APPCC (transporte), personal
- `event` o la hoja de producción indica el modo: `terminacion='central'|'in_situ'`
- Influye en la generación de la hoja de carga y en los controles APPCC de transporte

### 8.4 Tareas enganchadas con APPCC

- La tarea "asar pollo" **pide la temperatura de cocción al completarse** (engancha con appcc_controles)
- Config: cada tarea puede tener `appcc_control` asociado (tipo, límites)
- Al completar una tarea con APPCC, se abre el registro de control (semáforo)

### 8.5 Capacidad (timing real, no decorativo)

- Capacidad por franja: **hornos** (nº), **abatidores**, **personas por zona**
- Tabla `capacidad_equipos` (equipo, cantidad, eventos simultáneos posibles)
- El timing propuesto valida contra capacidad y avisa de conflictos (2 eventos quieren el mismo horno a las 11:00)

### 8.6 Estado actual (verificado en prod)

- `hojas_produccion`, `tareas_produccion`, `event_timeline`, `kitchen_zones` (VACÍA) existen
- API `/api/cocina/event/[id]/production` → **500** (`esi.category`) — fix pendiente
- `staffing_lines` — verificar si ya tiene `kitchen_zone`

---

## 9. 🚚 CARGA y 📦 LOGÍSTICA — Con transporte como fase APPCC

### 9.1 Carga (qué se lleva)

- Comida por pases + vajilla (con stock) + packs + **retornables** (cajas, envases)
- **Material de cocina (🍳) vs operaciones/servicio (🍷)** separados — decisión previa del usuario
- Generar desde producción: platos → ítems de comida; pax → sugerencia de vajilla
- **Doble verificación**: cargado / descargado en destino / retorno

### 9.2 Logística (material reutilizable)

- Control ida/vuelta por evento (`event_equipment_checkout` existe: quantity_sent/returned)
- **Material alquilado a terceros** con devolución (vajilla alquilada, cristalería)
- **Consumibles no retornables**: hielo, gas, servilletas (van a gasto, no a inventario)
- **Roturas y pérdidas con coste**: registro con valor para food cost/seguro
- **Mantenimiento y calibración de equipos**: sondas de temperatura, hornos, abatidores — registro exigido en el plan APPCC (tabla `haccp_equipment_calibration` existe)
- **¿Dónde viven las bebidas?** Decisión: módulo de bebidas (escandallo/bebidas) o carga — propuesta: las bebidas del evento se gestionan en Escandallos (motor de bebidas) y la carga las recoge como ítems de entrega

### 9.3 Transporte como fase APPCC (RD 3484/2000 — comidas preparadas)

```sql
CREATE TABLE transporte_registros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id),
  vehiculo text NOT NULL,
  conductor text NOT NULL,
  matricula text,
  hora_salida timestamptz,
  hora_llegada timestamptz,
  temp_salida_frio numeric,      -- frío ≤8°C
  temp_salida_caliente numeric,  -- caliente ≥65°C
  temp_llegada_frio numeric,
  temp_llegada_caliente numeric,
  isotermo boolean DEFAULT true,
  cumple boolean GENERATED ALWAYS AS (temp_salida_frio IS NULL OR (temp_salida_frio <= 8 AND temp_llegada_frio <= 8)) STORED,
  notas text,
  created_at timestamptz DEFAULT now()
);
```

- Los límites: frío **≤8°C**, caliente **≥65°C** (RD 3484/2000)
- Se registra al cargar (salida) y al llegar (destino)
- Verificación del vehículo isotermo

---

## 10. 🛡 APPCC — Recorrido del alimento + prerrequisitos del plan

### 10.1 Las 5 pestañas del recorrido (flujo físico)

```
🛡 APPCC
├── 1. RECEPCIÓN       — proveedor, producto, temperatura, lote (escaneo), albarán (foto), rechazo en muelle
├── 2. ALMACÉN         — cámaras mañana/tarde, excedencias, ubicación por lote, FEFO
├── 3. ELABORACIÓN     — descongelación, cocción (74/70/65°C), enfriamiento <2h, conservación ≥65°C
├── 4. SERVICIO & LIMPIEZA — buffet caliente ≥65 / frío ≤8, limpieza por zonas
└── 5. INCIDENCIAS & ACEITE — registro + acciones correctivas, aceite ≤25% polares
```

### 10.2 Controles obligatorios cubiertos (checklist legal)

| Fase | Control | Límite | Estado |
|---|---|---|---|
| Recepción | Temperatura producto | según tipo | ✅ + rechazo muelle (§5.4) |
| Recepción | Embalaje, caducidad, etiquetado | — | ✅ |
| Almacén | Cámaras 2×/día | Frigo ≤4°C, Cong ≤−18°C | ✅ |
| Almacén | Excedencias + **acción correctiva obligatoria** | — | 🟡 vincular |
| **Descongelación** | Controlada en cámara | nunca TA | 🔴 NUEVO |
| Elaboración | Cocción centro producto | aves ≥74, picados ≥70, resto ≥65°C | ✅ (semáforo a refinar) |
| **Enfriamiento rápido** | 65→10°C en <2h | <2h | 🔴 NUEVO |
| **Conservación caliente** | plato a servicio | ≥65°C | 🔴 NUEVO |
| Servicio | Buffet caliente / frío | ≥65 / ≤8°C | ✅ |
| Aceite | Compuestos polares | ≤25% | ✅ |
| Limpieza | Plan por zonas | — | ✅ |
| Incidencias | Registro + **acción correctiva obligatoria** por excedencia | — | 🟡 vincular |
| Trazabilidad | Lotes, proveedor, albarán (RD 178/2002) | — | ✅ + hacia adelante (§10.5) |

### 10.3 Prerrequisitos del plan APPCC (lo que Sanidad pide SIEMPRE y faltaba)

```sql
CREATE TABLE appcc_prerrequisitos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL, -- 'plagas','agua','formacion','proveedores','mantenimiento','residuos','verificacion'
  registro jsonb,     -- según tipo
  responsable uuid REFERENCES admins(id),
  fecha_hora timestamptz DEFAULT now(),
  documento_url text  -- contrato DDD, certificado, etc.
);
```

| Prerrequisito | Qué registra |
|---|---|
| **Control de plagas** | Contrato DDD (desinfección, desratización), visitas, cebos |
| **Control del agua** | Análisis, cloro, mantenimiento del sistema |
| **Formación de manipuladores** | Registro por persona (curso, caducidad carné) |
| **Homologación de proveedores** | Registro sanitario, no conformidades, evaluación periódica |
| **Mantenimiento y calibración** | Equipos críticos, sondas (haccp_equipment_calibration) |
| **Gestión de residuos** | Contratos, retiradas, registro |
| **Verificación del plan** | Auditorías internas, revisión del plan |

### 10.4 Muestras testigo

- En colectividades se exige **conservar una muestra por plato** varios días (72h típico)
- Registro: plato, evento, fecha, responsable, ubicación muestra, retirada
- `appcc_muestras_testigo` (evento, plato, fecha, responsable, retirada)

### 10.5 Trazabilidad hacia adelante (retirada)

- **Lote → qué platos/eventos lo consumieron** (para poder hacer una retirada de producto)
- Se construye: stock_lots (lote) → tareas_produccion (plato) → hojas_produccion (evento)
- Vista: "dado el lote X, qué eventos sirvieron platos con ese lote"
- Es la mitad del RD 178/2002 que faltaba (la otra mitad —hacia atrás— ya existe)

### 10.6 Registros completos y exportación

- **Cada registro necesita: responsable, hora y firma** (appcc_controles ya tiene responsable + fecha_hora)
- **Exportar a PDF por rango de fechas**: es literalmente lo que se entrega cuando llega Sanidad
  - PDF por centro de trabajo y período
  - Incluye: todos los controles, excedencias, acciones correctivas, prerrequisitos
- **Retención de registros definida** (default 6 meses, configurable — normativa)

---

## 11. 👥 TRANSVERSAL — Roles, auditoría, multi-centro, alertas, UX

### 11.1 Roles y permisos

| Acción | Roles |
|---|---|
| Aprobar/enviar OC (compras) | jefe-cocina, gerente, admin |
| Firmar APPCC | jefe-cocina, cocinero (validado por jefe) |
| Editar fichas de receta | jefe-cocina, admin |
| Regularizar inventario | jefe-cocina, admin |
| Cerrar evento | gerente, admin |
*(reutilizar la matriz RBAC existente de 7 roles)*

### 11.2 Auditoría de cambios

- Tabla `audit_log` (existe) se alimenta en: ediciones de receta, cambios de precio, aprobaciones de OC, regularizaciones, cierres
- Quién, qué, cuándo, antes/después

### 11.3 Multi-centro

- **Cocina Central** vs **Salones Benítez** (2 ubicaciones)
- Stock por ubicación: `ingredients.quantity` por centro (o `stock_ubicaciones`)
- Los eventos se sirven desde un centro; la logística mueve stock entre centros
- Decisión de alcance: empezar con un centro (Cocina Central) y dejar el modelo preparado con `ubicacion_id`

### 11.4 Panel con alertas de verdad

```
🏠 PANEL COCINA
├── 🔴 Cámaras sin registrar hoy          (fridge_temperature_log fecha=hoY)
├── 🔴 Fecha límite de pedido mañana      (evento − prep_days − lead_time)
├── 🟠 Lotes caducando en 7 días          (stock_lots.expiry_date)
├── 🟠 OCs enviadas/confirmadas sin recibir (supplier_orders.status)
├── 🟠 Hojas de producción sin generar    (eventos próximos sin hoja)
└── ✅ Resumen del día: eventos, pax, producciones
```

### 11.5 UX para trabajo real (tablet, guantes, sin cobertura)

- Formularios APPCC de **dos toques** (botón grande, mínimo de campos, controles rápidos)
- **Tolerancia offline**: los registros se guardan en local (localStorage/IndexedDB) y se sincronizan al volver la cobertura
- Diseño compacto existente (text-[10px]) se mantiene para gestión; los formularios de campo pueden ser más grandes en la vista de tablet

---

## 12. Bugs a corregir (verificados en prod)

| Bug | Archivo | Línea | Fix |
|---|---|---|---|
| `event/production` 500 | `src/lib/cocinaSheets.ts` | 181 | `esi.category` no existe → derivar de catalog_items o quitar |
| `event/logistics` 500 | `src/lib/cocinaSheets.ts` | 181 | idem |
| `event/service-sheet` 500 | `src/lib/cocinaSheets.ts` | — | idem |
| `guia/[eventId]` 500 | `src/lib/cocinaGuia.ts` | 84 | `COALESCE(service_type,'menu')` → events no tiene service_type; usar venue_type o eliminar |
| `kitchen_zones` vacía | migración | — | seed de 9 zonas |
| Páginas Producción/Carga/Logística sin contenido | varias | — | dependen de timeline/zonas/hojas vacías |

---

## 13. Plan de fases (con la priorización del usuario)

### Fase 1 — Estabilizar (sin romper nada)
1. Fix 4 bugs de 500 (cocinaSheets, cocinaGuia)
2. Seed kitchen_zones
3. Smoke test de TODAS las rutas de cocina → 200
4. Tests de regresión verdes

### Fase 2 — El modelo monetario/stock (CRÍTICO primero, según revisión)
1. **Consumo de stock** por lote FIFO/FEFO al cerrar producción (revisar `stockDeduct.ts`)
2. **Cierre de evento en dos etapas**: cierre OPERATIVO al terminar el servicio (vuelta retornado/desechado + food cost real vs teórico + desviación) y cierre CONTABLE solo al cobrar (OPC-5). Ya existe la máquina de estados; falta FIFO/FEFO y la vuelta.
3. **Datos maestros proveedor×ingrediente** (precio, unidad compra, factor, pedido mínimo, lead time)
4. **Fecha límite de pedido** (evento − prep_days − lead) en el panel
5. **Regularizaciones de inventario** (recuento/rotura/merma/caducado)

### Fase 3 — Compras HITL
1. `GET disponibilidad` en escandallo (informativo)
2. `POST necesidades` + `POST propuesta-oc` (redondeo a unidad compra, proveedor preferente)
3. Transiciones: enviar → [confirmar*] → recibir (+ cancelar) con el enum nuevo
4. Recepción: parcial/backorder, rechazo en muelle, diferencias, APPCC (lote + albarán + temperatura)
5. Compra directa sin OC

### Fase 4 — Recetas ampliadas
1. Sub-recetas (elaboraciones intermedias)
2. Alérgenos derivados (14 de 1169/2011) + variantes
3. Merma por ingrediente (rendimiento)
4. Versionado + foto + vida útil + escalado no lineal

### Fase 5 — Producción
1. Fix hoja de producción (generar desde escandallo, enganchar APPCC en tareas)
2. Producción agregada multi-evento + etiquetado de elaboraciones
3. Timing con capacidad real + zonas + checklist con progreso

### Fase 6 — Carga y Logística + transporte APPCC
1. Generar hoja de carga desde producción (pases + vajilla + packs + retornables)
2. Logística ida/vuelta + alquileres + consumibles + roturas
3. **Transporte APPCC** (RD 3484/2000): salida/llegada, isotermo, conductor

### Fase 7 — APPCC completo
1. Elaboración ampliada: descongelación, enfriamiento, conservación en caliente
2. **Prerrequisitos del plan** (plagas, agua, formación, homologación, mantenimiento, residuos, verificación)
3. Muestras testigo + trazabilidad hacia adelante (retirada)
4. Exportación PDF por rango + retención definida

### Fase 8 — Transversal
1. Roles/permisos por acción + auditoría
2. Multi-centro (modelo preparado, un centro activo)
3. Panel de alertas reales
4. UX tablet/offline (dos toques + sincronización)

---

## 14. Fuera de alcance (se verá después)
- **Menús**: configuración de menús a partir de los platos (cuando cocina esté cerrada — decisión del usuario)
- Integración de hardware de termómetros (entrada manual de datos ahora)
- Cierre económico completo (facturación/cobros) — se aborda con el módulo de finanzas
- Módulos CRM/Logística/Stock generales se estabilizan con el mismo patrón anti-regresión, pero cocina es la prioridad
