# API-MAP.md — Mapa Completo de Rutas API de EventFlow

**Generado por:** WP-00 Reconocimiento del Sistema  
**Fecha:** 2026-07-30  
**Fuente:** `src/app/api/**/route.ts` (Next.js App Router)

---

## Convenciones de Rutas

- **Base path:** `/api/`
- **Auth:** JWT via cookie `admin_session` o `eventflow_token`
- **Middleware:** `src/middleware.ts` valida token en rutas `/api/admin/*` y `/api/staffing/*`
- **RBAC:** Roles: `admin, cocina, camareros, clientes` (columna `admins.role`)
- **Respuesta:** `{ success: boolean, data: any, error?: string }`
- **Métodos HTTP:** GET (lectura), POST (crear/acción), PUT (actualizar), DELETE (eliminar)

---

## Catálogo de Rutas por Módulo (137+ rutas)

### 1. AUTENTICACIÓN (3)
- POST `/api/auth/login` — Login
- POST `/api/auth/logout` — Logout
- GET `/api/auth/me` — Usuario actual

### 2. ADMIN / USERS (7)
- GET/POST `/api/admin/users` — Lista/crear usuarios (admin)
- GET/PUT/DELETE `/api/admin/users/[id]` — CRUD usuario
- POST `/api/admin/seed-ejemplo` — Seed datos
- GET `/api/admin/guest-forms` — Formularios

### 3. EVENTS — CRM Core (15)
- GET/POST `/api/events` — Lista/crear eventos
- GET/PUT/DELETE `/api/events/[id]` — CRUD evento
- GET `/api/events/light` — Lista ligera
- POST `/api/events/[id]/transitions` — Transición de estado
- POST `/api/events/[id]/confirm` — Confirmar
- POST `/api/events/[id]/close` — Cerrar
- GET/POST `/api/events/[id]/contract` — Contrato
- POST `/api/events/[id]/contract/generate` — PDF contrato
- POST `/api/events/[id]/contract/void` — Anular contrato
- GET `/api/events/[id]/invoice` — Factura
- GET `/api/events/[id]/gastos-previos` — Gastos previos

### 4. LEADS (6)
- GET/POST `/api/leads` — Lista/crear
- GET/PUT/DELETE `/api/leads/[id]` — CRUD
- POST `/api/leads/[id]/assign` — Asignar comercial

### 5. CLIENTS (5)
- GET/POST `/api/clients` — Lista/crear
- GET/PUT/DELETE `/api/clients/[id]` — CRUD

### 6. QUOTES — Presupuestos (9)
- GET/POST `/api/quotes` — Lista/crear
- GET/PUT/DELETE `/api/quotes/[id]` — CRUD
- GET `/api/quotes/[id]/trace` — Trazabilidad
- GET `/api/quotes/public/[id]` — Vista pública (sin auth)
- POST `/api/quotes/public/[id]/accept` — Aceptar (sin auth)
- POST `/api/quotes/public/[id]/reject` — Rechazar (sin auth)

### 7. EVENT ORDERS — Órdenes (6)
- GET/POST `/api/event-orders` — Lista/crear
- GET/PUT `/api/event-orders/[id]` — Detalle/actualizar
- GET/POST `/api/event-orders/[id]/waiters` — Camareros

### 8. INVOICES — Facturas (4)
- GET/POST `/api/invoices` — Lista/crear
- GET/PUT `/api/invoices/[id]` — Detalle/actualizar

### 9. PAYMENTS — Pagos (5)
- GET/POST `/api/payments` — Lista/crear
- GET/PUT `/api/payments/[id]` — Detalle/actualizar
- POST `/api/payments/signal` — Registrar señal

### 10. CATALOG — Catálogo Platos (5)
- GET/POST `/api/catalog` — Lista/crear (agrupado por categoría)
- GET/PUT/DELETE `/api/catalog/[id]` — CRUD

### 11. RECIPES — Recetas/Doble vía (16)
- GET/POST `/api/recipes` — Lista/crear
- GET/PUT `/api/recipes/[id]` — Detalle/actualizar
- GET/POST `/api/cocina/recipes` — Lista/crear cocina
- GET/PUT `/api/cocina/recipes/[id]` — Detalle/actualizar cocina
- GET/POST `/api/cocina/recipes/[id]/items` — Ingredientes
- PUT/DELETE `/api/cocina/recipes/[id]/items/[itemId]` — Ingrediente
- POST `/api/cocina/recipes/import` — Importar CSV/Excel
- POST `/api/cocina/recipes/import-ficha` — Importar ficha técnica

### 12. STOCK — Ingredientes (12)
- GET/PUT `/api/stock` — Lista/actualizar
- POST `/api/stock/deduct` — Deducir por evento
- GET `/api/stock/check` — Verificar disponibilidad
- GET `/api/stock/actuals` — Stocks actuales
- POST `/api/stock/auto-orders` — Auto-generar pedidos
- POST `/api/stock/generate-order` — Generar pedido
- GET `/api/stock/recipes` — Stock recetas
- GET `/api/stock/escandallos` — Escandallos
- GET `/api/stock/price-history` — Histórico precios
- GET `/api/stock/supplier-orders` — Pedidos proveedores
- GET `/api/stock/uom` — Unidades de medida

### 13. ESCANDALLO — Costes (6)
- GET `/api/escandallo/[eventId]` — Escandallo evento
- POST `/api/escandallo/[eventId]/freeze` — Congelar
- POST `/api/escandallo/[eventId]/freeze/recalc` — Recalcular
- GET `/api/escandallo/event/[eventId]` — Alternativo
- GET `/api/escandallo/ingredient-prices` — Precios
- GET `/api/costing/[eventId]` — Coste evento

### 14. COCINA — Operaciones (15)
- GET `/api/cocina/alertas` — Alertas
- GET/POST `/api/cocina/passes` — Pases servicio
- GET/PUT `/api/cocina/passes/[id]` — Detalle pase
- GET `/api/cocina/service-passes` — Pases servicio
- GET `/api/cocina/guia/[eventId]` — Guía evento
- GET `/api/cocina/event/[eventId]/loading` — Carga
- GET `/api/cocina/event/[eventId]/logistics` — Logística
- GET `/api/cocina/event/[eventId]/passes` — Pases evento
- GET `/api/cocina/event/[eventId]/production` — Producción
- GET `/api/hoja-operacion/[eventId]` — Hoja operación
- GET `/api/briefing/[eventId]` — Briefing
- POST `/api/briefing/[eventId]` — Generar briefing
- GET `/api/briefing/[eventId]/memo` — Memo camareros

### 15. EQUIPAMIENTO (6)
- GET/POST `/api/cocina/equipment` — Lista/crear
- GET/PUT `/api/cocina/equipment/[id]` — CRUD
- POST `/api/cocina/equipment/checkout/[eventId]` — Checkout
- GET `/api/cocina/equipment-rules` — Reglas

### 16. PROVEEDORES (8)
- GET/POST `/api/providers` — Lista/crear
- GET/PUT `/api/providers/[id]` — CRUD
- GET/POST `/api/provider-invoices` — Facturas proveedor
- GET/PUT `/api/provider-invoices/[id]` — Detalle factura

### 17. STAFFING — Personal (17)
- GET/POST `/api/staffing/workers` — Lista/crear trabajadores
- GET/PUT `/api/staffing/workers/[id]` — CRUD trabajador
- GET `/api/staffing/workers/[id]/contract` — Contrato
- GET/POST `/api/staffing/lines` — Líneas staffing
- GET/PUT `/api/staffing/lines/[id]` — Detalle línea
- POST `/api/staffing/lines/[id]/offers` — Enviar ofertas
- POST `/api/staffing/lines/[id]/assignments` — Asignar
- GET/POST `/api/staffing/pay` — Nómina
- GET `/api/staffing/pay/[id]/sign` — Firma pago
- GET `/api/staffing/payroll` — Nómina completa
- GET `/api/staffing/trace/[workerId]` — Trazabilidad
- GET `/api/staffing/uniforms` — Uniformes

### 18. MAPA DE MESAS (9)
- GET/POST `/api/mapa-mesas/[eventId]` — Mapa evento
- GET/POST `/api/mapa-mesas/[eventId]/assignments` — Asignaciones
- POST `/api/mapa-mesas/[eventId]/assignments/auto` — Auto-asignar
- GET `/api/mapa-mesas/ocupacion` — Ocupación
- GET `/api/mapa-mesas/page` — Página mapa
- GET/POST `/api/floor-plan` — Planos planta
- POST `/api/floor-plan/generate` — Generar plano

### 19. GUESTS — Invitados (8)
- GET/POST `/api/guests` — Lista/crear
- GET/PUT `/api/guests/[id]` — CRUD
- GET `/api/guest-menus/[eventId]` — Menús invitados
- GET/POST `/api/guest-forms` — Formularios lista
- GET `/api/guest-forms/decor` — Decoración

### 20. WAITERS — Camareros (2)
- GET/POST `/api/waiters` — Lista/crear

### 21. TRAZABILIDAD (9)
- GET `/api/trazabilidad/inventory` — Inventario
- GET `/api/trazabilidad/inventory/[ingredientId]` — Ingrediente
- GET `/api/trazabilidad/movements` — Movimientos
- GET `/api/trazabilidad/trace/[eventId]` — Trazabilidad evento
- GET `/api/trazabilidad/lot-consumption/[eventId]` — Consumo lote
- GET/POST `/api/trazabilidad/receiving` — Recepciones
- GET `/api/trazabilidad/receiving/[id]` — Detalle recepción
- GET `/api/trazabilidad/receiving/from-order/[orderId]` — Desde orden

### 22. APPCC / HACCP (2)
- GET/POST `/api/appcc/[resource]` — Recurso APPCC dinámico

### 23. EVENT PLANNING (5)
- GET/POST `/api/event-plans` — Planes evento
- GET/PUT `/api/event-plans/[id]` — CRUD plan
- GET `/api/generate-operations/[id]` — Generar operaciones

### 24. SHOPPING (1)
- GET `/api/shopping` — Lista compras

### 25. EVENT FLOW (1)
- POST `/api/event-flow/[eventId]/calculate` — Calcular operaciones

### 26. RENTABILIDAD (1)
- GET `/api/rentabilidad` — Rentabilidad

### 27. INTERACTIONS — CRM (2)
- GET/POST `/api/interactions` — Lista/crear

### 28. AUTOMATION RULES (5)
- GET/POST `/api/automation-rules` — Lista/crear
- GET/PUT/DELETE `/api/automation-rules/[id]` — CRUD

### 29. CHECKLIST (3)
- GET/POST `/api/checklist` — Lista/crear tareas
- POST `/api/checklist/init` — Inicializar

### 30. BAR CONFIG (1)
- GET `/api/bar-config` — Config barra

### 31. SETTINGS (2)
- GET/PUT `/api/settings` — Config negocio

### 32. PROPOSED MENUS (1)
- GET `/api/proposed-menus` — Menús predefinidos

### 33. AI QUOTE (1)
- POST `/api/ai-quote` — Generar con IA

### 34. OCR (2)
- POST `/api/ocr/process` — Procesar OCR
- POST `/api/ocr/apply` — Aplicar resultado

### 35. UPLOAD (2)
- POST `/api/upload/receipt` — Subir justificante
- POST `/api/upload/recipe-photo` — Subir foto

### 36. SEND BUDGET (1)
- POST `/api/send-budget/[eventId]` — Enviar por email

### 37. APPOINTMENTS — Citas (4)
- GET/POST `/api/appointments` — Lista/crear
- GET/PUT `/api/appointments/[id]` — CRUD

### 38. CONTRACT — Contratos públicos (2)
- GET `/api/contract/public/[token]` — Ver (sin auth)
- POST `/api/contract/public/[token]/sign` — Firmar (sin auth)

### 39. CRON JOBS (4)
- POST `/api/cron/payment-reminders` — Recordatorios pago
- POST `/api/cron/post-event-followup` — Seguimiento post
- POST `/api/cron/pre-event-briefing` — Briefings previos
- POST `/api/cron/pre-event-reminders` — Recordatorios previos

### 40. WEBHOOKS (2)
- POST `/api/webhooks/test` — Test webhook
- POST `/api/webhooks/whatsapp-stuffing` — WhatsApp

### 41. WHATSAPP (1)
- POST `/api/whatsapp/inbound` — Mensaje entrante

---

## Total Estimado: ~150 rutas

## Rutas Públicas (sin auth)
- `/api/quotes/public/[id]` — Ver presupuesto
- `/api/quotes/public/[id]/accept` — Aceptar
- `/api/quotes/public/[id]/reject` — Rechazar
- `/api/contract/public/[token]` — Ver contrato
- `/api/contract/public/[token]/sign` — Firmar contrato
- `/api/webhooks/*` — Webhooks
- `/api/whatsapp/*` — WhatsApp
