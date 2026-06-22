# Especificación: Trazabilidad Sanitaria APPCC — Lote → Plato

**Versión:** 1.0.0  
**Depende de:** Escandallo como Fuente de Verdad + Hojas operativas de cocina  
**Feature:** Cerrar el círculo pedido→recepción→inventario→consumo con trazabilidad sanitaria por lote

---

## 1. Decisiones adoptadas

| Pregunta | Decisión |
|---|---|
| P1 — Captura de lote | **OCR/QR con cámara** — escaneo mediante la cámara del dispositivo (`MediaDevices.getUserMedia`). Se usa `html5-qrcode` para lectores de QR/códigos de barras estándar EAN-13, Code128, DataMatrix. El formulario de recepción tiene un botón "Escanear lote" que abre la cámara, captura el código y rellena automáticamente lote y caducidad si el código lo contiene. En fase 2 se añade OCR de texto completo de la etiqueta del proveedor. |

---

## 2. Diagnóstico del estado actual

### Lo que YA existe:
| Componente | Estado |
|---|---|
| `supplier_orders` con pedidos a proveedor | ✅ Existe con `id`, `supplier`, `status`, `order_date`, `expected_date` |
| `supplier_order_items` con `ingredient_name`, `quantity` | ✅ Existe |
| `event_shopping_items` con `theoretical_qty`, `actual_quantity` | ✅ Columnas migradas |
| `recipes` → `catalog_items` → `recipe_items` pipeline | ✅ Implementado |
| `equipment` con stock | ✅ Implementado |

### Lo que FALTA:

| Componente | Por qué falta |
|---|---|
| Tabla `inventory` con stock actual por ingrediente | No existe — el stock se gestiona manualmente |
| Tabla `receiving_log` con lotes recibidos | No hay trazabilidad de lote→pedido |
| Tabla `lot_traceability` vinculando lote→evento | No hay trazabilidad sanitaria |
| Vinculación automática recepción→inventario | Los pedidos no actualizan stock |
| Descuento automático de inventario por escandallo real | No hay consumo vinculado a stock |
| Panel de trazabilidad (APPCC) | No hay vista de inspección |

---

## 3. Modelo de datos

### 3.1. `inventory` — Stock actual por ingrediente

```sql
CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'g',
    min_stock NUMERIC(12,3) DEFAULT 0,
    last_movement_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(ingredient_id)
);
```

### 3.2. `receiving_log` — Registro de recepción de mercancía

```sql
CREATE TABLE IF NOT EXISTS receiving_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_order_id UUID REFERENCES supplier_orders(id) ON DELETE SET NULL,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    lot_number TEXT NOT NULL,           -- Número de lote del fabricante
    batch_quantity NUMERIC(12,3) NOT NULL,  -- Cantidad recibida en esta entrada
    unit TEXT NOT NULL DEFAULT 'g',
    received_date DATE NOT NULL DEFAULT CURRENT_DATE,
    received_by TEXT,                    -- Persona que recibe
    expiry_date DATE,                    -- Fecha de caducidad
    temperature NUMERIC(5,2),            -- Temperatura al recibir (°C)
- `supplier` TEXT,                       -- Proveedor (puede ser diferente del pedido)
- `condition_ok BOOLEAN DEFAULT true`,   -- Estado de la mercancía al recibir
- `source TEXT DEFAULT 'manual'`,        -- 'manual', 'scan', 'api'
- `qr_code TEXT`,                        -- Código QR escaneado (raw texto)
- `scanned_image TEXT`,                  -- URL de la imagen capturada (opcional, almacenada en storage)
- `notes TEXT`,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_receiving_lot ON receiving_log(lot_number);
CREATE INDEX idx_receiving_ingredient ON receiving_log(ingredient_id);
CREATE INDEX idx_receiving_supplier_order ON receiving_log(supplier_order_id);
CREATE INDEX idx_receiving_date ON receiving_log(received_date);
```

### 3.3. `lot_consumption` — Consumo de lote por evento

```sql
CREATE TABLE IF NOT EXISTS lot_consumption (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receiving_log_id UUID NOT NULL REFERENCES receiving_log(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    quantity_consumed NUMERIC(12,3) NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'g',
    consumed_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lot_consumption_event ON lot_consumption(event_id);
CREATE INDEX idx_lot_consumption_receiving ON lot_consumption(receiving_log_id);
```

### 3.4. `inventory_movements` — Historial de movimientos de inventario

```sql
CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('receipt', 'consumption', 'adjustment', 'expiry', 'transfer')),
    quantity NUMERIC(12,3) NOT NULL,     -- Positivo = entrada, Negativo = salida
    unit TEXT NOT NULL DEFAULT 'g',
    reference_type TEXT,                 -- 'receiving_log', 'event', 'manual'
    reference_id UUID,                   -- FK polimórfica
    previous_stock NUMERIC(12,3) NOT NULL,
    new_stock NUMERIC(12,3) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_inventory_movements_inventory ON inventory_movements(inventory_id);
CREATE INDEX idx_inventory_movements_type ON inventory_movements(movement_type);
```

### 3.5. Modificaciones a `supplier_orders`

```sql
-- Añadir estado 'received' a los existentes
ALTER TABLE supplier_orders DROP CONSTRAINT IF EXISTS supplier_orders_status_check;
ALTER TABLE supplier_orders ADD CONSTRAINT supplier_orders_status_check
    CHECK (status IN ('pending','approved','delivered','received','partial','cancelled'));
```

---

## 4. Reglas de negocio

### 4.1. Flujo completo: Pedido → Recepción → Inventario → Consumo

```
1. Pedido a proveedor (supplier_orders)     
         ↓
2. Recepción de mercancía (receiving_log)    
   ├── Se vincula al pedido (supplier_order_id)
   ├── Se captura: lote, caducidad, temperatura, cantidad recibida
   └── Se pueden recibir varios lotes de un mismo pedido (recepción parcial)
         ↓
3. Se actualiza inventario automáticamente     
   ├── inventory.quantity += batch_quantity
   └── inventory_movements registra 'receipt'
         ↓
4. Consumo registrado por evento (lot_consumption)
   ├── Al cerrar el evento (freeze event)
   ├── Se descuenta de inventory.quantity
   └── inventory_movements registra 'consumption'
         ↓
5. Trazabilidad completa: lote → plato servido
   └── Tabla de inspección: por evento, listar todos los lotes consumidos
```

### 4.2. Recepción de mercancía

- Al llegar un pedido, el usuario crea un `receiving_log` con los datos del lote
- Se puede recibir un pedido en **varios lotes** (misma fecha o diferente)
- Si el pedido no existe (`supplier_order_id = null`), se registra como recepción directa
- La cantidad recibida (`batch_quantity`) puede ser menor que la pedida (parcial)
- Si `temperature > 8°C` para productos perecederos → alerta visible en el formulario

### 4.3. Actualización de inventario automática

- **Al crear un `receiving_log`**: trigger/API suma `batch_quantity` a `inventory.quantity` del `ingredient_id` correspondiente
- Si no existe `inventory` para ese ingrediente, se crea automáticamente
- **Al cerrar evento (freeze)**: trigger/API descuenta `actual_quantity` de los ingredientes consumidos
- Ajustes manuales permitidos con tipo `adjustment` en `inventory_movements`

### 4.4. Trazabilidad sanitaria (APPCC)

Dado un evento, se puede listar:
```
Plato → Ingrediente (teórico) → Ingrediente (real) → Lote(s) → Proveedor → Fecha recepción → Caducidad
```

Formato exigido por inspección:
- Fecha del evento
- Proveedor de cada ingrediente
- Número de lote de cada ingrediente
- Fecha de caducidad
- Temperatura (para refrigerados/congelados)
- Cantidad consumida

### 4.5. Vinculación al escandallo real

- `lot_consumption.quantity_consumed` = `event_shopping_items.actual_quantity` × proporción estimada
- En la primera versión se asigna el lote manualmente al consumir (el usuario indica qué lote se usó para qué ingrediente)
- En fase 2 se puede calcular automáticamente: "lote más cercano a caducar" primero (FIFO)

---

## 5. API endpoints

| Endpoint | Método | Función |
|---|---|---|
| `/api/trazabilidad/inventory` | GET | Listar inventario actual (todos los ingredientes + stock) |
| `/api/trazabilidad/inventory/[ingredientId]` | GET | Detalle de un ingrediente + movimientos |
| `/api/trazabilidad/inventory/[ingredientId]` | PUT | Ajustar stock manualmente (+ observación) |
| `/api/trazabilidad/receiving` | GET | Listar recepciones (filtro por fecha, proveedor, lote) |
| `/api/trazabilidad/receiving` | POST | Registrar recepción (actualiza inventario automáticamente) |
| `/api/trazabilidad/receiving/[id]` | GET | Detalle de recepción |
| `/api/trazabilidad/receiving/from-order/[orderId]` | POST | Recibir pedido completo (crea recepciones para todos los items) |
| `/api/trazabilidad/lot-consumption/[eventId]` | GET | Listar lotes consumidos en un evento |
| `/api/trazabilidad/lot-consumption/[eventId]` | POST | Registrar consumo de lote en evento |
| `/api/trazabilidad/trace/[eventId]` | GET | Informe APPCC completo (evento → plato → lote → proveedor) |
| `/api/trazabilidad/movements` | GET | Historial de movimientos de inventario |

---

## 6. Vistas de admin

### Panel Trazabilidad (APPCC) en admin

```
/admin/trazabilidad/
├── Inventario              → tabla con ingrediente, stock, unidad, min_stock, última actualización
├── Recepciones             → tabla con fecha, lote, ingrediente, proveedor, caducidad, temperatura
│   └── Botón: "Recibir pedido" → selector de supplier_order
│   └── Crear recepción directa → form
├── Consumo por evento      → selector de evento, tabla de lotes consumidos
└── Informe APPCC           → selector de evento → informe imprimible (tabla plana) 
```

---

## 7. Criterios de aceptación

- ✅ Dado un evento, se listan todos los lotes de ingredientes consumidos (plato → lote → proveedor)
- ✅ El stock aumenta automáticamente al registrar una recepción, sin ajuste manual
- ✅ Cada recepción queda registrada con fecha de entrada, lote y proveedor
- ✅ Se puede recibir un pedido completo desde `supplier_orders` generando recepciones
- ✅ El informe APPCC es exportable/imprimible desde el panel
- ✅ Las alertas de temperatura (>8°C perecederos) se muestran en la recepción

---

## 8. No Alcance (futuro)

- OCR nativo con cámara para captura de lote (fase 2)
- Integración con API de proveedor para pedidos EDI
- FIFO automático (fase 2 — se asigna lote manualmente al consumo)
- Alertas automáticas de caducidad próxima (fase 2)
- Etiquetado de productos con QR al recibir