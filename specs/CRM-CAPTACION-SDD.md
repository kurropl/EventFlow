# SDD: CRM de Captación — EventFlow

## 1. Contexto y Análisis

### Estado Actual
- **165 leads** existentes con estados: nuevo, perdido, presupuestado
- **6 clients** en tabla clients
- **5 quotes** con presupuestos
- APIs completas: `/api/leads`, `/api/clients`, `/api/quotes`
- **Páginas vacías**: leads, kanban, clientes re-exportan admin page

### Problema
- No hay vista funcional del CRM
- Los leads no se pueden gestionar visualmente
- No hay pipeline de ventas (Kanban)
- No hay tracking de interacciones

### Objetivo
Crear un CRM completo que:
1. Capture leads de la web (formulario contacto, configurador)
2. Gestione el pipeline de ventas (Kanban)
3. Permita follow-up y tracking
4. Convierta leads en clientes
5. Genere presupuestos desde el lead

---

## 2. Flujo CRM Completo

```
┌─────────────────────────────────────────────────────────────────┐
│                        FLUJO CRM                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │  LEAD    │───▶│ CONTACTO │───▶│PRESUPUEST│───▶│ CLIENTE  │  │
│  │  NUEVO   │    │  ACTIVO  │    │  ENVIADO │    │ CONFIRMADO│  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│       │              │               │               │          │
│       ▼              ▼               ▼               ▼          │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │ PERDIDO  │    │ SEGUIMTO │    │ RECHAZADO│    │  EVENTO  │  │
│  │          │    │          │    │          │    │          │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Estados del Lead
```typescript
type LeadStatus = 
  | 'nuevo'           // Recién llegado, sin contactar
  | 'contactado'      // Primer contacto realizado
  | 'interesado'      // Mostró interés, pendiente info
  | 'presupuestado'   // Presupuesto enviado
  | 'negociacion'     // En discusión de precio/condiciones
  | 'confirmado'      // Aceptó presupuesto → cliente
  | 'perdido'         // No contrató
  | 'descartado';     // No cualificado
```

### Fuentes de Leads
```typescript
type LeadSource = 
  | 'web_form'        // Formulario de contacto web
  | 'configurador'    // Configurador de presupuesto
  | 'telefono'        // Llamada telefónica
  | 'email'           // Email directo
  | 'referido'        // Recomendado por cliente
  | 'redes_sociales'  // Instagram, Facebook, etc.
  | 'eventos'         // Ferias, eventos
  | 'manual';         // Captación manual
```

---

## 3. Vistas del CRM

### 3.1 Pipeline Kanban (`/admin/kanban`)
Vista tipo Trello con columnas por estado:
```
┌─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐
│  NUEVO  │CONTACTADO│ INTERES │PRESUP.  │NEGOCIAC │CONFIRMAD│
├─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│ [card]  │ [card]  │         │ [card]  │ [card]  │ [card]  │
│ [card]  │         │ [card]  │         │         │         │
│         │ [card]  │         │ [card]  │         │         │
└─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘
```

**Card info:**
- Nombre del lead
- Tipo de evento + fecha
- Nº personas
- Última interacción
- Avatar del asignado

**Acciones:**
- Arrastrar entre columnas
- Click → ver detalle
- Botón "+" → nuevo lead

### 3.2 Lista de Leads (`/admin/leads`)
Vista de tabla con filtros y búsqueda:

**Filtros:**
- Estado
- Fuente
- Asignado a
- Rango fechas
- Tipo de evento

**Columnas:**
- Nombre + email
- Fuente (badge)
- Estado (badge color)
- Evento
- Personas
- Última interacción
- Asignado
- Acciones (ver, editar, eliminar)

### 3.3 Detalle del Lead (Modal o Panel)
Al hacer click en un lead:

**Información básica:**
- Nombre, email, teléfono
- Fuente del lead
- Estado actual (dropdown para cambiar)
- Asignado a (dropdown)

**Datos del evento:**
- Tipo de evento
- Fecha
- Nº personas
- Presupuesto estimado

**Historial de interacciones:**
```
28/07/2026 10:30 - María García
📞 Llamada telefónica
"Interesada en boda para 120 personas en septiembre"

27/07/2026 15:45 - Sistema
📧 Email de bienvenida enviado
Template: confirmación_receipt

27/07/2026 15:45 - Sistema
🎯 Lead creado desde formulario web
```

**Acciones rápidas:**
- [📞 Llamar] [📧 Email] [📋 Presupuesto] [✅ Convertir]
- [❌ Perder] [🗑️ Eliminar]

### 3.4 Lista de Clientes (`/admin/clientes`)
Vista de tabla de clientes convertidos:

**Columnas:**
- Nombre + email
- Empresa
- Nº eventos
- Valor total
- Último evento
- Tags
- Acciones

**Panel lateral:**
- Ficha completa del cliente
- Historial de eventos
- Presupuestos anteriores

---

## 4. Base de Datos

### Nueva tabla: `lead_interactions`
```sql
CREATE TABLE lead_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL, -- call, email, meeting, note, status_change
  subject TEXT,
  description TEXT,
  created_by UUID REFERENCES admins(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_interactions_lead ON lead_interactions(lead_id);
```

### Mejoras a tabla `leads`
```sql
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_follow_up TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS budget_estimate NUMERIC;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal'; -- baja, normal, alta, urgente
```

---

## 5. API Endpoints

### Leads
```
GET    /api/leads                    — Listar leads (filtros: status, source, search)
POST   /api/leads                    — Crear lead
GET    /api/leads/[id]               — Detalle lead + interacciones
PUT    /api/leads/[id]               — Actualizar lead
DELETE /api/leads/[id]               — Eliminar lead
PATCH  /api/leads/[id]/status        — Cambiar estado (trigger interacción)
POST   /api/leads/[id]/interactions  — Añadir interacción
```

### Clients
```
GET    /api/clients                  — Listar clientes
POST   /api/clients                  — Crear/upsert cliente
GET    /api/clients/[id]             — Detalle cliente + eventos
PUT    /api/clients/[id]             — Actualizar cliente
```

### Conversión Lead → Cliente
```
POST   /api/leads/[id]/convert       — Convertir lead a cliente
```

---

## 6. UI Components

### LeadCard (Kanban)
```tsx
<LeadCard
  lead={lead}
  onClick={() => openDetail(lead)}
  onDragStart={() => startDrag(lead)}
/>
```

### LeadDetail (Modal)
```tsx
<LeadDetail
  lead={lead}
  interactions={interactions}
  onStatusChange={handleStatusChange}
  onAddInteraction={handleAddInteraction}
  onConvert={handleConvert}
/>
```

### InteractionForm
```tsx
<InteractionForm
  leadId={lead.id}
  onSubmit={handleAddInteraction}
/>
```

---

## 7. Implementación

### Fase 1: Base de Datos
- Crear tabla `lead_interactions`
- Añadir columnas a `leads`

### Fase 2: APIs
- CRUD leads mejorado
- API interacciones
- API conversión lead → cliente

### Fase 3: Página Kanban
- Vista pipeline con drag & drop
- Cards informativas
- Modal detalle lead

### Fase 4: Página Leads
- Tabla con filtros
- Búsqueda
- Acciones rápidas

### Fase 5: Página Clientes
- Tabla de clientes
- Panel detalle
- Historial de eventos

---

## 8. Integración Web

### Formulario de Contacto → Lead
Cuando un usuario envía el formulario de contacto:
1. Crear lead automáticamente
2. Asignar fuente `web_form`
3. Enviar email de confirmación
4. Notificar al equipo

### Configurador → Lead
Cuando alguien usa el configurador:
1. Crear lead con datos del evento
2. Asignar fuente `configurador`
3. Guardar presupuesto estimado
4. Email con presupuesto provisional

---

## 9. Métricas CRM

### Dashboard KPIs
- Leads nuevos (este mes)
- Tasa de conversión (leads → clientes)
- Tiempo medio de conversión
- Leads por fuente
- Pipeline value (suma presupuestos activos)
