# SCHEMA-MAP.md — Mapa del Esquema Real de EventFlow

**Generado por:** WP-00 Reconocimiento del Sistema  
**Fecha:** 2026-07-30  
**Fuente:** `schema.sql` (2390+ líneas), `scripts/*.sql`, migraciones acumuladas

---

## Convenciones Detectadas

| Aspecto | Convención |
|---------|-----------|
| **PK** | `UUID PRIMARY KEY DEFAULT uuid_generate_v4()` o `gen_random_uuid()` (mixto) |
| **Naming tablas** | `snake_case`, inglés (ej: `event_orders`, `staffing_lines`) |
| **Naming columnas** | `snake_case`, inglés (ej: `guest_count`, `event_date`) |
| **FKs** | `REFERENCES tabla(id) ON DELETE CASCADE/SET NULL` |
| **Timestamps** | `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `updated_at` via trigger |
| **Soft delete** | `active BOOLEAN NOT NULL DEFAULT true` (no DELETE) |
| **RLS** | Deshabilitado en todas las tablas (auth en capa API/middleware) |
| **Checks** | `CHECK (status IN (...))` inline en la tabla |

---

## Mapeo: Entidad Lógica (Spec) → Tabla Real

### 1. EVENTOS (agregado raíz)

| Spec lógico | Tabla real | Notas |
|-------------|-----------|-------|
| `events` | **`events`** | PK UUID. Estados: `draft, sent, accepted, in_progress, completed, paid, cancelled, lost, reopened` |
| `event_status` | Columna `events.status` | Máquina de estados: FWD-1..FWD-5 + INV-1..INV-5 |
| `event_type` | Columna `events.event_type` | `boda, cumpleaños, corporativo, bautizo, comunión, otro` |
| `venue_type` | Columna `events.venue_type` | `benitez` (interno) / `externo` |

**Columnas clave de events:**
- `id UUID PK`, `quote_id UUID FK→quotes`, `client_id UUID FK→clients`
- `client_name`, `client_email`, `client_phone`, `event_type`, `guest_count`, `kids_count`
- `event_date DATE`, `status TEXT`, `service_type TEXT` (coctel/menu)
- `selected_items JSONB`, `total_pvp`, `total_cost`, `bar_hours`, `bar_price`, `iva_pct`
- `venue_type`, `location`, `venue_pdf_url`, `venue_id UUID FK→venues`
- `cancelled_at`, `cancelled_by`, `cancel_reason`, `lost_at`, `lost_reason`
- `reopened_at`, `reopened_by`, `reopen_reason`, `snapshot_previo JSONB`
- `operations_generated_at`, `stock_deducted`, `custom_pass_order JSONB`
- `client_token TEXT UNIQUE`, `protocol_notes TEXT`

### 2. PRESUPUESTOS

| Spec lógico | Tabla real | Notas |
|-------------|-----------|-------|
| `quotes` | **`quotes`** | PK UUID. FK circular: `quotes.event_id → events`, `events.quote_id → quotes` |
| `quote_lines` | Columna `quotes.items JSONB` | Items embebidos en JSONB, NO tabla separada |

**Columnas clave de quotes:**
- `id UUID PK`, `event_id UUID FK→events`, `lead_id UUID FK→leads`
- `status TEXT` (draft, sent, accepted, rejected, expired, historical)
- `items JSONB`, `base_pvp`, `base_cost`, `bar_price`, `extras_pvp`, `extras_cost`
- `iva_pct`, `total_pvp`, `total_cost`, `margin_pct`
- `valid_until DATE`, `sent_at`, `accepted_at`, `cancel_reason`
- `deposit_paid BOOLEAN`, `deposit_amount`, `deposit_pct`

### 3. CLIENTES Y LEADS (CRM)

| Spec lógico | Tabla real | Notas |
|-------------|-----------|-------|
| `clients` | **`clients`** | PK UUID. Unique index en `lower(email)` |
| `leads` | **`leads`** | PK UUID. Status: `nuevo, contactado, presupuestado, convertido, perdido` |
| `interactions` | **`interactions`** | PK UUID. Type: `llamada, email, whatsapp, nota, reunion` |

**Columnas clave de clients:**
- `id UUID PK`, `name`, `email UNIQUE`, `phone`, `company`, `tags JSONB`, `notes`
- `fiscal_name`, `fiscal_nif UNIQUE`, `fiscal_address`
- `lead_id UUID FK→leads`

**Columnas clave de leads:**
- `id UUID PK`, `name`, `email`, `phone`, `source` (configurador/manual/web/referido/otro)
- `status`, `notes`, `event_type`, `guest_count`, `event_date`
- `converted_to_client_id UUID FK→clients`
- `assigned_to UUID FK→admins`

### 4. ÓRDENES Y FACTURACIÓN

| Spec lógico | Tabla real | Notas |
|-------------|-----------|-------|
| `event_orders` | **`event_orders`** | PK UUID. Generada al aceptar presupuesto |
| `invoices` | **`invoices`** | PK UUID. Numeración `F-AAAA-NNNN` |
| `payments` | **`payments`** | PK UUID. `concept` incluye `senal, penalizacion_por_cancelacion` |

**Columnas clave de event_orders:**
- `id UUID PK`, `event_id UUID FK→events`, `quote_id UUID FK→quotes`
- `client_id UUID FK→clients`, `confirmed_price`, `final_price`
- `status` (in_progress, completed, cancelled, reopened)
- `extra_consumptions JSONB`, `tables_suggested/confirmed`, `waiters_suggested/confirmed`
- `completed_at`, `notes`

**Columnas clave de invoices:**
- `id UUID PK`, `event_order_id UUID FK→event_orders`, `event_id UUID FK→events`
- `client_id UUID FK→clients`, `invoice_number TEXT UNIQUE`, `fiscal_name/nif/address`
- `subtotal`, `iva_pct`, `iva_amount`, `total`, `extras_pvp`, `payments_total`, `balance_due`
- `status` (pending, paid, overdue, cancelled), `paid_at`, `pdf_data TEXT`
- `rectificativa_of UUID FK→invoices`

### 5. INGREDIENTES Y STOCK

| Spec lógico | Tabla real | Notas |
|-------------|-----------|-------|
| `ingredients` | **`ingredients`** | PK UUID. 3 columnas de coste sincronizadas via trigger |
| `inventory` | **`inventory`** | PK UUID. Espejo de `ingredients.quantity` (trigger sync) |
| `inventory_movements` | **`inventory_movements`** | PK UUID. Types: receipt, consumption, adjustment, expiry, transfer |
| `stock_entries` | **`stock_entries`** | PK UUID. Movimientos trazados |
| `ingredient_price_history` | **`ingredient_price_history`** | PK UUID. Histórico de cambios de precio |
| `units_of_measure` | **`units_of_measure`** | PK UUID. Seed: kg, g, l, ml, ud, doc |
| `ingredient_unit_conversions` | **NO EXISTE** | Spec WP-01 la requiere |
| `stock_movements` | **NO EXISTE** | Spec WP-02 la requiere |
| `stock_lots` | **NO EXISTE** | Spec WP-02 la requiere |

**Columnas clave de ingredients:**
- `id UUID PK`, `name TEXT UNIQUE`, `category TEXT`, `unit TEXT` (default 'g')
- `unit_cost NUMERIC(12,4)` (canónica), `cost_per_unit` (legacy stock), `current_price` (legacy escandallo)
- `pvp_ratio`, `stock_unit`, `packaging_size`, `quantity NUMERIC(12,2)` (stock actual)
- `min_stock NUMERIC(12,2)`, `supplier TEXT`, `supplier_id UUID`
- `active BOOLEAN`, `is_equipment BOOLEAN`, `is_dry BOOLEAN`, `last_restocked`

### 6. CATÁLOGO Y RECETAS (PLATOS)

| Spec lógico | Tabla real | Notas |
|-------------|-----------|-------|
| `dishes/recipes` | **`catalog_items`** (platos de sala) + **`recipes`** (ficha técnica cocina) | **DOS TABLAS separadas** |
| `recipe_ingredients` | **`recipe_items`** | FK `catalog_item_id→catalog_items`, `ingredient_id→ingredients` |
| `recipe_templates` | **`recipe_templates`** + **`recipe_template_items`** | Plantillas escalables por pax |

**IMPORTANTE — Duplicidad platos/recetas (Sala 3.1 vs Cocina 4.2):**
- `catalog_items`: tabla principal de platos con `ingredients JSONB` embebidos (118 items seed)
- `recipes`: ficha técnica con `catalog_item_id FK→catalog_items` (opcional)
- `recipe_items`: relación normalizada `catalog_item→ingredient` con `quantity, unit, unit_dimension`
- **Ambas coexisten**; `catalog_items.ingredients` es JSONB legacy, `recipe_items` es la fuente normalizada

**Columnas clave de catalog_items:**
- `id UUID PK`, `name TEXT`, `category TEXT CHECK(...)`, `subcategory`
- `pvp NUMERIC(10,2)`, `cost NUMERIC(10,2)`, `ingredients JSONB` (legacy)
- `image_url`, `active BOOLEAN`, `allergens JSONB`, `description TEXT`

**Columnas clave de recipes:**
- `id UUID PK`, `name TEXT`, `description`, `source` (manual/excel/pdf/scanned)
- `servings INT`, `category`, `catalog_item_id UUID FK→catalog_items`
- `published BOOLEAN`, `ingredients JSONB` (legacy), `instructions TEXT`
- `prep_time`, `cook_time`, `difficulty`, `version INT`, `active BOOLEAN`
- `merma_pct NUMERIC(5,2)` (default 20), `peso_racion NUMERIC(12,3)`
- `author`, `allergens TEXT`, `photo_url TEXT`

**Columnas clave de recipe_items:**
- `id UUID PK`, `catalog_item_id UUID FK→catalog_items`, `ingredient_id UUID FK→ingredients`
- `quantity NUMERIC(12,3)`, `notes`, `version INT`, `version_note`
- `unit VARCHAR(10)`, `unit_dimension TEXT` (mass/volume/count)
- `quantity_override NUMERIC(10,2)`, `merma_pct NUMERIC(5,2)`, `updated_at`

### 7. MENÚS

| Spec lógico | Tabla real | Notas |
|-------------|-----------|-------|
| `proposed_menus` | **`proposed_menus`** | PK TEXT (menu1, menu2, kid1...). 8 menús seed |
| `event_menu_items` | **`event_menu_items`** | Items del menú seleccionado por evento |
| `menus` | **NO EXISTE** | Spec WP-12 la requiere (con estados y versionado) |
| `menu_sections` | **NO EXISTE** | Spec WP-12 la requiere |
| `menu_section_dishes` | **NO EXISTE** | Spec WP-12 la requiere |
| `event_menus` | **NO EXISTE** | Spec WP-12 la requiere |

### 8. PROVEEDORES Y COMPRAS

| Spec lógico | Tabla real | Notas |
|-------------|-----------|-------|
| `providers` | **`providers`** | PK UUID. Categories: catering, decoracion, flores, etc. |
| `supplier_orders` | **`supplier_orders`** | PK UUID. Status: pending, ordered, approved, delivered, received, partial, cancelled |
| `supplier_order_items` | **`supplier_order_items`** | FK `order_id→supplier_orders`, `ingredient_id→ingredients` |
| `provider_invoices` | **`provider_invoices`** | FK `provider_id→providers`. Status: pendiente, pagado, vencido |
| `purchase_orders` | **NO EXISTE** | Spec WP-06 la requiere |
| `purchase_order_lines` | **NO EXISTE** | Spec WP-06 la requiere |

### 9. STAFFING Y EMPLEADOS

| Spec lógico | Tabla real | Notas |
|-------------|-----------|-------|
| `workers` | **`workers`** | PK UUID. Roles como array `TEXT[]` |
| `waiters` | **`waiters`** | PK UUID. Legacy, separado de workers |
| `staffing_lines` | **`staffing_lines`** | PK UUID. FK `event_id→events` |
| `staffing_offers` | **`staffing_offers`** | PK UUID. Status: sent, accepted, rejected, expired |
| `staffing_assignments` | **`staffing_assignments`** | PK UUID. Unique index por line+worker |
| `worker_event_pay` | **`worker_event_pay`** | PK UUID. Nómina por trabajador/evento |
| `uniform_catalog` | **`uniform_catalog`** | PK UUID |
| `event_staff_requirements` | **`staffing_lines`** | Mismo concepto, misma tabla |
| `event_shifts` | **`staffing_offers`** + **`staffing_assignments`** | Ofertas + asignaciones |
| `employees` | **`workers`** | Mapeo: spec "employees" = tabla real "workers" |
| `payrolls` | **`worker_event_pay`** | Mapeo: spec "payrolls" = tabla real "worker_event_pay" |
| `work_hours` | **NO EXISTE explícita** | Se modela via `worker_event_pay.hours` |

### 10. EQUIPAMIENTO

| Spec lógico | Tabla real | Notas |
|-------------|-----------|-------|
| `equipment` | **`equipment`** | PK UUID. Categories: utensilio, vajilla, maquinaria, textil, mobiliario, descartable |
| `equipment_rules` | **`equipment_rules`** | FK `catalog_item_id→catalog_items`, `equipment_id→equipment` |
| `event_equipment_checkout` | **`event_equipment_checkout`** | Reserva por evento |
| `equipment_stock` | **`equipment.stock_quantity`** | En la tabla equipment, no separada |

### 11. MESAS Y PLANO

| Spec lógico | Tabla real | Notas |
|-------------|-----------|-------|
| `tables` | **`tables`** | PK UUID. FK `event_id→events`. Per-evento |
| `event_floorplans` | **`event_floorplans`** | PK UUID. JSONB data |
| `table_assignments` | **`table_assignments`** | FK `guest_id→guests`, `event_id→events` |
| `floor_plans` | **`floor_plans`** | Plantillas globales |
| `venues` | **`venues`** | Catálogo: salon-arriba, salon-abajo |
| `venue_bookings` | **`venue_bookings`** | Reserva con exclusión GiST |
| `table_plans` | **`table_plans`** | Estado del editor de planos |

### 12. INVITADOS

| Spec lógico | Tabla real | Notas |
|-------------|-----------|-------|
| `guests` | **`guests`** | PK UUID. RSVP: pendiente, confirmado, rechazado |
| `guest_forms` | **`guest_forms`** | Formulario de lista del cliente |

### 13. APPCC / HACCP

| Spec lógico | Tabla real | Notas |
|-------------|-----------|-------|
| `haccp_plans` | **`haccp_plans`** | 7 secciones: general, catering, specific |
| `haccp_critical_limits` | **`haccp_critical_limits`** | Parameters: temp_fridge, temp_freezer, etc. |
| `haccp_monitoring` | **`haccp_monitoring`** | Status: ok, warning, critical |
| `fridge_temperature_log` | **`fridge_temperature_log`** | Log de temperaturas |
| `cleaning_log` | **`cleaning_log`** | Schedule: diario, semanal, mensual, pre/post-evento |
| `supplier_approval` | **`supplier_approval`** | Aprobación de proveedores |
| `traceability_log` | **`traceability_log`** | Trazabilidad sanitaria |
| `receiving_log` | **`receiving_log`** | Recepción de lotes |
| `lot_consumption` | **`lot_consumption`** | Consumo por lote/evento |
| `haccp_equipment_calibration` | **`haccp_equipment_calibration`** | Calibración de equipos |

### 14. OPERACIÓN / CARGA / LOGÍSTICA

| Spec lógico | Tabla real | Notas |
|-------------|-----------|-------|
| `event_load` | **`event_shopping_items`** | Lista de compras por evento (JSONB en events.selected_items) |
| `event_logistics` | **`event_plans`** | Checklist Día D |
| `production_timing` | **`event_plans`** con category='timing' | Mismo concepto |
| `production_tasks` | **`event_plans`** con category='tarea' | Mismo concepto |
| `service_passes` | **`service_passes`** | 6 pases: aperitivos, mesas, principal, dulce, bebidas, complementos |
| `category_pass_mapping` | **`category_pass_mapping`** | Mapeo categoría→pase |

### 15. SISTEMA / CONFIG

| Spec lógico | Tabla real | Notas |
|-------------|-----------|-------|
| `users` | **`admins`** | PK UUID. Roles: admin, cocina, camareros, clientes |
| `roles` | Columna `admins.role` | RBAC 4 roles en CHECK |
| `business_settings` | **`business_settings`** | Config del negocio (1 fila) |
| `automation_rules` | **`automation_rules`** | Reglas de automatización |
| `automation_logs` | **`automation_logs`** | Logs de ejecución |
| `email_queue` | **`email_queue`** | Cola de envío de emails |
| `checklist_templates` | **`checklist_templates`** | Plantillas de checklist |
| `checklist_tasks` | **`checklist_tasks`** | Tareas por evento |
| `audit_log` | **`audit_log`** | Registro de transiciones |
| `webhook_logs` | **`webhook_logs`** | Logs de webhooks |
| `bar_config` | **`bar_config`** | Precios barra libre (0-3 horas) |
| `domain_events` | **NO EXISTE** | Spec WP-04 la requiere (outbox) |
| `event_closure_checklists` | **NO EXISTE** | Spec WP-18 la requiere |
| `event_financial_closures` | **NO EXISTE** | Spec WP-24 la requiere |
| `payment_plans` | **NO EXISTE** | Spec WP-21 la requiere |
| `payment_milestones` | **NO EXISTE** | Spec WP-21 la requiere |
| `client_portals` | **NO EXISTE** | Spec WP-25 la requiere |
| `extras_catalog` | **NO EXISTE** | Spec WP-29 la requiere |
| `event_extras` | **NO EXISTE** | Spec WP-29 la requiere |
| `event_messages` | **NO EXISTE** | Spec WP-30 la requiere |

### 16. OTROS

| Spec lógico | Tabla real | Notas |
|-------------|-----------|-------|
| `appointments` | **`appointments`** | PK UUID. Kind: cita, bloqueo, nota |
| `event_contracts` | **`event_contracts`** | Contratos con firma dibujada |
| `event_briefings` | **`event_briefings`** | Briefings de camareros |
| `briefing_send_log` | **`briefing_send_log`** | Log de envío de briefings |
| `event_cost_deviations` | **`event_cost_deviations`** | Desviación estimado vs real |

---

## Tablas en la BD (conteo total: ~55 tablas + 4 vistas)

### Vistas SQL
1. `catalog_summary` — Catálogo con margen calculado
2. `event_summary` — Eventos con margen y beneficio
3. `shopping_list` — Lista de compras desglosada
4. `v_event_cost` — Costes por evento en JSON

---

## FKs Faltantes hacia events (Requieren WP-03)

| Tabla | Columna FK faltante | Motivo |
|-------|-------------------|--------|
| `quotes` | `event_id` | Creada pero nullable, puede tener NULLs |
| `supplier_orders` | `event_id` | Nullable (pedidos genéricos sin evento) |
| `event_costs` | `event_id` | FK creada |
| `event_cost_deviations` | `event_id` | FK creada |

---

## Workers / Integraciones

- **Cron jobs:** Existen 4 rutas cron en `src/app/api/cron/`:
  - `payment-reminders` — Recordatorios de pago
  - `post-event-followup` — Seguimiento post-evento
  - `pre-event-briefing` — Briefings previos
  - `pre-event-reminders` — Recordatorios previos
- **Webhooks:** `webhook_logs` tabla + `/api/webhooks/test` endpoint
- **Email:** `email_queue` tabla + `src/lib/email.ts` servicio
- **No hay worker/runner de domain events** — Spec WP-04 lo requiere
