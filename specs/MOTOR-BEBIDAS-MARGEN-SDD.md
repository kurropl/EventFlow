# SDD: Motor de Bebidas + Cálculo Margen/PVP

## 1. Contexto

**Problema actual:**
- El escandallo de EventFlow muestra costes por ingrediente pero NO calcula automáticamente las bebidas
- No hay cálculo de margen ni PVP (precio de venta al público)
- El usuario debe calcular manualmente cuántas botellas de vino, refrescos, etc. necesita

**Solución:**
Añadir al módulo de Escandallos un "Motor de Bebidas" automático y un "Panel de Margen/PVP" en tiempo real.

---

## 2. Motor de Bebidas

### 2.1 Datos de entrada (configurables por evento)
```typescript
interface BebidasConfig {
  pax: number;                    // Comensales
  pct_bebedores: number;          // % que bebe alcohol (ej: 60)
  bebidas_por_persona: number;    // Consumo medio (ej: 2.5)
  pct_cerveza: number;            // % cerveza (ej: 30)
  pct_vino: number;               // % vino (ej: 50)
  pct_refresco: number;           // % refresco (ej: 15)
  pct_agua: number;               // % agua (ej: 5)
  cafe_por_persona: boolean;      // Café postre
  hielo_por_persona: number;      // kg hielo (ej: 0.5)
}
```

### 2.2 Cálculos automáticos
```typescript
// Ejemplo para 120 comensales, 60% bebedores, 2.5 bebidas/pax
const bebedores = 120 * 0.60 = 72 personas
const total_bebidas = 72 * 2.5 = 180 bebidas

// Vino (50%): 180 * 0.50 = 90 copas → 90/6 = 15 botellas
// Cerveza (30%): 180 * 0.30 = 54 cervezas → 54/20 = 3 cajas
// Refresco (15%): 180 * 0.15 = 27 latas
// Agua (5%): 180 * 0.05 = 9 botellas

// Café: 120 personas
// Hielo: 120 * 0.5 = 60 kg
```

### 2.3 Productos de referencia (configurables)
- Vino: botella 75cl = 6 copas
- Cerveza: caja 20 lata 33cl
- Refresco: lata 33cl
- Agua: botella 1.5L = 4 vasos
- Café: taza
- Hielo: saco 2kg

---

## 3. Panel de Margen/PVP

### 3.1 Estructura
```
┌─────────────────────────────────────────┐
│           RESUMEN COSTES EVENTO         │
├─────────────────────────────────────────┤
│ Gastronomía           1,800.00 € (×120) │
│ Bebidas               650.00 € (×120)   │
│ Personal              480.00 €          │
│ Equipamiento          200.00 €          │
│ Otros                  50.00 €          │
├─────────────────────────────────────────┤
│ COSTE TOTAL          3,180.00 €         │
│ Coste/pax               26.50 €         │
├─────────────────────────────────────────┤
│ + Imprevistos (5%)      159.00 €        │
│ = Coste con imprev.   3,339.00 €        │
├─────────────────────────────────────────┤
│ Margen objetivo (25%)   834.75 €        │
├─────────────────────────────────────────┤
│ PVP TOTAL             4,173.75 €        │
│ PVP/pax                  34.78 €        │
└─────────────────────────────────────────┘
```

### 3.2 Campos configurables
```typescript
interface MargenConfig {
  pct_imprevistos: number;    // % imprevistos (ej: 5)
  pct_margen: number;         // % margen deseado (ej: 25)
  coste_personal: number;     // Coste fijo personal
  coste_equipamiento: number; // Coste alquiler equipos
  coste_otros: number;        // Transporte, limpieza, etc.
}
```

### 3.3 Cálculos
```typescript
const coste_alimentos = escandallo.ingredientes_total;
const coste_bebidas = motor_bebidas.total;
const coste_personal = config.coste_personal;
const coste_equipamiento = config.coste_equipamiento;

const subtotal = coste_alimentos + coste_bebidas + coste_personal + coste_equipamiento;
const imprevistos = subtotal * (config.pct_imprevistos / 100);
const coste_total = subtotal + imprevistos;
const margen = coste_total * (config.pct_margen / 100);
const pvp_total = coste_total + margen;
const pvp_pax = pvp_total / pax;
```

---

## 4. Base de Datos

### Nueva tabla: `event_drink_config`
```sql
CREATE TABLE event_drink_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id),
  pct_bebedores NUMERIC DEFAULT 60,
  bebidas_por_persona NUMERIC DEFAULT 2.5,
  pct_cerveza NUMERIC DEFAULT 30,
  pct_vino NUMERIC DEFAULT 50,
  pct_refresco NUMERIC DEFAULT 15,
  pct_agua NUMERIC DEFAULT 5,
  cafe_por_persona BOOLEAN DEFAULT true,
  hielo_por_persona NUMERIC DEFAULT 0.5,
  -- Margen
  pct_imprevistos NUMERIC DEFAULT 5,
  pct_margen NUMERIC DEFAULT 25,
  coste_personal NUMERIC DEFAULT 0,
  coste_equipamiento NUMERIC DEFAULT 0,
  coste_otros NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Nueva tabla: `drink_products` (catálogo configurable)
```sql
CREATE TABLE drink_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL, -- vino, cerveza, refresco, agua, cafe, hielo
  nombre TEXT NOT NULL,
  unidad TEXT NOT NULL, -- botella, caja, lata, saco
  unidades_por_paquete NUMERIC NOT NULL, -- ej: botella=6copas, caja=20latas
  coste_unitario NUMERIC NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. API Endpoints

```
GET    /api/escandallo/[eventId]/bebidas     — Config + cálculo bebidas
PUT    /api/escandallo/[eventId]/bebidas     — Guardar config bebidas
GET    /api/escandallo/[eventId]/margen      — Config + cálculo margen/PVP
PUT    /api/escandallo/[eventId]/margen      — Guardar config margen
GET    /api/drink-products                   — Catálogo productos bebida
POST   /api/drink-products                   — Crear producto
PUT    /api/drink-products/[id]              — Actualizar producto
```

---

## 6. UI Components

### 6.1 DrinkCalculator (en Escandallo)
- Panel colapsable "Motor de Bebidas"
- Sliders para % bebedores, consumiciones
- Botones +/- para distribución cerveza/vino/refresco/agua
- Resultado: tabla con productos calculados
- Total bebidas añadido al escandallo

### 6.2 MarginPanel (en Escandallo)
- Panel fijo en sidebar o parte inferior
- Campos editables: imprevistos, margen, personal, equipo
- Resultado en vivo: PVP/pax y PVP total
- Indicador visual de rentabilidad (rojo/amarillo/verde)

---

## 7. Integración con Flujo Existente

```
Escandallo Evento
    │
    ├─→ Ingredientes × pax (ya existe)
    │
    ├─→ [NUEVO] Motor de Bebidas
    │         ↓
    │    Bebidas calculadas
    │         ↓
    │    Total Bebidas
    │
    └─→ [NUEVO] Panel Margen
              ↓
         Coste + Imprevistos + Margen
              ↓
         PVP/pax
```

---

## 8. Implementación

### Fase 1: Tablas DB
- Crear `event_drink_config`
- Crear `drink_products` con datos iniciales

### Fase 2: APIs
- CRUD config bebidas
- CRUD config margen
- Catálogo productos

### Fase 3: UI
- DrinkCalculator component
- MarginPanel component
- Integración en página Escandallos

### Fase 4: Testing
- Tests de cálculo de bebidas
- Tests de margen/PVP
