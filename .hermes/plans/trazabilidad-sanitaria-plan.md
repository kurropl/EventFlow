# Plan de Implementación: Trazabilidad Sanitaria APPCC

> **Para Hermes:** Implementar usando subagent-driven-development, tarea por tarea.
>
> **Stack:** Next.js 14.2 + PostgreSQL + TypeScript + `html5-qrcode` + Zod  
> **Depende de:** Escandallo + Hojas operativas ya implementados

---

## Fase 0: Setup del módulo Trazabilidad en admin

### Task 0.1: Crear `TrazabilidadPanel` en admin

- Crear `src/components/b2b/TrazabilidadPanel.tsx` — panel con 4 tabs:
  1. **Inventario** (tabla de stock por ingrediente)
  2. **Recepciones** (historial de recepciones con escaneo)
  3. **Lotes** (lotes recibidos, filtro por fecha/proveedor/lote)
  4. **Informe APPCC** (trazabilidad plato→lote→proveedor)

- Crear `src/app/admin/trazabilidad/page.tsx` — re-export con Suspense
- Modificar `src/app/admin/page.tsx` — añadir `isTrazabilidad` y `{isTrazabilidad && <TrazabilidadPanel />}`

## Fase 1: Modelo de datos — Trazabilidad

### Task 1.1: `inventory` + `inventory_movements`

```sql
CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'g',
    min_stock NUMERIC(12,3) DEFAULT 0,
    last_movement_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(ingredient_id)
);

CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('receipt','consumption','adjustment','expiry')),
    quantity NUMERIC(12,3) NOT NULL,
    unit TEXT NOT NULL DEFAULT 'g',
    reference_type TEXT,
    reference_id UUID,
    previous_stock NUMERIC(12,3) NOT NULL,
    new_stock NUMERIC(12,3) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### Task 1.2: `supplier_orders` — añadir estado `received`

```sql
-- Ya existe con CHECK, añadir received
ALTER TABLE supplier_orders DROP CONSTRAINT IF EXISTS supplier_orders_status_check;
ALTER TABLE supplier_orders ADD CONSTRAINT supplier_orders_status_check
    CHECK (status IN ('pending','approved','delivered','received','partial','cancelled'));
```

### Task 1.3: `receiving_log` con QR

```sql
CREATE TABLE IF NOT EXISTS receiving_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_order_id UUID REFERENCES supplier_orders(id) ON DELETE SET NULL,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    lot_number TEXT NOT NULL,
    batch_quantity NUMERIC(12,3) NOT NULL,
    unit TEXT NOT NULL DEFAULT 'g',
    received_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiry_date DATE,
    temperature NUMERIC(5,2),
    supplier TEXT,
    qr_code TEXT,
    scanned_image TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_receiving_lot ON receiving_log(lot_number);
CREATE INDEX idx_receiving_date ON receiving_log(received_date);
```

## Fase 2: API — Recepción con escaneo

### Task 2.1: `GET /api/trazabilidad/inventory` — Stock actual

```typescript
// Devuelve todas las filas de inventory con JOIN a ingredients
// Calcular si stock < min_stock → alerta roja
```

### Task 2.2: `POST /api/trazabilidad/receiving` — Registrar recepción

- Recibe: ingredient_id, lot_number, batch_quantity, unit, received_date, expiry_date, temperature, supplier, qr_code
- Actualiza automáticamente: `inventory.quantity += batch_quantity` (si no existe inventory, lo crea)
- Crea `inventory_movements` con tipo `receipt`
- Devuelve el nuevo stock

```typescript
// Para la actualización automática:
const result = await pool.query(`
  INSERT INTO inventory (ingredient_id, quantity, unit)
  VALUES ($1, $2, $3)
  ON CONFLICT (ingredient_id) DO UPDATE SET quantity = inventory.quantity + $2
  RETURNING quantity;
`, [ingredientId, batch_quantity, unit]);

// Registrar movimiento
await pool.query(`
  INSERT INTO inventory_movements (inventory_id, movement_type, quantity, unit,
    reference_type, reference_id, previous_stock, new_stock)
  VALUES ($1, 'receipt', $2, $3, 'receiving_log', $4, $5, $6);
`, [inventoryId, batch_quantity, unit, receivingId, oldStock, newStock]);
```

### Task 2.3: `POST /api/trazabilidad/receiving/from-order/[orderId]` — Recibir pedido completo

- Toma el `supplier_orders` con sus `supplier_order_items`
- Para cada item, crea un `receiving_log` con el mismo ingrediente y cantidad
- Marca el pedido como `received`
- Si hay error en un item, no detiene el resto (parcial)

### Task 2.4: `GET /api/trazabilidad/trace/[eventId]` — Informe APPCC

```typescript
// Devolver: por cada plato del evento, los lotes consumidos
// JOIN: event_shopping_items → recipe_items → ingredients → receiving_log
SELECT 
  esi.ingredient_name AS plato,
  esi.actual_quantity,
  rl.lot_number,
  rl.received_date,
  rl.expiry_date,
  rl.temperature,
  rl.supplier
FROM event_shopping_items esi
LEFT JOIN recipe_items ri ON ri.id = esi.recipe_item_id
LEFT JOIN ingredients i ON i.id = ri.ingredient_id
LEFT JOIN receiving_log rl ON rl.ingredient_id = i.id
WHERE esi.event_id = $1;
```

## Fase 3: Frontend — Escaneo en recepción

### Task 3.1: Botón "Escanear" en formulario

- Usar `html5-qrcode` (librería npm) — `npm install html5-qrcode`
- Botón que abre la cámara (cámara trasera del móvil)
- Detecta códigos de barras:
  - **EAN-13** → extrae número de lote
  - **DataMatrix** → extrae lote + caducidad (si el código estándar lo incluye)
- Al detectar: rellena campos `lote` y `caducidad` automáticamente
- Captura la imagen del código y la guarda como `scanned_image` (opcional: subir a storage)

### Task 3.2: Formulario de recepción

Componente React con:
- Selector de `ingredient` (desplegable)
- Selector de `supplier_order` (opcional — si existe pedido se vincula)
- Inputs: `lot_number`, `batch_quantity`, `unit`, `received_date`, `expiry_date`, `temperature`, `supplier`
- Botón "Escanear" → abre cámara
- Alerta roja si `temperature > 8°C` y el ingrediente es perecedero
- Botón "Recibir" → POST a `/api/trazabilidad/receiving`

## Fase 4: Panel Trazabilidad

### Task 4.1: Inventario (tabla de stock)

- `GET /api/trazabilidad/inventory` → tabla con `name`, `stock`, `min_stock`, `last_movement`
- Fila roja si `stock < min_stock`
- Botón "Ajustar" → modal con `scoped_quantity` y `reason`

### Task 4.2: Recepciones (lista)

- `GET /api/trazabilidad/receiving` → tabla con filtros por fecha, proveedor, lote
- Cada fila: fecha, lote, ingrediente, cantidad, proveedor, caducidad, temperatura
- Si `temperature > 8` → icono rojo ⚠️

### Task 4.3: Lotes por evento

- `GET /api/trazabilidad/lot-consumption/[eventId]` → lista de lotes consumidos en el evento
- Tabla plana: Plato | Ingrediente | Lote | Proveedor | Caducidad | Temperatura

### Task 4.4: Informe APPCC (imprimible)

- `GET /api/trazabilidad/trace/[eventId]` tabla plana para impresión
- Botón "Imprimir" → `window.print()`

---

## Ruta de ejecución

1. Migraciones SQL (inventory, receiving_log, inventory_movements, supplier_orders)
2. `html5-qrcode` install + componente escaneador
3. API endpoints
4. TrazabilidadPanel frontend
5. Tests + build + deploy