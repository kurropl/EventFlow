# EventFlow — Resumen Completo de Funcionalidades

## 📋 Descripción General

**EventFlow** es un ERP/CRM integral diseñado específicamente para empresas de **catering y salones de celebraciones**. Desarrollado con Next.js + TypeScript + PostgreSQL, ofrece una solución completa para gestionar todo el ciclo de vida de un evento: desde la captación del cliente hasta la trazabilidad sanitaria post-evento.

**URL:** https://eventcater.duckdns.org
**Stack:** Next.js 14, TypeScript, PostgreSQL, Docker, Tailwind CSS

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EVENTFLOW - MÓDULOS                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  CAPTACIÓN   │  │ PLANIFICACIÓN │  │    SALA      │  │   COCINA     │    │
│  │  (CRM)       │  │  (Eventos)    │  │  (Mesas)     │  │  (Producción)│    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  STAFFING    │  │  FINANZAS    │  │ INVENTARIO   │  │   CONFIG     │    │
│  │  (RRHH)      │  │  (Facturación)│ │  (Stock)     │  │  (Sistema)   │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 MÓDULO 1: CAPTACIÓN (CRM)

### 1.1 Gestión de Leads
**Ruta:** `/admin/leads`

| Funcionalidad | Descripción |
|---------------|-------------|
| **Lista de leads** | Vista de tabla con búsqueda y filtros por estado/fuente |
| **Crear lead** | Formulario con nombre, email, teléfono, fuente, tipo evento |
| **Editar lead** | Modificar todos los campos del lead |
| **Eliminar lead** | Borrado lógico del lead |
| **Cambio de estado** | Actualización rápida desde la tabla |
| **KPIs** | Total leads, nuevos, presupuestados, confirmados, tasa conversión |

**Estados del lead:**
- `nuevo` → `contactado` → `interesado` → `presupuestado` → `negociacion` → `confirmado`
- `perdido` / `descartado`

**Fuentes de leads:**
- Web, Configurador, Teléfono, Email, Referido, Redes Sociales, Manual

### 1.2 Pipeline Kanban
**Ruta:** `/admin/kanban`

| Funcionalidad | Descripción |
|---------------|-------------|
| **Vista Kanban** | 6 columnas por estado del lead |
| **Drag & drop** | Arrastrar leads entre columnas para cambiar estado |
| **Cards informativas** | Nombre, evento, personas, fecha, presupuestos |
| **Detalle lead** | Panel lateral con info completa + historial interacciones |
| **Crear lead rápido** | Botón "+" para nuevo lead desde el pipeline |

### 1.3 Gestión de Clientes
**Ruta:** `/admin/clientes`

| Funcionalidad | Descripción |
|---------------|-------------|
| **Lista de clientes** | Vista de tabla con búsqueda |
| **Ficha cliente** | Datos personales, empresa, eventos, valor total |
| **Crear/editar cliente** | Formulario CRUD completo |
| **Historial** | Eventos realizados y valor total por cliente |

### 1.4 Interacciones
| Funcionalidad | Descripción |
|---------------|-------------|
| **Registrar interacción** | Nota, llamada, email, reunión |
| **Historial por lead** | Timeline de todas las interacciones |
| **Automático** | Se registra al cambiar estado del lead |

---

## 📅 MÓDULO 2: PLANIFICACIÓN

### 2.1 Gestión de Eventos
**Ruta:** `/admin/evento`

| Funcionalidad | Descripción |
|---------------|-------------|
| **Crear evento** | Formulario completo con datos del evento |
| **Editar evento** | Modificar todos los campos |
| **Estados del evento** | `nuevo` → `propuesta_enviada` → `confirmado` → `en_curso` → `completado` |
| **Tipo de venue** | `benitez` (salón propio) / `externo` (catering fuera) |
| **Datos del cliente** | Vinculación con lead/cliente |

### 2.2 Agenda
**Ruta:** `/admin/agenda`

| Funcionalidad | Descripción |
|---------------|-------------|
| **Vista calendario** | Eventos en formato calendario |
| **Fechas de eventos** | Pruebas de menú, reuniones, eventos |
| **Filtros** | Por tipo de evento, estado |

### 2.3 Configurador Web
**Ruta:** `/configurador`

| Funcionalidad | Descripción |
|---------------|-------------|
| **Formulario público** | Clientes pueden solicitar presupuesto online |
| **Creación automática** | Genera lead automáticamente |
| **Email confirmación** | Envío automático al cliente |

---

## 🍽 MÓDULO 3: SALA

### 3.1 Catálogo de Platos
**Ruta:** `/admin/catalog`

| Funcionalidad | Descripción |
|---------------|-------------|
| **CRUD platos** | Crear, editar, eliminar platos |
| **Categorías** | 10 categorías de platos |
| **PVP/Coste** | Precio de venta y coste por plato |
| **Margen** | Cálculo automático de margen |
| **Estado** | Activo/inactivo |

### 3.2 Mapa de Mesas
**Ruta:** `/admin/mapa-mesas`

| Funcionalidad | Descripción |
|---------------|-------------|
| **Editor visual** | Arrastrar y posicionar mesas |
| **Distribución** | Configurar capacidad del salón |
| **Plano del salón** | Representación visual del espacio |
| **Asignación** | Asignar invitados a mesas |

### 3.3 Ocupación
**Ruta:** `/admin/ocupacion`

| Funcionalidad | Descripción |
|---------------|-------------|
| **Estado mesas** | Tiempo real de ocupación |
| **Control de servicio** | Estado de cada mesa |

### 3.4 Invitados
**Ruta:** `/admin/invitados`

| Funcionalidad | Descripción |
|---------------|-------------|
| **RSVP** | Confirmación de asistencia |
| **Dietas** | Restricciones alimentarias |
| **Formulario público** | Los invitados confirman online |

---

## 🍳 MÓDULO 4: COCINA

### 4.1 Panel Principal
**Ruta:** `/admin/cocina`

| KPI | Descripción |
|-----|-------------|
| **Recetas activas** | Total de platos en catálogo |
| **Escandallos del mes** | Eventos costeados |
| **Alertas stock** | Ingredientes por debajo del mínimo |
| **Eventos próximos** | Próximos 7 días |

### 4.2 Recetas (Catálogo de Platos)
**Ruta:** `/admin/cocina/recetas`

| Funcionalidad | Descripción |
|---------------|-------------|
| **Lista de recetas** | Grid 4 columnas con cards |
| **Crear receta** | Formulario con categoría, nombre, costes |
| **Detalle receta** | Ingredientes, costes, acciones |
| **Ingredientes** | Tabla con cantidad, coste unitario, total |
| **Coste automático** | Cálculo desde ingredientes |
| **Acciones preparación** | Pasos de elaboración (próximamente) |

### 4.3 Escandallos (Costes)
**Ruta:** `/admin/cocina/escandallos`

| Funcionalidad | Descripción |
|---------------|-------------|
| **Selector de evento** | Elegir evento para ver escandallo |
| **Ingredientes × pax** | Coste desglosado por ingrediente |
| **Agrupación por categoría** | Carnes, verduras, lácteos, etc. |
| **KPIs** | Comensales, ingredientes, coste total, coste/pax |

#### Motor de Bebidas (integrado)
| Funcionalidad | Descripción |
|---------------|-------------|
| **Configuración** | % bebedores, bebidas por persona |
| **Distribución** | Vino, cerveza, refresco, agua |
| **Cálculo automático** | Botellas, latas, cafés, hielo |
| **Coste total** | Suma al escandallo del evento |

#### Panel de Margen/PVP (integrado)
| Funcionalidad | Descripción |
|---------------|-------------|
| **Coste alimentos** | Desde escandallo |
| **Coste bebidas** | Desde motor de bebidas |
| **Personal** | Coste de staff editable |
| **Imprevistos** | % configurable (default 5%) |
| **Margen** | % configurable (default 25%) |
| **PVP/pax** | Precio de venta por persona |
| **PVP total** | Precio total del evento |

### 4.4 Producción
**Ruta:** `/admin/cocina/produccion`

| Funcionalidad | Descripción |
|---------------|-------------|
| **Selector evento** | Elegir evento a planificar |
| **3 pestañas** | Timing, Distribución, Tareas |

#### Timing del Evento
| Funcionalidad | Descripción |
|---------------|-------------|
| **5 fases** | Llegada, Preparación, Servicio, Limpieza, Salida |
| **Horarios** | Hora planificada por cada concepto |
| **Duration** | Minutos estimados por fase |
| **Conceptos** | Personal DG, camión, extras, aperitivo, etc. |

#### Distribución por Zona
| Zona | Icono | Descripción |
|------|-------|-------------|
| Aperitivos | 🍴 | Montaje de aperitivos |
| Frío | ❄️ | Preparación de frío |
| Caliente | 🔥 | Cocina caliente |
| Frito | 🍳 | Estación de fritos |
| Entrante | 🥣 | Primer plato |
| Primero | 🥘 | Segundo plato |
| Segundo | 🥩 | Plato principal |
| Postre | 🍰 | Repostería |
| Recena | 🌙 | Cena/recena |

#### Checklist de Tareas
| Funcionalidad | Descripción |
|---------------|-------------|
| **Lista de tareas** | Tareas de producción |
| **Asignación** | Responsable por tarea |
| **Zona** | A qué zona pertenece |
| **Hora** | Cuándo se realiza |
| **Progreso** | Porcentaje completado |
| **Check** | Marcar como hecho |

### 4.5 Carga
**Ruta:** `/admin/cocina/carga`

| Funcionalidad | Descripción |
|---------------|-------------|
| **Selector evento** | Elegir evento |
| **3 pestañas** | Comida, Vajilla, Packs |

#### Comida por Pases
| Funcionalidad | Descripción |
|---------------|-------------|
| **1er Pase** | Aperitivos, fríos |
| **2do Pase** | Calientes, bebidas |
| **3er Pase** | Postre, montaje |
| **Check por item** | Marcar cargado |

#### Vajilla/Loza (próximamente)
| Funcionalidad | Descripción |
|---------------|-------------|
| **Inventario** | Plato, cubiertos, cristalería |
| **Cantidad necesaria** | Según pax del evento |
| **Cantidad cargada** | Lo que se sube al camión |
| **Proveedores** | Alquiler externo |

#### Packs Especiales (próximamente)
| Pack | Contenido |
|------|-----------|
| **Pack Camareros** | Pan, mantequilla, agua, café |
| **Pack Alérgenos** | Pan sin gluten, leche soja |
| **Pack Supervivencia** | Sal, pimienta, aove, film |

### 4.6 Logística
**Ruta:** `/admin/cocina/logistica`

| Funcionalidad | Descripción |
|---------------|-------------|
| **Selector evento** | Elegir evento |
| **Categorías** | Mobiliario, maquinaria, equipos, cristalería |
| **Control ida/vuelta** | Qué sale y qué vuelve |
| **Cantidad +/-** | Ajustar cantidades |
| **Check preparado** | Marcar listo |

### 4.7 APPCC (Control Sanitario)
**Ruta:** `/admin/cocina/appcc`

| Funcionalidad | Descripción |
|---------------|-------------|
| **7 pestañas** | Recepción, Almacén, Elaboración, Servicio, Limpieza, Incidencias, Aceite |
| **Selector centro** | Cocina Central, Sala Principal, Truck Externo |
| **KPIs** | Controles realizados vs pendientes |
| **Footer resumen** | Estado global por sección |

#### Recepción
| Campo | Tipo |
|-------|------|
| Proveedor | Texto |
| Producto | Texto |
| Temperatura | Numérico (°C) |
| Embalaje OK | Checkbox |
| Caducidad OK | Checkbox |
| Validar | Botón |

#### Almacenamiento
| Campo | Tipo |
|-------|------|
| Cámara | Select (4 cámaras) |
| Temperatura mañana | Numérico |
| Temperatura tarde | Numérico |
| Validar | Botón |

#### Elaboración
| Campo | Tipo |
|-------|------|
| Plato | Texto |
| Temp. cocción | Numérico (≥65°C) |
| Hora cocción | Hora |
| Responsable | Texto |
| Validar | Botón |

#### Limpieza
| Funcionalidad | Descripción |
|---------------|-------------|
| **4 zonas** | Cocina, Cámaras, Sala, Baños |
| **Tareas por zona** | Lista de tareas específicas |
| **Check por tarea** | Marcar completada |
| **Responsable** | Quién realiza |

#### Incidencias
| Campo | Tipo |
|-------|------|
| Descripción | Texto |
| Tipo | Select (avería, temperatura, higiene) |
| Medida correctora | Texto |
| Resuelta | Botón |

#### Aceite Fritura
| Campo | Tipo |
|-------|------|
| Compuestos polares | Numérico (límite 25%) |
| Cambiado | Botón |
| Alerta | Automática si >25% |

---

## 📦 MÓDULO 5: INVENTARIO

### 5.1 Inventario de Ingredientes
**Ruta:** `/admin/inventario`

| Funcionalidad | Descripción |
|---------------|-------------|
| **Tabla completa** | Nombre, unidad, stock, mínimo, coste, proveedor |
| **Filtros** | Por categoría, búsqueda, solo stock bajo |
| **CRUD** | Crear, editar, eliminar ingredientes |
| **Ajuste rápido** | +/- stock inline |
| **KPIs** | Total, stock bajo, valor inventario, en recetas |

**Categorías:**
- Proteínas, Verduras, Lácteos, Carbohidratos, Bebidas, Especias, Pescados, Frutas, Otros

### 5.2 Stock de Cocina
**Ruta:** `/admin/cocina/stock` (integrado en Logística)

| Funcionalidad | Descripción |
|---------------|-------------|
| **Inventario equipamiento** | Material reutilizable |
| **CRUD** | Crear, editar, eliminar items |
| **Stock cantidad** | Control de unidades |
| **Alertas** | Stock bajo automático |

---

## 🚚 MÓDULO 6: PROVEEDORES

### 6.1 Gestión de Proveedores
**Ruta:** `/admin/proveedores`

| Funcionalidad | Descripción |
|---------------|-------------|
| **Lista proveedores** | Cards con info básica |
| **Detalle proveedor** | Panel lateral con ingredientes vinculados |
| **CRUD** | Crear, editar, eliminar |
| **Categorías** | Carnes, Pescados, Verduras, Lácteos, Bebidas, etc. |
| **Contacto** | Nombre, teléfono, email |

### 6.2 Vinculación con Ingredientes
| Funcionalidad | Descripción |
|---------------|-------------|
| **Ingredientes por proveedor** | Lista de lo que suministra |
| **Costes** | Precio por ingrediente |
| **Historial** | Cambios de precio |

---

## 👥 MÓDULO 7: STAFFING (RRHH)

### 7.1 Panel Principal
**Ruta:** `/admin/staffing`

| KPI | Descripción |
|-----|-------------|
| **Empleados activos** | Total staff disponible |
| **Horas este mes** | Horas trabajadas |
| **Total horas** | Coste de horas |
| **Nómina pendiente** | Por pagar |

### 7.2 Gestión de Empleados
| Funcionalidad | Descripción |
|---------------|-------------|
| **CRUD empleados** | Crear, editar, eliminar |
| **Tipos de contrato** | Indefinido, Temporal, Por horas, Autónomo |
| **Estados** | Activo, Baja temporal, Baja definitiva, Pendiente |
| **Roles** | Camarero, Metre, Cocinero, Barman, Azafata, Auxiliar |
| **Datos personales** | DNI, Seguridad Social, cuenta bancaria |
| **Tarifas** | Por hora o salario mensual |

### 7.3 Control de Horas
| Funcionalidad | Descripción |
|---------------|-------------|
| **Registro horas** | Por empleado, fecha, evento |
| **Cálculo automático** | Horas × tarifa |
| **Filtros** | Por período, empleado |
| **Estados** | Pendiente, Aprobado, Pagado |

### 7.4 Nómina Automática
| Funcionalidad | Descripción |
|---------------|-------------|
| **Generación mensual** | Cálculo automático |
| **Por tipo contrato** | Base + horas extra (1.5x) |
| **Deducciones** | IRPF (15%), Seguridad Social (6.5%) |
| **Historial** | Nóminas anteriores |

---

## 💰 MÓDULO 8: FINANZAS

### 8.1 Presupuestos
**Ruta:** `/admin/kanban` (desde Captación)

| Funcionalidad | Descripción |
|---------------|-------------|
| **Crear presupuesto** | Desde lead o evento |
| **Estados** | Borrador → Enviado → Aceptado → Realizado |
| **Líneas de coste** | Desglose por categorías |
| **IVA** | Cálculo automático |
| **Enviar PDF** | Generar y enviar al cliente |
| **Aceptar/rechazar** | Flujo de aprobación |

### 8.2 Facturación
| Funcionalidad | Descripción |
|---------------|-------------|
| **Generar factura** | Desde evento aceptado |
| **Numeración** | F-AAAA-NNNN automática |
| **PDF** | Generación de factura PDF |
| **Estado** | Pendiente, Pagada |

### 8.3 Cobros
| Funcionalidad | Descripción |
|---------------|-------------|
| **Registrar cobro** | Efectivo, transferencia |
| **Señal 40%** | Al aceptar presupuesto |
| **Resto 60%** | Antes del evento |
| **Historial** | Pagos registrados |

### 8.4 Rentabilidad
| Funcionalidad | Descripción |
|---------------|-------------|
| **Cálculo margen** | Coste vs PVP |
| **Por evento** | Rentabilidad individual |
| **Tendencia** | Evolución temporal |

---

## ⚙️ MÓDULO 9: CONFIGURACIÓN

### 9.1 Ajustes del Negocio
**Ruta:** `/admin/config`

| Funcionalidad | Descripción |
|---------------|-------------|
| **Datos empresa** | Nombre, CIF, dirección |
| **Logo** | Personalización |
| **Email** | Configuración SMTP |

### 9.2 Gestión de Usuarios
**Ruta:** `/admin/config/users`

| Funcionalidad | Descripción |
|---------------|-------------|
| **CRUD usuarios** | Crear, editar, eliminar |
| **Roles** | Admin, Gerente, Analista, Jefe Cocina, Cocinero, Maitre, Camarero |
| **Permisos** | Control de acceso por módulo |

### 9.3 Integraciones
**Ruta:** `/admin/config/integrations`

| Funcionalidad | Descripción |
|---------------|-------------|
| **Webhooks** | Integraciones externas |
| **Workers** | Tareas en segundo plano |
| **API** | Acceso externo |

---

## 🔐 ROLES Y PERMISOS (RBAC)

| Rol | Acceso |
|-----|--------|
| **Admin** | Todo el sistema |
| **Gerente** | Operaciones + Finanzas |
| **Analista** | Solo lectura + Reportes |
| **Jefe Cocina** | Todo Cocina + Stock |
| **Cocinero** | Recetas + Producción |
| **Maitre** | Sala + Staffing |
| **Camarero** | Mapa mesas + Ocupación |

---

## 📊 DASHBOARD PRINCIPAL

**Ruta:** `/admin`

| KPI | Descripción |
|-----|-------------|
| **Eventos del mes** | Total programados |
| **Ingresos del mes** | Facturación |
| **Leads nuevos** | Captación |
| **Tasa conversión** | Lead → Cliente |
| **Próximos eventos** | Lista rápida |
| **Alertas** | Stock bajo, pagos pendientes |

---

## 🔧 TECNOLOGÍAS

| Componente | Tecnología |
|------------|------------|
| **Frontend** | Next.js 14, React, TypeScript |
| **Estilos** | Tailwind CSS, diseño compacto |
| **Iconos** | Phosphor Icons (react-icons/pi) |
| **Base datos** | PostgreSQL |
| **Backend** | Next.js API Routes |
| **Auth** | JWT (cookies) |
| **Despliegue** | Docker Compose |
| **Dominio** | eventcater.duckdns.org |

---

## 📈 MÉTRICAS DEL SISTEMA

| Métrica | Valor |
|---------|-------|
| **Tablas PostgreSQL** | 91+ |
| **Rutas API** | 137+ |
| **Páginas admin** | 35+ |
| **Componentes React** | 50+ |
| **Tests** | 72+ |
| **Recetas migradas** | 135 |
| **Proveedores** | 6 |
| **Leads** | 165 |

---

## 🚀 ESTADO ACTUAL

### ✅ Implementado y Funcionando
- ✅ CRM completo (Leads, Pipeline, Clientes)
- ✅ Gestión de eventos
- ✅ Catálogo de platos
- ✅ Mapa de mesas
- ✅ Escandallos con motor de bebidas y margen
- ✅ Producción con timing y distribución
- ✅ Carga de eventos
- ✅ Logística de equipamiento
- ✅ APPCC completo (7 secciones)
- ✅ Inventario de ingredientes
- ✅ Proveedores
- ✅ Staffing y nómina
- ✅ RBAC con 7 roles
- ✅ Dashboard con KPIs

### 🔄 En Desarrollo
- 🔄 Vajilla/Loza en Carga
- 🔄 Packs predefinidos
- 🔄 Acciones de preparación en Recetas
- 🔄 Checklist semanal de producción

### 📋 Próximamente
- 📋 Facturae/Verifactu
- 📋 Pasarela de pago
- 📋 Contratos con firma digital
- 📋 KDS en tiempo real

---

*Documento generado el 29 de Julio 2026*
*EventFlow v1.0 — ERP para Catering y Celebraciones*
