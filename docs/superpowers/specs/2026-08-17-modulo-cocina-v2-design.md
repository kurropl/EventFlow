# EventFlow — Diseño del Módulo Cocina (v2)

> **Fecha:** 2026-08-17
> **Estado:** Diseño aprobado por usuario (Secciones 1-3)
> **Principio rector:** El usuario trabaja por **flujo natural de trabajo**, no por fases legales. APPCC se organiza como "recorrido del alimento" (de la nevera al plato).
> **Decisión clave del usuario:** Escandallo es INFORMATIVO de faltantes; Stock/Compras es donde se compra con human-in-the-loop.

---

## 1. Visión general — El flujo completo de cocina

```
RECETA → ESCANDALLO → [FALTANTE?] → STOCK/COMPRAS (HITL) → RECEPCIÓN (APPCC)
   │          │              │              │                     │
   │          │              │              └─ enviado → confirmado
   │          │              └─ aviso informativo                → recibido
   │          │                                                  
   │          ▼                                                
   └── PRODUCCIÓN (hojas: quién hace qué, cuándo)
          │
          ▼
       CARGA (qué se lleva: pases + vajilla + packs)
          │
          ▼
       LOGÍSTICA (material reutilizable: ida/vuelta)
          │
          ▼
       APPCC (recorrido del alimento: recepción → almacén → elaboración → servicio)
```

**Regla de oro:** cada plato tiene ficha técnica (receta). Cada evento necesita ingredientes (escandallo). Si falta stock → se compra con aprobación humana. Todo lo que se cocina queda registrado en producción y trazabilidad.

---

## 2. Navegación del módulo Cocina (7 secciones)

```
Cocina:
├── 🏠 Panel          — resumen del día: eventos, producciones pendientes, alertas stock
├── 📖 Recetas        — fichas técnicas + pasos de elaboración (cómo se hace cada plato)
├── 💰 Escandallos    — receta × pax = necesidades + AVISO informativo de faltantes
├── 🍳 Producción     — hojas de producción: timing, zonas, checklist de tareas
├── 🚚 Carga          — qué se lleva: comida por pases + vajilla + packs
├── 📦 Stock/Compras  — inventario + propuestas de OC por proveedor + HITL
└── 🛡 APPCC          — seguridad alimentaria (recorrido del alimento)
```

---

## 3. 📖 RECETAS — Fichas técnicas + elaboración

### Qué es
La definición del plato: ingredientes por ración, coste, alérgenos, y **cómo se elabora** (pasos, tiempo, anticipación).

### Estado actual (verificado en prod)
- `recipes` ya tiene: name, category, servings, ingredients, instructions, prep_time, cook_time, difficulty, cost_per_serving, merma_pct, allergens, **preparation_steps, prep_days_before, estimated_time_minutes** (los 3 campos de la reestructuración YA existen en la tabla)
- `recipe_ingredients`: cantidad, unit, per_guest, cost por ingrediente

### Qué hay que completar
1. **UI de elaboración** en la ficha de receta: ver/editar `preparation_steps` (jsonb: `[{action, detail, time_min}]`), `prep_days_before`, `estimated_time_minutes` — los campos existen en BD pero puede que no haya UI.
2. **Pasar receta a producción**: botón "Usar en producción" que crea las tareas en la hoja de producción a partir de los pasos de elaboración (los pasos → tareas, con el día de anticipación).

### Datos (sin cambios de esquema)
```sql
recipes.preparation_steps jsonb  -- [{"action":"Cortar","detail":"Bastones 5mm","time_min":15}]
recipes.prep_days_before int     -- 2 = empezar 2 días antes
recipes.estimated_time_minutes int
```

---

## 4. 💰 ESCANDALLOS — Necesidades + aviso informativo de faltantes

### Qué es
Receta × pax del evento = cantidades totales de cada ingrediente. **FROZEN** (no se toca la lógica existente).

### Nuevo (informativo, NO accionable aquí)
Al ver el escandallo de un evento, añadir un panel **"Disponibilidad de stock"** que:
- Compara las necesidades totales del escandallo (por ingrediente) contra el stock actual (`ingredients.quantity`)
- Muestra: `✅ Suficiente` / `⚠️ Faltan X g de [ingrediente]`
- Es **solo lectura informativa** — el botón de comprar NO está aquí, está en Stock/Compras

### Datos
- Necesidades: de `escandallo_lines` (cantidad por ingrediente) o de `event_shopping_items` (teórico)
- Stock: `ingredients.quantity`
- Compromisos de otros eventos: `inventory_commitments` (para no duplicar el mismo stock)

### Contrato API (nuevo)
```
GET /api/cocina/escandallos/[escandalloId]/disponibilidad
→ { success, data: [ { ingredient_id, nombre, unidad, necesario, stock, comprometido, disponible, faltante } ] }
```

---

## 5. 📦 STOCK/COMPRAS — Compra con human-in-the-loop

### Qué es
El corazón de tu visión: **se detecta necesidad → se propone OC por proveedor → el humano revisa línea a línea → se envía → el proveedor confirma → se recibe → APPCC automatizado**.

### Ciclo de vida de la OC (4 estados + cancelado)
```
necesidad → enviado → confirmado → recibido
```

| Estado | Significado | Quién marca | Acción |
|---|---|---|---|
| `necesidad` | Faltante detectado (escandallo vs stock) | Sistema | Crea propuesta agrupada por proveedor |
| `enviado` | Se hizo el pedido al proveedor | Humano | "Enviar pedido" (tras revisar líneas) |
| `confirmado` | El proveedor confirmó el pedido | Humano | "Proveedor confirma" |
| `recibido` | Llegó la mercancía → flujo APPCC | Humano | "Recibir" |
| `cancelado` | Anulada (con motivo) | Humano | "Cancelar" |

**Mapeo con el esquema existente de `supplier_orders.status`** (para NO romper lo que ya hay):
```
pending   → propuesta/borrador (nueva, antes de enviar)
enviado   → 'ordered'     (pedido hecho al proveedor)
confirmado → 'delivered'   (el proveedor confirmó el pedido)
recibido  → 'received'    (mercancía recibida, stock actualizado)
cancelado → 'cancelled'
```
Es decir: en la UI se muestran los 5 estados legibles (`necesidad/enviado/confirmado/recibido/cancelado`), pero en BD se mapean a los valores existentes. El estado `pending` de BD pasa a significar "propuesta sin enviar" (el nuevo `necesidad`).

### Human-in-the-loop (revisión línea a línea)
1. **Generar propuesta**: desde Stock/Compras, eliges evento (o stock bajo general) → el sistema calcula faltantes → agrupa por proveedor
2. **Revisar**: el humano puede **quitar líneas**, **ajustar cantidades**, **cambiar proveedor** (si hay varios)
3. **Enviar**: al pulsar "Enviar pedido" la propuesta pasa a `enviado` (queda formalizada)
4. Historial de decisiones: quién ajustó qué, cuándo

### Recepción con APPCC automatizado
Al pulsar "Recibir" en una OC `confirmado`:
- **Escaneo de lotes** (BarcodeScanner existente) → crea `stock_lots`
- **Foto de albarán** (upload existente) → `provider_invoices.proof_url` o campo de la OC
- **Temperatura de recepción** (termómetro, entrada manual o datos de dispositivo) → `appcc_controles` (tipo_control='recepcion')
- Actualiza stock: `ingredients.quantity` += recibido
- Marca `inventory_commitments` como cubierto si era por evento

### Estado actual (verificado en prod)
- `supplier_orders`: (id, supplier, status, total_cost, notes, expected_date, delivered_date, event_id, origin) — status: pending/ordered/delivered/received/cancelled
- `supplier_order_items`: (order_id, ingredient_id, ingredient_name, quantity, unit_cost, unit)
- `auto-orders` YA existe: escanea stock bajo y crea OCs (pero SIN HITL formal y sin vincular al escandallo de evento)
- Falta: el flujo HITL (revisar líneas antes de enviar) y el vínculo con el escandallo del evento. Los estados en BD ya cubren el ciclo (ver mapeo arriba).

### Contrato API (nuevo/ampliado)
```
POST /api/stock/necesidades        — calcula faltantes de un evento (vs stock + compromisos)
POST /api/stock/propuesta-oc       — genera propuestas por proveedor (revisable)
PUT  /api/stock/supplier-orders/[id]/enviar       — necesidad → enviado
PUT  /api/stock/supplier-orders/[id]/confirmar    — enviado → confirmado
PUT  /api/stock/supplier-orders/[id]/recibir      — confirmado → recibido (dispara APPCC)
PUT  /api/stock/supplier-orders/[id]/cancelar     — → cancelado
```

---

## 6. 🍳 PRODUCCIÓN — Hojas de producción (quién hace qué, cuándo)

### Qué es
Planificar el día D: qué se cocina, quién lo hace, en qué zona, a qué hora, y el avance.

### Estado actual (verificado en prod)
- `hojas_produccion`: (event_id, escandallo_id, fecha, turno, status, pax, notas)
- `tareas_produccion`: (hoja_id, plato_name, catalog_item_id, ingrediente, cantidad, unit, pase, asignado_a, notas, completado, orden)
- `event_timeline`: (event_id, phase, concepto, planned_time, actual_time, duration_minutes, notes, orden)
- `kitchen_zones`: (nombre, icon, orden) — **VACÍA en prod** (falta el seed de 9 zonas)
- API `/api/cocina/event/[id]/production` → **500** (`esi.category` no existe)

### Qué hay que completar
1. **Fix bug**: `cocinaSheets.ts:181` → `esi.category` no existe en event_shopping_items. Sustituir por el campo real o derivar de `catalog_items.category`.
2. **Seed kitchen_zones** (9 zonas): aperitivos, frío, caliente, frito, entrante, primero, segundo, postre, recena.
3. **Generar hoja de producción desde el escandallo**: cada plato del escandallo → tareas (mín. "preparar [plato]", n=platos) con pase/orden, asignable a personal.
4. **Vista por evento**: timing (timeline), distribución por zona (staffing_lines.kitchen_zone), checklist de tareas con progreso %.
5. **Zonas en staffing**: `staffing_lines.kitchen_zone` para asignar personal a zona.

### Datos
```sql
-- ya existen; falta seed:
INSERT INTO kitchen_zones (nombre, icon, orden) VALUES
('aperitivos','🥗',1),('frio','❄️',2),('caliente','🔥',3),('frito','🍟',4),
('entrante','🍽',5),('primero','🥘',6),('segundo','🥩',7),('postre','🍰',8),('recena','🌙',9);
-- (usar iconos Phosphor, no emojis, en UI)
```

---

## 7. 🚚 CARGA — Qué se lleva al evento

### Qué es
Preparar el camión: comida por pases + vajilla/loza + packs especiales + material.

### Estado actual (verificado en prod)
- `hojas_carga`: (event_id, escandallo_id, fecha, status, notas)
- `items_carga`: (hoja_carga_id, tipo, nombre, cantidad, unit, cargado, retornado, notas, orden)
- `tableware_items`, `event_tableware`, `pack_templates`, `event_packs` — tablas existen
- API `/api/cocina/event/[id]/loading` → **200** ✅

### Qué hay que completar
1. **Generar hoja de carga desde producción**: los platos del evento → ítems de comida (por pase), y sugerir vajilla (platos/cubiertos/copas = pax).
2. **Vajilla con stock**: `tableware_items` con stock_total/disponible; la carga verifica disponibilidad.
3. **Packs**: aplicar `pack_templates` al evento → `event_packs` con cantidades; checklist en la carga.
4. **Cocina vs Operaciones**: separar el material de cocina (🍳) del de servicio/operaciones (🍷) en la hoja de carga — decisión previa del usuario.

---

## 8. 📦 LOGÍSTICA — Material reutilizable (ida/vuelta)

### Qué es
Controlar el equipamiento que sale al evento y vuelve (vajilla, menaje, electrodomésticos).

### Estado actual
- API `/api/cocina/event/[id]/logistics` → **500** (`esi.category`)
- Tablas: `equipment`, `event_equipment_checkout` (quantity_sent/returned), `items_logistica`

### Qué hay que completar
1. **Fix bug** (mismo `esi.category`)
2. **Control ida/vuelta**: por evento, qué equipamiento sale (`checked_out_at`) y qué vuelve (`returned_at`, cantidad)
3. **Stock de equipamiento**: integrado aquí (no sección separada)

---

## 9. 🛡 APPCC — Recorrido del alimento (organización senior)

### Normativa de referencia
RD 109/2010 (España, transposición del Reglamento CE 852/2004) + RD 178/2002 (trazabilidad).

### Organización: 5 pestañas por flujo físico del alimento

```
🛡 APPCC
├── 1. RECEPCIÓN       — proveedor, producto, temperatura, lote (escaneo), albarán (foto)
├── 2. ALMACÉN         — cámaras mañana/tarde, excedencias de temperatura
├── 3. ELABORACIÓN     — descongelación, cocción (74/70/65°C), enfriamiento <2h, conservación ≥65°C
├── 4. SERVICIO & LIMPIEZA — buffet caliente ≥65 / frío ≤8, limpieza por zonas
└── 5. INCIDENCIAS & ACEITE — registro + acciones correctivas, aceite ≤25% polares
```

### Controles obligatorios cubiertos (checklist legal)

| Fase | Control | Límite | Estado |
|---|---|---|---|
| Recepción | Temperatura producto | según tipo | ✅ existe (reforzar escaneo lote) |
| Recepción | Embalaje, caducidad, etiquetado | — | ✅ existe |
| Almacén | Cámaras 2×/día | Frigo ≤4°C, Cong ≤−18°C | ✅ existe |
| Almacén | Excedencias | registro | ✅ existe |
| **Descongelación** | Controlada en cámara | nunca TA | 🔴 **NUEVO** |
| Elaboración | Cocción centro producto | aves ≥74, picados ≥70, resto ≥65°C | ✅ existe (semáforo a refinar) |
| **Enfriamiento rápido** | 65→10°C en <2h | <2h | 🔴 **NUEVO** |
| **Conservación caliente** | plato a servicio | ≥65°C | 🔴 **NUEVO** |
| Servicio | Buffet caliente / frío | ≥65 / ≤8°C | ✅ existe |
| Aceite | Compuestos polares | ≤25% | ✅ existe |
| Limpieza | Plan por zonas | — | ✅ existe |
| Incidencias | Registro + acción correctiva | — | ✅ existe |
| Trazabilidad | Lotes, proveedor, albarán | RD 178/2002 | ✅ existe (stock_lots) |

### Modelo de datos
- `appcc_controles`: (evento_id, tipo_control, valor, unidad, limite_inferior, limite_superior, cumple, responsable, fecha_hora) — **tabla generalista YA existe**, perfecta para los nuevos controles (descongelación, enfriamiento, conservación)
- `fridge_temperature_log`: (event_id, fridge_name, fridge_type, temperature, target_min, target_max, status, recorded_by) — para cámaras
- `haccp_monitoring` + `haccp_critical_limits`: para los límites críticos (cocción por tipo de alimento)
- Nuevo (si aplica): `appcc_descongelacion` o reutilizar `appcc_controles` con tipo_control='descongelacion'

### Automatización (lo que pediste)
- **Escaneo de lotes** → BarcodeScanner existente → stock_lots ✅
- **Foto de albarán** → upload existente ✅
- **Termómetro WiFi/BT** → entrada de datos en el formulario (los datos se capturan como valor; la integración con el dispositivo físico queda como campo de entrada — no hay hardware conectado)

### Guardado
Por **work center** (Cocina Central) — no por evento — salvo controles específicos de evento (servicio, elaboración de un evento concreto).

---

## 10. Bugs a corregir (verificados en prod — los que rompen el área)

| Bug | Archivo | Línea | Fix |
|---|---|---|---|
| `event/production` 500 | `src/lib/cocinaSheets.ts` | 181 | `esi.category` no existe → derivar de catalog_items o quitar |
| `event/logistics` 500 | `src/lib/cocinaSheets.ts` | 181 | idem |
| `event/service-sheet` 500 | `src/lib/cocinaSheets.ts` | — | idem |
| `guia/[eventId]` 500 | `src/lib/cocinaGuia.ts` | 84 | `COALESCE(service_type,'menu')` → events no tiene service_type; usar venue_type o eliminar |
| `kitchen_zones` vacía | migración | — | seed de 9 zonas |
| Páginas Producción/Carga/Logística sin contenido | varias | — | dependen de timeline/zonas/hojas vacías |

---

## 11. Plan de fases

### Fase 1 — Estabilizar (sin romper nada)
1. Fix 4 bugs de 500 (cocinaSheets, cocinaGuia)
2. Seed kitchen_zones
3. Smoke test de TODAS las rutas de cocina → 200
4. Tests de regresión existentes verdes

### Fase 2 — Stock/Compras con HITL (el flujo que te importa)
1. `GET disponibilidad` en escandallo (informativo)
2. `POST necesidades` + `POST propuesta-oc` (agrupar por proveedor, líneas ajustables)
3. Transiciones: enviar → confirmar → recibir (+ cancelar)
4. Recepción APPCC: escaneo lote + foto albarán + temperatura → stock

### Fase 3 — Producción
1. Fix hoja de producción (generar desde escandallo)
2. Timing + zonas + checklist con progreso
3. Vista semanal

### Fase 4 — Carga y Logística
1. Generar hoja de carga desde producción (pases + vajilla + packs, cocina vs operaciones)
2. Logística ida/vuelta con stock de equipamiento

### Fase 5 — APPCC completo
1. Nueva pestaña Elaboración ampliada: descongelación, enfriamiento, conservación en caliente
2. Semáforos por límites legales
3. Persistencia por work center

---

## 12. Fuera de alcance (se verá después)
- **Menús**: configuración de menús a partir de los platos (se aborda cuando cocina esté cerrada — decisión del usuario)
- Integración de hardware de termómetros (se deja como entrada manual de datos)
- Los módulos CRM/Logística/Stock generales se estabilizan igual (mismo patrón anti-regresión) pero cocina es la prioridad
