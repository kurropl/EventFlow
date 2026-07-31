# SDD: Módulo Staffing y Recursos Humanos — EventFlow

## 1. Contexto y Análisis

### Estado Actual
- **5 workers** existentes con roles básicos
- **8 staffing lines** para eventos
- **7 offers** enviadas
- **2 pagos** registrados
- APIs completas: workers, staffing_lines, offers, payroll
- **Páginas vacías**: staffing y workers re-exportan admin page

### Objetivo
Crear un módulo de RRHH completo que incluya:
1. **Gestión de empleados** (contrato fijo, temporal, por horas)
2. **Control de nóminas y pagos** (qué se paga, qué no)
3. **Disponibilidad y calendario**
4. **Lista de difusión WhatsApp** por evento
5. **Historial de trabajos** por empleado

---

## 2. Estructura de Datos

### 2.1 Tipos de Contrato
```typescript
type ContractType = 
  | 'indefinido'      // Contrato indefinido (nómina mensual)
  | 'temporal'        // Contrato temporal
  | 'por_horas'       // Sin contrato fijo, cobra por horas
  | 'autonomo';       // Autónomo (factura)
```

### 2.2 Estados del Trabajador
```typescript
type WorkerStatus = 
  | 'activo'          // Disponible para trabajar
  | 'baja_temporal'   // Baja médica, vacaciones
  | 'baja_definitiva' // Ha dejado la empresa
  | 'pendiente';      // Alta pendiente de documentación
```

### 2.3 Estructura Worker Mejorada
```sql
ALTER TABLE workers ADD COLUMN IF NOT EXISTS contract_type text DEFAULT 'por_horas';
ALTER TABLE workers ADD COLUMN IF NOT EXISTS status text DEFAULT 'activo';
ALTER TABLE workers ADD COLUMN IF NOT EXISTS hourly_rate numeric;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS monthly_salary numeric;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS social_security_number text;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS id_number text;  -- DNI/NIE
ALTER TABLE workers ADD COLUMN IF NOT EXISTS birth_date date;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS emergency_contact text;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS emergency_phone text;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS bank_account text;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS photo_url text;
```

### 2.4 Tabla de Horas Trabajadas
```sql
CREATE TABLE IF NOT EXISTS work_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES workers(id),
  event_id uuid REFERENCES events(id),
  date date NOT NULL,
  start_time time,
  end_time time,
  hours numeric NOT NULL,
  hourly_rate numeric NOT NULL,
  total_pay numeric NOT NULL,
  status text DEFAULT 'pending',  -- pending, approved, paid
  notes text,
  created_at timestamptz DEFAULT NOW()
);
```

### 2.5 Tabla de Nómina
```sql
CREATE TABLE IF NOT EXISTS payroll (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES workers(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  base_salary numeric DEFAULT 0,
  overtime_hours numeric DEFAULT 0,
  overtime_pay numeric DEFAULT 0,
  bonuses numeric DEFAULT 0,
  deductions numeric DEFAULT 0,
  tax_deduction numeric DEFAULT 0,
  social_security_deduction numeric DEFAULT 0,
  net_pay numeric NOT NULL,
  status text DEFAULT 'draft',  -- draft, approved, paid
  paid_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT NOW()
);
```

---

## 3. Vistas del Módulo

### 3.1 Panel Principal (`/admin/staffing`)
Dashboard con KPIs y acceso rápido:

```
┌─────────────────────────────────────────────────────────────────┐
│                    STAFFING DASHBOARD                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ Empleados│ │ Disponib │ │ Próximos │ │ Nómina   │          │
│  │    12    │ │    8     │ │ Eventos  │ │  Pend.   │          │
│  │ activos  │ │ esta sem │ │    3     │ │ 2,450€   │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│                                                                  │
│  ┌────────────────────────┐ ┌────────────────────────┐         │
│  │ PRÓXIMOS EVENTOS       │ │ ACCESO RÁPIDO          │         │
│ │ Boda García - 15 sep   │ │ [+ Nuevo empleado]     │         │
│ │ 4 camareros needed     │ │ [📋 Nómina]            │         │
│ │ 2 confirmados          │ │ [📱 WhatsApp lista]    │         │
│ │ 2 pendientes           │ │ [📊 Horas trabajadas]  │         │
│ └────────────────────────┘ └────────────────────────┘         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Lista de Empleados (`/admin/staffing/workers`)

**Tabla principal:**
| Foto | Nombre | Teléfono | Contrato | Estado | Rol | Tarifa | Acciones |
|------|--------|----------|----------|--------|-----|--------|----------|
| 👤 | Pedro Sánchez | 600... | Indefinido | ✅ Activo | Camarero | 12€/h | ✏️ 📋 📱 |
| 👤 | Laura García | 612... | Por horas | ✅ Activo | Camarero | 10€/h | ✏️ 📋 📱 |

**Filtros:**
- Estado (activo, baja, pendiente)
- Tipo contrato
- Rol
- Disponibilidad

**Panel detalle (al hacer click):**
- Datos personales completos
- Documentos (contrato, DNI)
- Historial de eventos
- Horas trabajadas
- Pagos realizados
- Disponibilidad semanal

### 3.3 Control de Nómina (`/admin/staffing/payroll`)

**Vista mensual:**
```
NÓMINA SEPTIEMBRE 2026
┌─────────────────────────────────────────────────────────────────┐
│ Empleado      │ Base   │ Horas ext │ Bonus  │ Deds   │ Neto   │
├─────────────────────────────────────────────────────────────────┤
│ Pedro Sánchez │ 1,800€ │  120€     │  50€   │ -280€  │ 1,690€ │
│ Laura García  │    -   │  320€     │   0€   │  -64€  │  256€  │
│ María López   │ 1,600€ │   80€     │ 100€   │ -256€  │ 1,524€ │
├─────────────────────────────────────────────────────────────────┤
│ TOTAL PLANILLA:                           │        │ 3,470€   │
└─────────────────────────────────────────────────────────────────┘
```

**Funciones:**
- Generar nómina mensual automáticamente
- Exportar PDF
- Marcar como pagada
- Historial de nóminas

### 3.4 Lista de Difusión WhatsApp

**Envío masivo por evento:**
```
┌─────────────────────────────────────────────────────────────────┐
│ LISTA DE DIFUSIÓN - Boda García (15 Septiembre)                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Seleccionar destinatarios:                                      │
│ ☑ Pedro Sánchez (600 123 456) - Camarero                       │
│ ☑ Laura García (612 789 012) - Camarero                        │
│ ☑ María López (623 345 678) - Camarero/Metre                   │
│ ☐ Carlos Ruiz (634 567 890) - Camarero/Cocinero                │
│                                                                  │
│ Mensaje:                                                        │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 📋 Evento: Boda García                                      │ │
│ │ 📅 Fecha: 15 Septiembre 2026                                │ │
│ │ 🕐 Horario: 18:00 - 23:00                                   │ │
│ │ 👥 Personas: 120                                             │ │
│ │                                                              │ │
│ │ ¿Estás disponible? Responde SÍ o NO                         │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ [📱 Enviar WhatsApp] [📋 Copiar mensaje]                        │
│                                                                  │
│ Respuestas recibidas:                                           │
│ ✅ Pedro Sánchez - SÍ (hace 5 min)                              │
│ ✅ Laura García - SÍ (hace 12 min)                              │
│ ⏳ María López - Pendiente                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. API Endpoints

### Workers
```
GET    /api/staffing/workers              — Listar trabajadores
POST   /api/staffing/workers              — Crear trabajador
GET    /api/staffing/workers/[id]         — Detalle trabajador
PUT    /api/staffing/workers/[id]         — Actualizar trabajador
DELETE /api/staffing/workers/[id]         — Eliminar trabajador
POST   /api/staffing/workers/[id]/contract — Subir contrato
```

### Horas Trabajadas
```
GET    /api/staffing/hours                — Listar horas (filtros: worker_id, date range)
POST   /api/staffing/hours                — Registrar horas
PUT    /api/staffing/hours/[id]           — Actualizar horas
DELETE /api/staffing/hours/[id]           — Eliminar registro
```

### Nómina
```
GET    /api/staffing/payroll              — Listar nóminas
POST   /api/staffing/payroll              — Generar nómina mensual
PUT    /api/staffing/payroll/[id]         — Actualizar nómina
POST   /api/staffing/payroll/[id]/pay     — Marcar como pagada
```

### WhatsApp
```
POST   /api/staffing/whatsapp/broadcast   — Enviar mensaje masivo
GET    /api/staffing/whatsapp/responses   — Ver respuestas
```

---

## 5. UI Components

### WorkerCard
```tsx
<WorkerCard
  worker={worker}
  onClick={() => openDetail(worker)}
  onWhatsApp={() => sendWhatsApp(worker)}
/>
```

### WorkerDetail (Modal)
```tsx
<WorkerDetail
  worker={worker}
  events={workerEvents}
  hours={workerHours}
  payroll={workerPayroll}
  onUpdate={handleUpdate}
/>
```

### PayrollTable
```tsx
<PayrollTable
  period={currentPeriod}
  employees={employees}
  onGenerate={handleGenerate}
  onPay={handlePay}
/>
```

### WhatsAppBroadcast
```tsx
<WhatsAppBroadcast
  event={selectedEvent}
  workers={availableWorkers}
  onSend={handleSend}
  responses={responses}
/>
```

---

## 6. Implementación

### Fase 1: Base de Datos
- Añadir columnas a `workers`
- Crear tabla `work_hours`
- Crear tabla `payroll`

### Fase 2: APIs Workers
- CRUD completo con filtros
- Upload contrato
- Disponibilidad

### Fase 3: APIs Horas y Nómina
- Registro de horas
- Generación automática nómina
- Marcar pagos

### Fase 4: Página Dashboard
- KPIs principales
- Próximos eventos
- Accesos rápidos

### Fase 5: Página Workers
- Lista con filtros
- Panel detalle
- Formulario crear/editar

### Fase 6: Página Nómina
- Vista mensual
- Generar/exportar
- Historial

### Fase 7: WhatsApp Broadcast
- Selección destinatarios
- Envío masivo
- Tracking respuestas

---

## 7. Lógica de Negocio

### Cálculo Automático Nómina
```typescript
function calculatePayroll(worker, hours, period) {
  if (worker.contract_type === 'indefinido' || worker.contract_type === 'temporal') {
    // Nómina fija + horas extra
    const base = worker.monthly_salary;
    const overtime = calculateOvertime(hours, worker.hourly_rate);
    return { base, overtime, total: base + overtime };
  } else {
    // Solo horas trabajadas
    const total = hours.reduce((sum, h) => sum + h.total_pay, 0);
    return { base: 0, overtime: 0, total };
  }
}
```

### Detección de Disponibilidad
```typescript
function checkAvailability(worker, date, startTime, endTime) {
  // Check if worker has any conflicting events
  // Check if worker is on leave
  // Check worker's declared availability
}
```
