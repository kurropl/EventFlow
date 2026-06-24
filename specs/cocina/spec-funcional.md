# EventFlow — Especificación funcional para spec-kit
### Ajustes sobre lo existente + nuevo módulo **Cocina & Catering**

> Base analizada: `github.com/kurropl/EventFlow` (Next.js + TypeScript + Postgres/Supabase, Docker/Caddy).
> Fuentes de requisitos: notas de reunión cocina (Benítez/Alboroto) + nota manuscrita del flujo de datos + referencia [oidotipi.com](https://oidotipi.com) (captura por voz/escáner para escandallos y APPCC).

---

## 0. Resumen ejecutivo

EventFlow ya cubre buena parte del ciclo comercial y operativo (catálogo, presupuestos, eventos, escandallos básicos, stock, staffing, proveedores, mapa de mesas, billing, automatizaciones). El trabajo se divide en cuatro bloques:

1. **AJUSTES** sobre módulos existentes para alinearlos con las reglas de negocio reales de las notas (estados de presupuesto, ratios de camareros, firma de pagos, deuda de proveedores, gastos previos, ubicación, memo/briefing).
2. **MÓDULO COCINA & CATERING (nuevo)**: gestión completa del escandallo como fuente de verdad, del que derivan producción, carga, logística y APPCC, con actualización continua de costes (patrón Tipi).
3. **RBAC — Roles y visualización de módulos (nuevo, transversal)**: control de acceso por perfil (administración, cocina, camareros, clientes) que filtra qué módulos ve cada usuario.
4. **SANEAMIENTO DE CÁLCULOS, UNIDADES Y RELACIONES (transversal, crítico)**: corregir la lógica de totales/parciales, la normalización de unidades y las relaciones entre entidades, hoy deficientes.

> **Nota de prioridad**: los bloques 3 y 4 son transversales y condicionan al resto. El bloque 4 en concreto debe ir **antes** de construir las hojas de cocina (producción/carga/logística), porque esas hojas derivan del escandallo y hoy el escandallo calcula mal.

---

## 1. Estado actual del repositorio (lo que YA existe)

| Área | Implementado | Tablas / rutas relevantes |
|---|---|---|
| Catálogo de platos | ✅ 10 categorías, PVP/coste, margen, activo | `catalog_items`, `/api/catalog` |
| Presupuestos | ✅ estados `draft/sent/accepted/rejected/expired` | `quotes`, `/api/quotes` |
| Eventos | ✅ estados `nuevo/propuesta_enviada/confirmado/cancelado/en_curso/completado` | `events`, `/api/events`, `transitions` |
| Escandallo básico | ✅ auto-generado al aceptar, edición inline, agrupación por proveedor, stock check | `recipe_items`, `ingredients`, `event_shopping_items`, `/api/stock/escandallos` |
| Recetas / ingredientes | ✅ CRUD, coste por unidad, historial de precios | `recipe_items`, `ingredients`, `/api/stock/price-history` |
| Stock | ✅ cantidades, min_stock, deduct, auto-orders | `/api/stock/*` |
| Pedidos a proveedor | ✅ generación de orden | `/api/stock/supplier-orders`, `generate-order` |
| Staffing | ✅ líneas, ofertas, asignaciones, pago, nóminas, WhatsApp | `staffing_lines/offers/assignments`, `workers`, `/api/staffing/*` |
| Proveedores | ✅ CRUD básico | `providers`, `/api/providers` |
| Mapa de mesas | ✅ editor + plano + HTML render | `floor_plans`, `tables`, `/api/floor-plan`, `/api/mapa-mesas` |
| Billing / cobros | ✅ facturas y pagos | `invoices`, `payments` |
| Automatizaciones | ✅ reglas + crons (recordatorios pre/post evento) | `automation_rules`, `/api/cron/*` |
| Generación de operaciones | ✅ al aceptar: invitados, mesas, staff, escandallo | `/api/generate-operations` |

> Nota: existen ya `ODOO_ESCANDALLOS_ANALYSIS.md` y `ODOO_GAP_ANALYSIS.md` en el repo con el benchmark contra Odoo BoM/MRP. El módulo Cocina aquí definido es la materialización de ese gap analysis.

---

## 2. AJUSTES sobre lo existente

Cada ajuste lleva el cambio concreto detectado en el código actual.

### FR-A01 · Estados de presupuesto (workflow)
- **Hoy**: `quotes.status = draft/sent/accepted/rejected/expired`; `events.status = nuevo/propuesta_enviada/...`. Dos máquinas de estado paralelas y desalineadas con el negocio.
- **Pedido**: workflow único de 4 fases visibles → **borrador → 1º contacto → aceptado → realizado**.
  - "1º contacto" = reunión de toma de contacto y ajuste de menú (sustituye/mapea `sent`/`propuesta_enviada`).
- **Cambio**: redefinir el `CHECK` de `quotes.status` a `('borrador','contacto','aceptado','realizado','rechazado')` y mapear las transiciones de evento a este pipeline. Conservar `rechazado` por trazabilidad.
- **Criterio de aceptación**: el Kanban de presupuestos muestra exactamente esas 4 columnas activas + descartados.

### FR-A02 · Borrador: ocultar unidades
- **Pedido**: en estado **borrador**, en el presupuesto solo son editables **precio final** y **número de comensales**. Las unidades/desglose por línea quedan ocultos.
- **Cambio**: condicionar el render del desglose (`cost_desglose`) al estado; en borrador mostrar solo total + pax.

### FR-A03 · Cancelar presupuesto con motivo
- **Pedido**: cancelar un presupuesto exige **indicar motivo**.
- **Cambio**: añadir `cancel_reason TEXT` a `quotes`; bloquear transición a cancelado sin motivo.

### FR-A04 · Ocultar "cancelar" en aceptado
- **Pedido**: en presupuesto **aceptado**, no mostrar el botón cancelar.
- **Cambio**: lógica de UI por estado (si `aceptado` → sin acción cancelar; usar flujo de incidencia/realizado).

### FR-A05 · Ratios de camareros (reparto)
- **Hoy**: `generate-operations` codifica `waiters_suggested = ceil(guest/15)` fijo, sin distinguir tipo de servicio.
- **Pedido**:
  - **Cóctel**: 1 camarero / 12 comensales → `ceil(pax/12)`.
  - **Menú (sentado)**: 1 / 10 **+ un refuerzo por cada 25** → `ceil(pax/10) + floor(pax/25)`.
- **Cambio**: parametrizar el cálculo según `service_type` del evento (cóctel | menú). Mover los ratios a `settings` para que sean editables sin tocar código.
- **Criterio**: 120 pax menú → `ceil(120/10)=12 + floor(120/25)=4` = **16**; 120 pax cóctel → `ceil(120/12)` = **10**.

### FR-A06 · Gastos varios previos en presupuesto
- **Pedido**: incluir **gastos previos** (gasolina, desplazamientos, compras puntuales) como línea del presupuesto.
- **Cambio**: el `line_type` de `cost_desglose` ya admite `extras`; añadir subtipo/concepto "gastos previos" y asegurarse de que suma al total.

### FR-A07 · Ubicación del evento (Alboroto)
- **Pedido**: para Alboroto, incluir **dónde es el evento** (no siempre Salones Benítez).
- **Cambio**: añadir `location TEXT` / `venue_type ('benitez'|'externo')` a `events`. Si externo → habilita carga de PDF + sitting (ver FR-A11).

### FR-A08 · Menú: seleccionado vs sugerencias
- **Pedido**: distinguir entre **menú seleccionado** y **extra / sugerencias adicionales**.
- **Cambio**: marcar `event_menu_items` con `kind ('seleccionado'|'sugerencia')`. Las sugerencias no computan en coste base salvo confirmación.

### FR-A09 · Firma tras pago de nómina
- **Hoy**: `payments` no tiene campo de firma ni justificante.
- **Pedido**: en pagos de nómina, **firma tras el pago**; pago **total por camarero/empleado**.
- **Cambio**: añadir `signature_url`, `signed_at`, `signed_by` a la tabla de pagos de staffing; el pago se cierra como "total por trabajador".

### FR-A10 · Proveedores: debe, vencimientos, justificantes
- **Hoy**: `providers` solo CRUD básico; no hay deuda ni vencimientos.
- **Pedido**: controlar **debe**, **fechas de pago**, **justificantes** y gestión de cobros.
- **Cambio**: nueva tabla `provider_invoices` (provider_id, amount, due_date, status `pendiente|pagado|vencido`, proof_url). Vista de "cuentas a pagar".

### FR-A11 · Mapa interactivo / sitting externo
- **Hoy**: existe editor de mesas y plano para Salones Benítez.
- **Pedido**: si **no** es Benítez → subir **PDF** del sitio y generar vista **3D / 360º** + sitting sobre ese plano.
- **Cambio**: en venue externo, permitir upload de PDF como capa base del editor de mesas. (El 3D/360 se marca como opcional — ver clarificaciones.)

### FR-A12 · Briefing y memo a camareros
- **Pedido**:
  - **Aviso de briefing** del evento a todos los camareros por **email o WhatsApp**.
  - **Memo** por trabajador (datos personales, menú, intolerancias, mantelería, protocolo, anotaciones, barra libre) → enviar **la noche antes** por WhatsApp/email.
- **Cambio**: ya existe `whatsapp-staffing` y crons; añadir plantilla "memo" generada desde el evento y cron `pre-event-briefing` (T-1 día). El memo se compone con datos del evento + asignación del trabajador.

---

## 3. MÓDULO NUEVO · Cocina & Catering

El escandallo es la **fuente de verdad**. De él se derivan compras, producción, carga, logística y trazabilidad sanitaria. Lo existente (`recipe_items`, `event_shopping_items`) es la base mínima; este módulo lo eleva al nivel de un BoM/MRP de catering con coste real y versionado.

### 3.1 Flujo de datos (de la nota manuscrita)

```
BASE DE DATOS ─→ ESCANDALLO ─┬─→ Inventario ─→ Pedidos ─→ Recibido
                             ├─→ Hoja de Producción      (previa al evento)
                             ├─→ Hoja de Carga           (día del evento; por pase y unidades)
                             └─→ Hoja Logística          (material seco + equipamiento)
ESCANDALLO = receta teórica  ──vs──  receta real (consumo registrado)
```

### FR-C01 · Escandallo como entidad versionada (teórico vs real)
- El escandallo de un plato/evento tiene **versión** y dos vistas: **teórico** (receta estándar) y **real** (consumo registrado el día del evento).
- **Modelo**: `escandallo (id, scope ['plato'|'evento'], ref_id, version, status ['borrador'|'activo'|'cerrado'])` + `escandallo_lines (escandallo_id, ingredient_id, qty_teorica, qty_real, unit, cost_unit_snapshot)`.
- **Criterio**: al cerrar un evento se congela el escandallo real y se calcula desviación teórico↔real.

### FR-C02 · Escala por comensales
- Cantidades del escandallo escalan por `pax` del evento (y por tipo de servicio).
- **Criterio**: cambiar pax recalcula todas las líneas y el coste total.

### FR-C03 · Coste estimado vs coste real
- **Estimado**: Σ(qty_teorica × coste_ingrediente actual).
- **Real**: Σ(qty_real × coste al momento) + gastos previos (FR-A06).
- Mostrar **desviación** por evento y media histórica por plato (patrón Odoo MO cost).

### FR-C04 · Actualización continua de escandallos *(clave para futuro)*
- Cuando cambia el **coste de un ingrediente** (compra a proveedor a otro precio), debe:
  1. registrarse en `price-history` (ya existe la ruta),
  2. **recalcular** el coste estimado de todos los escandallos teóricos que lo usan,
  3. avisar si algún plato cae por debajo de margen mínimo.
- Entrada de actualización inspirada en **Tipi (oidotipi.com)**: registro **por voz/escáner** de precios, mermas y consumos sin teclear. Dejar la arquitectura preparada para un endpoint de ingesta (voz→texto→línea de escandallo).
- **Criterio**: subir un albarán/escáner actualiza precios de ingredientes y propaga a escandallos en una sola operación.

### FR-C05 · Hoja de Producción (previa al evento)
- Generada desde el escandallo: qué se cocina, cantidades por plato, agrupado por partida/pase.
- Imprimible / exportable (PDF).

### FR-C06 · Hoja de Carga de comida (día del evento)
- Generada el mismo día para **cargar la furgoneta**.
- **Divide cada plato por pase y por unidades** → requiere modelar `service_round` (pase) en el menú del evento.
- **Cambio de modelo**: añadir concepto **pase** (`pase` / `service_round`) a `event_menu_items` para poder agrupar la carga por momento de servicio.

### FR-C07 · Hoja Logística (material + seco)
- Lista de **equipamiento** (freidora, bandejas, platos, papel absorbente) y **producto seco** (harina, aceite) necesarios.
- Sale del escandallo + catálogo de material reutilizable.
- **Modelo**: `material_items` (no perecederos / equipamiento) separados de `ingredients` (perecederos), o flag `is_equipment`/`is_dry` en ingredientes. La hoja logística filtra por ese flag.

### FR-C08 · APPCC / Trazabilidad sanitaria
- **Escáner** que registre automáticamente **fecha de entrada, lotes** y datos sanitarios de cada recepción de mercancía.
- **Modelo**: `appcc_records (ingredient_id, lote, fecha_entrada, proveedor, temperatura?, caducidad?, scan_source)`.
- Vincular lote → escandallo real para trazabilidad completa "del lote al plato servido".
- **Criterio**: dado un evento, listar todos los lotes consumidos (requisito de inspección sanitaria).

### FR-C09 · Inventario ↔ Recibido (cierre del círculo)
- Pedido a proveedor → recepción (escaneo APPCC) → entrada en inventario → consumo por escandallo real → desviación.
- **Criterio**: el stock se actualiza solo al marcar "recibido" desde el escaneo APPCC (no manualmente).

### FR-C10 · Importar recetas (Excel / en la app) → desglose de componentes
- **Estado actual**: no existe ninguna importación de Excel/CSV en el repo. La estructura `recipe_items` (`catalog_item_id → ingredient_id → quantity`) ya es exactamente el desglose destino; falta la vía de carga.
- **Pedido**: poder dar de alta el desglose de componentes de una receta de dos formas, para alimentar el escandallo de cada plato:
  1. **Subida desde Excel/CSV**: el chef sube una plantilla con las recetas y sus ingredientes; el sistema crea/actualiza `recipe_items`.
  2. **En la aplicación**: editor de receta paso a paso (añadir ingrediente, cantidad, unidad, notas) — ya existe edición parcial en `StockManager`, formalizarla.
- **Plantilla Excel propuesta** (una fila por componente):
  `plato | categoría | ingrediente | cantidad | unidad | merma_% | notas`
  - `plato` agrupa filas en un `catalog_item`; `ingrediente` se resuelve contra `ingredients` por nombre (crea si no existe, respetando FR-S05: una sola entidad ingrediente).
  - `unidad` se valida y convierte a unidad base (FR-S01); cantidades fraccionables (FR-S04).
- **Flujo de import**:
  1. Subir archivo → **previsualización** con validación (ingredientes nuevos resaltados, unidades no reconocidas, duplicados).
  2. Resolución de conflictos (mapear "harina trigo" ↔ "Harina de trigo" existente).
  3. Confirmar → upsert de `catalog_items` + `recipe_items`; recálculo de coste vía `costing.ts` (FR-S03).
- **Resultado**: cada receta importada queda con su desglose y su **coste automático** (Σ ingrediente × coste actual), lista para generar el escandallo del evento al escalar por pax.
- **Implementación**: SheetJS (`xlsx`) para parsear; endpoint `POST /api/recipes/import` (preview + commit en dos pasos). Exportar también la plantilla vacía desde la app para que el chef la rellene.
- **Criterio de aceptación**: subir un Excel con N platos crea N `catalog_items` con sus `recipe_items` correctamente desglosados, con unidades normalizadas y coste calculado; las filas con errores se reportan sin abortar el resto.

> **Sinergia con Tipi (FR-C04)**: el import por Excel es la vía "en lote/fría"; la captura por voz/escáner es la vía "en caliente". Ambas alimentan la misma estructura `recipe_items`/`escandallo_lines`.

---

## 3bis. MÓDULO NUEVO · Roles y visualización de módulos (RBAC)

**Estado actual**: `admins.role` existe como **texto libre con default `'admin'`** y **no se usa para autorizar** nada — todos los usuarios autenticados ven todo. Los roles de `workers` (`camarero`, `cocinero`, `maitre`…) son solo para staffing, no para acceso. **No hay RBAC real.**

### FR-R01 · Perfiles de acceso
- Definir 4 perfiles que controlan qué módulos se ven y con qué permisos:
  - **Administración**: acceso total (presupuestos, clientes, cocina, staffing, billing, proveedores, config, roles).
  - **Gestión cocina**: escandallos, recetas, stock, producción, carga, logística, APPCC, proveedores (solo lectura de pedidos). Sin acceso a billing ni clientes comerciales.
  - **Gestión camareros (maître/responsable sala)**: staffing, asignaciones, briefing/memo, mapa de mesas, día-D checklist. Sin coste/margen ni escandallo de coste.
  - **Gestión clientes (comercial)**: leads, clientes, presupuestos, agenda. Sin cocina ni nóminas.
- **Modelo**: convertir `admins.role` en `CHECK (role IN ('admin','cocina','camareros','clientes'))` **o** introducir tabla `roles` + `role_permissions (role, module, can_view, can_edit)` si se quiere granularidad por módulo (recomendado: empezar por enum de 4 roles, migrar a tabla de permisos si hace falta).

### FR-R02 · Filtrado de navegación y rutas
- El menú de `AdminLayout` se construye según el perfil: cada usuario ve **solo sus módulos**.
- **Doble enforcement**: ocultar en UI **y** validar en cada API route (no basta con esconder el botón).
- **Criterio**: un usuario `cocina` que invoque `/api/quotes` o `/api/staffing/pay` recibe 403.

### FR-R03 · Vista cliente vs vista interna
- Las vistas públicas existentes (`/evento/[id]`, `/presupuesto/[id]`, `/invitados/[token]`) son el "portal cliente" y quedan fuera del RBAC interno (acceso por token). Solo asegurar que **no exponen coste/margen ni datos de personal**.

### FR-R04 · Gestión de usuarios y asignación de rol
- Pantalla en `config` (solo `admin`) para crear usuarios, asignar perfil y activar/desactivar.
- Vincular opcionalmente un `worker` a un usuario de acceso (un cocinero/maître con login propio).

---

## 3ter. SANEAMIENTO · Cálculos, unidades y relaciones (crítico)

Evidencia encontrada en el código actual que confirma los fallos reportados:

- **`StockManager.tsx:380`** — `totalQty` suma **gramos + unidades + ml en un solo número** (`total_grams + total_units + total_ml`). Magnitudes incompatibles agregadas → total sin significado (ej. 1000 g + 5 ud + 200 ml = "1205").
- **No existe conversión de unidades** en todo el código (`g↔kg`, `ml↔l` no se normalizan nunca). Un ingrediente en `kg` y otro en `gr` se suman como si fueran lo mismo.
- **`/api/stock/escandallos`** mueve cantidades pero **no calcula coste** del escandallo: hoy el escandallo no sabe lo que cuesta el evento.
- **Formatos**: mezcla de `parseFloat`/`parseInt` sin política única; redondeos con `toFixed` en unos sitios y `toLocaleString` en otros; cantidades enteras forzadas en `total_units INT` que rompen ingredientes fraccionables.

### FR-S01 · Unidad base canónica + conversión
- Definir **unidad base por dimensión**: masa→gramo, volumen→ml, conteo→unidad. Toda cantidad se almacena/calcula en base y se **presenta** en la unidad legible.
- Tabla/util de conversión (`kg→1000 g`, `l→1000 ml`, `docena→12 ud`, etc.). El `CHECK` de `ingredients.unit` ya enumera las unidades; falta el factor.
- **Criterio**: 1,5 kg + 300 g se suma correctamente como 1800 g y se muestra como "1,8 kg".

### FR-S02 · Prohibir sumas entre dimensiones distintas
- Eliminar `totalQty` agregado. Los totales se calculan y muestran **por dimensión** (total masa, total volumen, total conteo) **nunca** mezclados.
- **Criterio**: un escandallo muestra "2,4 kg · 1,2 L · 18 ud", no un número único.

### FR-S03 · Cálculo de coste como función pura y única
- Centralizar en un único módulo (`src/lib/costing.ts`) el cálculo de:
  - coste de línea = qty_base × coste_unitario_base,
  - coste de escandallo = Σ líneas (+ gastos previos),
  - PVP, margen € y margen %,
  - escalado por pax.
- Que **todas** las vistas (catálogo, presupuesto, escandallo, billing, webhooks) consuman esa misma función. Hoy cada sitio lo recalcula a su manera (`webhooks.ts`, `StockManager`, `cost_desglose`) → cifras divergentes.
- **Criterio**: el coste de un evento es idéntico en presupuesto, escandallo y factura.

### FR-S04 · Formato y precisión de cantidades
- Política única: cantidades fraccionables con decimales (no `INT`), redondeo solo en presentación, locale `es-ES`, símbolo € y unidad siempre visibles.
- **Cambio**: `event_shopping_items.total_units INT` → `NUMERIC` (permitir medias unidades/raciones). Decidir decimales por dimensión (masa/volumen 0–1 dec, dinero 2 dec).
- **Criterio**: ninguna cantidad pierde precisión por redondeo intermedio; el redondeo ocurre una sola vez al renderizar.

### FR-S05 · Saneamiento de relaciones entre entidades
- Auditar y reforzar las FK y la coherencia del grafo: `quote ↔ event ↔ event_order ↔ escandallo ↔ shopping_items ↔ supplier_order ↔ inventory`.
- Hoy hay duplicidad de "ingredientes": `ingredients` (tabla) vs `catalog_items.ingredients JSONB` (texto embebido) vs `event_shopping_items.ingredient_name` (texto suelto). Esto rompe el enlace ingrediente→coste→stock.
- **Cambio**: el ingrediente es **una sola entidad** referenciada por id en todas partes; eliminar los nombres sueltos en texto. El escandallo referencia `ingredient_id`, no `ingredient_name`.
- **Criterio**: cambiar el coste de un ingrediente se propaga a todo escandallo/presupuesto que lo use (engancha con FR-C04).

### FR-S06 · Tests de cálculo (red de seguridad)
- Antes de tocar nada, fijar tests sobre los casos correctos esperados (el repo ya tiene `__tests__`, `vitest`, Playwright).
- Suite mínima: conversión de unidades, suma por dimensión, coste de escandallo escalado por pax, margen, idempotencia presupuesto↔factura.
- **Criterio**: la suite pasa antes de marcar saneamiento como completo (regla del repo: evidencia antes de afirmar).

---

## 4. Cambios de base de datos (resumen)

**Modificar:**
- `quotes`: `status` (nuevo CHECK 4 fases), `cancel_reason`.
- `events`: `location`, `venue_type`, `service_type`.
- `event_menu_items`: `kind` (seleccionado|sugerencia), `pase`/`service_round`.
- `payments` (staffing): `signature_url`, `signed_at`, `signed_by`.
- `ingredients`: flags `is_equipment` / `is_dry` (o tabla `material_items` aparte); añadir factor de conversión a unidad base.
- `admins.role`: pasar de texto libre a `CHECK ('admin','cocina','camareros','clientes')`.
- `event_shopping_items.total_units`: `INT` → `NUMERIC`; referenciar `ingredient_id` en vez de `ingredient_name`.
- `catalog_items.ingredients JSONB`: migrar a referencias `recipe_items`→`ingredients` (eliminar ingredientes embebidos como texto).

**Crear:**
- `role_permissions` (opcional, si se quiere granularidad por módulo).
- `provider_invoices` (deuda/vencimientos/justificantes).
- `escandallos` + `escandallo_lines` (versionado, teórico vs real, con coste snapshot).
- `appcc_records` (lotes, fecha entrada, sanidad).
- (opcional) `material_items`.
- util `src/lib/units.ts` (conversión) y `src/lib/costing.ts` (cálculo único) — no son tablas pero son cambios estructurales de código.
- endpoint `POST /api/recipes/import` (preview + commit, SheetJS) y plantilla Excel descargable.

**Reutilizar tal cual:** `price-history`, `staffing_*`, `automation_rules`/crons.

---

## 5. Puntos a clarificar antes de escribir specs `[NEEDS CLARIFICATION]`

1. **3D/360 del venue externo (FR-A11)**: ¿alcance real en v1, o basta con PDF + sitting 2D sobre el plano? El 3D es caro; recomiendo diferirlo.
2. **Refuerzo de camareros (FR-A05)**: ¿el refuerzo de "1 cada 25" es además del 1/10 (sumatorio) o sustituye tramos? La spec asume sumatorio.
3. **Pase / service_round (FR-C06)**: ¿los pases se definen por evento manualmente o se derivan de la categoría del plato (aperitivo→pase 1, principal→pase 2…)?
4. **Ingesta por voz/escáner Tipi (FR-C04/C08)**: ¿integración con servicio externo (OCR/voz) o entrada manual asistida en v1?
5. **Escandallo teórico**: ¿se mantiene a nivel de **plato** (catálogo) y se instancia por evento, o se edita libre por evento? (Recomiendo: plantilla a nivel plato → instancia por evento.)
6. **Material/seco (FR-C07)**: ¿gestionáis stock de equipamiento (freidoras, bandejas) o es solo checklist de carga?
7. **Granularidad RBAC (FR-R01)**: ¿bastan 4 roles fijos o necesitáis permisos por módulo configurables (tabla `role_permissions`)? Recomiendo empezar con 4 roles.
8. **Migración de ingredientes (FR-S05)**: hay datos vivos en `catalog_items.ingredients JSONB` y en `ingredient_name` suelto. ¿Hay que migrarlos a `ingredients` por id, o se puede partir de catálogo limpio? Esto define el esfuerzo de la Fase 0.
9. **Unidades fraccionables (FR-S04)**: ¿algún ingrediente debe seguir siendo entero obligatorio (ej. "tartas") o todos pasan a `NUMERIC`?
10. **Import de recetas (FR-C10)**: ¿tenéis ya un Excel de recetas con un formato concreto que deba respetar la plantilla, o defino yo la plantilla desde cero? ¿El import debe contemplar **merma %** por ingrediente (peso bruto vs neto), habitual en escandallos de cocina?

---

## 6. Orden sugerido para spec-kit

| Fase | Specs | Por qué primero |
|---|---|---|
| **0** | **FR-S01…S06 (saneamiento: unidades, coste único, relaciones, tests)** | **Fundacional. Todo lo demás calcula sobre esto; hoy está roto. Sin esto, las hojas de cocina heredan los errores.** |
| 1 | FR-R01…R04 (RBAC y visualización de módulos) | Transversal; define qué ve cada perfil antes de añadir módulos nuevos |
| 2 | FR-A01…A05 (workflow, ratios, borrador) | Núcleo comercial; bajo riesgo, alto valor |
| 3 | FR-C01…C04 + **C10** (escandallo versionado + coste real + actualización + **import recetas**) | Corazón del módulo cocina; el import puebla el desglose. Apoyado en el coste saneado de Fase 0 |
| 4 | FR-C05…C07 (producción, carga, logística) | Derivadas del escandallo |
| 5 | FR-C08…C09 (APPCC, recibido↔inventario) | Trazabilidad y cierre del círculo |
| 6 | FR-A09…A12 (firma, proveedores, memo, sitting externo) | Complementos operativos |

Cada FR de este documento está redactado para convertirse en un `spec.md` independiente de spec-kit (un FR = una feature, con sus criterios de aceptación y `[NEEDS CLARIFICATION]` ya marcados).
