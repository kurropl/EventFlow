# Análisis Comparativo: EventFlow vs Odoo — Gap Analysis

> **Objetivo**: Identificar funcionalidades que Odoo ofrece y EventFlow no tiene, así como mejoras de UX que elevarían el panel al nivel de un ERP profesional.

---

## 1. MAPA DE MÓDULOS — EventFlow vs Odoo

| Módulo Odoo | Equivalente EventFlow | Cobertura |
|---|---|---|
| **CRM** | LeadsCRM + KanbanPipeline | ~60% |
| **Ventas / Presupuestos** | KanbanPipeline + LeadsCRM (quotes) | ~50% |
| **Facturación / Contabilidad** | BillingPanel | ~30% |
| **Inventario** | StockManager | ~40% |
| **RRHH / Personal** | StaffingManager | ~35% |
| **Compras** | ProvidersManager + Stock orders | ~25% |
| **Calendario / Planificación** | CalendarView | ~45% |
| **Proyectos / Tareas** | ChecklistPanel / DiaDChecklist | ~20% |
| **Sitio Web / Configurador** | Landing + Configurador B2C | ~55% |
| **Email Marketing** | email.ts (básico) | ~10% |
| **Encuestas / Satisfacción** | ❌ No existe | 0% |
| **Punto de Venta** | ❌ No existe | 0% |
| **Helpdesk / Soporte** | ❌ No existe | 0% |
| **Mensajería Interna** | ❌ No existe | 0% |
| **Automatización avanzada** | WebhooksPanel (básico) | ~15% |
| **Reporting / BI** | DashboardOverview (básico) | ~25% |

---

## 2. GAPS CRÍTICOS — Funciones que Odoo tiene y EventFlow no

### 🔴 ALTA PRIORIDAD (impacto directo en operación diaria)

#### 2.1 **Gestión de Compras (Purchase)**
Odoo tiene un módulo completo de compras con:
- **Órdenes de compra** con workflow: borrador → enviada → recibida → facturada
- **Solicitud de cotización (RFQ)** a múltiples proveedores
- **Recepción de mercancía** con albaranes (delivery receipts)
- **Matching de 3 vías**: orden compra ↔ recepción ↔ factura
- **Reglas de reordenamiento** automáticas basadas en stock mínimo
- **Historial de precios** por proveedor

**EventFlow actual**: Solo tiene "Pedidos a proveedores" con estados básicos, sin RFQ, sin matching, sin historial de precios.

#### 2.2 **Contabilidad completa**
Odoo tiene:
- **Plan contable** (chart of accounts) completo
- **Asientos contables** automáticos al facturar/pagar
- **Diarios** (ventas, compras, banco, efectivo)
- **Conciliación bancaria**
- **Balance de situación**, cuenta de pérdidas y ganancias
- **Modelo 110/115** (IVA trimestral)
- **Retenciones** de profesionales
- **Amortizaciones**

**EventFlow actual**: Solo tiene tabla de pagos e invoices con IVA. Sin plan contable, sin asientos, sin conciliación, sin modelos fiscales.

#### 2.3 **Gestión de Empleados (HR)**
Odoo tiene:
- **Ficha completa del empleado**: contrato, salario bruto/neto, fecha alta/baja
- **Nómina** automática con cotizaciones SS + IRPF
- **Calendarización de turnos** (shift planning)
- **Control de horario** (check-in/check-out)
- **Ausencias** (vacaciones, baja médica, permisos)
- **Gastos de viaje** (dietas, km)
- **Evaluaciones de desempeño**

**EventFlow actual**: Workers CRUD básico + staffing lines por evento + payroll manual. Sin nómina automática, sin control horario, sin ausencias.

#### 2.4 **Automatización avanzada (Studio/Actions)**
Odoo tiene:
- **Server actions**: acciones automáticas al crear/modificar registros
- **Automated actions**: triggers condicionales (cuando X cambia → hacer Y)
- **Scheduled actions**: cron jobs configurables desde UI
- **Email templates** con variables dinámicas
- **Approved by** workflows (aprobación en cascada)
- **Chatter**: historial de actividad en cada registro

**EventFlow actual**: 4 cron jobs hardcodeados + webhooks básicos + email_queue. Sin server actions, sin templates editables, sin chatter.

### 🟡 MEDIA PRIORIDAD (mejoras de UX/productividad)

#### 2.5 **Chatter / Historial de actividad**
En Odoo, cada registro (presupuesto, cliente, evento) tiene un **chatter** abajo:
- Comentarios internos del equipo
- Historial automático de cambios ("Juan cambió el estado de Borrador a Enviado")
- Menciones @usuario
- Adjuntos (fotos, documentos)
- Seguimiento de actividad

**EventFlow actual**: Solo tiene `audit_log` en la DB, sin UI visible.

#### 2.6 **Reporting / Dashboards personalizables**
Odoo tiene:
- **Pivots** (tablas dinámicas) arrastrando campos
- **Gráficos** con múltiples tipos (barras, líneas, pie)
- **Kanban** personalizable
- **Dashboards** con filtros guardados
- **Exportación** a Excel/PDF
- **Scheduled reports** por email

**EventFlow actual**: 4 métricas fijas en Dashboard + 3 gráficos hardcodeados. Sin pivot, sin export, sin reportes programados.

#### 2.7 **Plantillas de email**
Odoo tiene:
- **Editor visual** de plantillas HTML
- **Variables dinámicas**: {{ client_name }}, {{ event_date }}, etc.
- **Preview** antes de enviar
- **Historial de envíos** por registro
- **Mass mailing** con segmentación

**EventFlow actual**: `sendLeadCreatedEmail` y `sendQuoteSentEmail` hardcodeados. Sin editor, sin preview, sin historial por registro.

#### 2.8 **Formulario de contacto / Landing page builder**
Odoo Website Builder permite:
- **Arrastrar y soltar** secciones, bloques de texto, imágenes
- **Formularios** que crean leads automáticamente
- **A/B testing** de páginas
- **SEO** automático (meta tags, sitemap)
- **Chat en vivo** integrado

**EventFlow actual**: Landing page estática + configurador B2C. Sin editor visual, sin A/B testing, sin SEO automático.

#### 2.9 **Gestión de proveedores (Vendor Portal)**
Odoo tiene:
- **Portal de proveedores**: cada proveedor ve sus pedidos pendientes
- **Confirmación de entrega** desde el portal
- **Catálogo compartido** con precios negociados
- **Rating de proveedores** por calidad/tiempo

**EventFlow actual**: Tabla básica de proveedores sin portal, sin confirmación, sin rating.

### 🟢 BAJA PRIORIDAD (nice-to-have)

#### 2.10 **Encuestas de satisfacción**
- Post-evento: enviar encuesta NPS/CSAT
- Dashboard de satisfacción
- Alertas por bajas puntuaciones

#### 2.11 **Marketing automation**
- Secuencias de email (lead nurturing)
- Segmentación de clientes
- Campañas de WhatsApp masivo
- Tracking de aperturas/clics

#### 2.12 **Punto de Venta (POS)**
- Terminal de cobro en el salón
- Ticket de venta rápido
- Cobro con tarjeta/efectivo
- Sync con inventario

#### 2.13 **Multidioma / Multi-moneda**
- Soporte para español + inglés
- Precios en EUR + GBP (clientes internacionales)

---

## 3. MEJORAS DE UX IDENTIFICADAS

### 3.1 **Formularios inline vs modales**
- **Odoo**: Usa formularios inline o panels laterales (drawer) para editar
- **EventFlow**: Usa modales superpuestos para todo
- **Mejora**: Adoptar drawers laterales (como ClientsCRM ya hace) para consistencia

### 3.2 **Vista Kanban en todas las listas**
- **Odoo**: Toda lista puede alternar entre vista lista, kanban, calendario, gráfico
- **EventFlow**: Solo KanbanPipeline tiene vista kanban
- **Mejora**: Añadir toggle de vista (lista/kanban) en Leads, Stock, Staffing

### 3.3 **Búsqueda global**
- **Odoo**: Barra de búsqueda global que busca en TODOS los módulos
- **EventFlow**: Cada módulo tiene su propia búsqueda aislada
- **Mejora**: Añadir Ctrl+K search global (command palette)

### 3.4 **Drag & Drop universal**
- **Odoo**: Casi todo es draggable (columnas kanban, campos de formulario, listas)
- **EventFlow**: Solo el pipeline y el mapa de mesas son drag&drop
- **Mejora**: Hacer draggable el orden de catálogo, las tareas del checklist, las líneas de staffing

### 3.5 **Notificaciones en tiempo real**
- **Odoo**: In-app notifications + push
- **EventFlow**: Sin notificaciones in-app
- **Mejora**: Añadir bell icon con notificaciones (pagos vencidos, eventos próximos, ofertas aceptadas)

### 3.6 **Quick actions / Command palette**
- **Odoo**: Ctrl+K abre command palette para crear cualquier cosa rápido
- **EventFlow**: Sin atajos de teclado
- **Mejora**: Implementar command palette (create event, add lead, new invoice, etc.)

---

## 4. PRIORIDADES RECOMENDADAS

### Sprint 1 — Compras + Albaranes (2 semanas)
- Workflow de compra: borrador → enviada → recibida → facturada
- Matching de 3 vías
- Historial de precios por proveedor
- Albaranes de recepción

### Sprint 2 — Contabilidad básica (2 semanas)
- Asientos automáticos al facturar
- Diarios (ventas, banco)
- Balance simplificado
- Exportación a Excel

### Sprint 3 — Chatter + Notificaciones (1 semana)
- Historial de actividad por registro
- Notificaciones in-app
- @menciones en comentarios

### Sprint 4 — HR avanzado (2 semanas)
- Control horario (check-in/out)
- Ausencias (vacaciones, bajas)
- Nómina automática con SS + IRPF

### Sprint 5 — Reporting + Command Palette (1 semana)
- Pivots y gráficos configurables
- Exportación Excel/PDF
- Ctrl+K command palette

---

## 5. CONCLUSIÓN

**EventFlow tiene un admin sólido para el uso específico de un salón de celebraciones**, con funcionalidades que Odoo no tiene de serie (configurador B2C, mapa de mesas, escandallos de cocina, checklist día D). 

Sin embargo, **le faltan capas de gestión que un ERP profesional ofrece**:
- **Contabilidad real** (no solo pagos)
- **Compras con workflow** (no solo pedidos)
- **HR con nómina automática**
- **Automatización configurable** (no solo 4 crons hardcodeados)
- **Chatter/historial** (audit_log existe pero no tiene UI)

**La estrategia recomendada** es priorizar lo que más impacta en la operación diaria: Compras + Contabilidad son los gaps más sentidos, seguidos de HR avanzado.
